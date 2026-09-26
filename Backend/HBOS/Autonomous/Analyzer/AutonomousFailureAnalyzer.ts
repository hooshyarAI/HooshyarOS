import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { ProvenanceTrace } from "../../Core/ProvenanceTrace";

/**
 * Evidence-driven failure diagnosis for the autonomous construction plane.
 *
 * The analyzer is intentionally deterministic and fail-closed: it never invents
 * a root cause. When the supplied evidence carries no real failure signal it
 * reports `UNKNOWN` with an empty cause set, so the repair path cannot act on a
 * fabricated diagnosis.
 *
 * The diagnosis carries a canonical `ProvenanceTrace` id so a later audit can
 * correlate the failure, its causes and its blast radius with the repository
 * lineage that produced them.
 */

export interface FailureReport {
    type: string;
    file: string;
    message: string;
}

export type FailureKind =
    | "compile"
    | "assertion"
    | "timeout"
    | "module"
    | "launcher"
    | "runtime"
    | "test"
    | "unknown";

export interface FailureChainStep {
    order: number;
    kind: FailureKind;
    file?: string;
    line?: number;
    message: string;
}

export interface RootCauseCandidate {
    cause: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    evidence: string[];
}

export interface BlastRadius {
    /** Repository-relative source files named directly by the failure evidence. */
    directFiles: string[];
    /** Canonical engine/service owners of the affected files. */
    owners: string[];
    /** Direct importers of the affected files, discovered from real imports. */
    dependents: string[];
    /** Capabilities/dependencies declared by the failing mission. */
    capabilities: string[];
    /** True only when the reverse-dependency scan was confined and completed. */
    bounded: boolean;
    scannedFiles: number;
}

export interface FailureDiagnosis {
    traceId: string;
    type: string;
    primaryFile: string;
    evidencePresent: boolean;
    chain: FailureChainStep[];
    rootCauses: RootCauseCandidate[];
    blastRadius: BlastRadius;
}

export interface FailureEvidence {
    output: string;
    issues?: readonly string[];
    capabilityId?: string;
    targetEngine?: string;
    dependencies?: readonly string[];
    changedFiles?: readonly string[];
}

export interface FailureAnalyzerOptions {
    /** Repository root used for blast-radius reverse-dependency scanning. */
    root?: string;
    maxScanFiles?: number;
    maxFileBytes?: number;
}

const DEFAULT_MAX_SCAN_FILES = 4000;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024;
const MAX_CHAIN_STEPS = 100;

const FILE_REFERENCE_PATTERN =
    /(?:Backend|scripts|Frontend|android|qa)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|cjs|mjs|py|json)/g;
const IMPORT_SPECIFIER_PATTERN =
    /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

type FailureSignal = {
    kind: FailureKind;
    regex: RegExp;
    line?: number;
    message: (match: RegExpMatchArray) => string;
};

const FAILURE_SIGNALS: FailureSignal[] = [
    {
        kind: "compile",
        regex: /\((\d+),\d+\):\s*error TS(\d+):\s*(.+)$/,
        line: 1,
        message: match => `TypeScript TS${match[2]}: ${match[3].trim()}`
    },
    {
        kind: "module",
        regex: /Cannot find module ['"]([^'"]+)['"]/,
        message: match => `Module resolution failure for '${match[1]}'`
    },
    {
        kind: "launcher",
        regex: /\bEINVAL\b/,
        message: () => "Process could not be launched (EINVAL)"
    },
    {
        kind: "launcher",
        regex: /is not recognized as an internal or external command/,
        message: () => "Command processor could not resolve the launch command"
    },
    {
        kind: "timeout",
        regex: /Exceeded timeout of (\d+) ?ms|Test timed out in (\d+) ?ms/,
        message: match => `Operation exceeded its time budget (${match[1] ?? match[2]} ms)`
    },
    {
        kind: "assertion",
        regex: /\.(?:toBe|toEqual|toStrictEqual|toMatchObject|toContain|toThrow)\s*\(/,
        message: () => "Behavioral assertion executed and failed"
    },
    {
        kind: "test",
        regex: /^\s*FAIL\s+(\S+)/,
        message: match => `Focused test suite failed: ${match[1]}`
    },
    {
        kind: "runtime",
        regex: /^\s*(?:Error|TypeError|ReferenceError|RangeError):\s*(.+)$/,
        message: match => `Runtime error: ${match[1].trim()}`
    }
];

export class AutonomousFailureAnalyzer {
    private readonly options: FailureAnalyzerOptions;

    constructor(options: FailureAnalyzerOptions = {}) {
        this.options = options;
    }

    /**
     * Backwards-compatible compact report used by the heal orchestrator.
     */
    analyze(output: string): FailureReport {
        const diagnosis = this.diagnose({ output });
        const type = diagnosis.type === "UNKNOWN" && output.includes("FAIL") ? "TEST_FAILURE" : diagnosis.type;
        return {
            type,
            file: diagnosis.primaryFile,
            message: diagnosis.chain[0]?.message ?? "No failure signal detected in the supplied evidence"
        };
    }

    diagnose(evidence: FailureEvidence): FailureDiagnosis {
        const output = typeof evidence.output === "string" ? evidence.output : "";
        const issues = (evidence.issues ?? []).filter(issue => typeof issue === "string" && issue.trim().length > 0);
        const lines = output.split(/\r?\n/);

        const chain: FailureChainStep[] = [];
        for (let index = 0; index < lines.length && chain.length < MAX_CHAIN_STEPS; index += 1) {
            const line = lines[index];
            for (const signal of FAILURE_SIGNALS) {
                const match = line.match(signal.regex);
                if (!match) continue;
                const file = this.firstFileReference(line);
                const lineNumber = signal.line !== undefined ? Number(match[signal.line]) : undefined;
                const step: FailureChainStep = {
                    order: chain.length + 1,
                    kind: signal.kind,
                    message: signal.message(match),
                    ...(file ? { file } : {}),
                    ...(Number.isFinite(lineNumber) ? { line: lineNumber } : {})
                };
                if (!this.isDuplicateStep(chain[chain.length - 1], step)) chain.push(step);
                break;
            }
        }

        for (const issue of issues) {
            const step: FailureChainStep = {
                order: chain.length + 1,
                kind: this.kindForIssue(issue),
                message: issue.trim()
            };
            if (!this.isDuplicateStep(chain[chain.length - 1], step)) chain.push(step);
        }

        const referencedFiles = this.referencedFiles(output, evidence.changedFiles ?? []);
        const evidencePresent = chain.length > 0 && (output.trim().length > 0 || issues.length > 0);
        const primaryFile = referencedFiles[0] ?? "unknown";
        const type = this.typeFor(chain);
        const rootCauses = this.rootCauses(chain, issues, referencedFiles);
        const blastRadius = this.blastRadius(referencedFiles, evidence);

        return {
            traceId: ProvenanceTrace.createTraceId(),
            type,
            primaryFile,
            evidencePresent,
            chain,
            rootCauses,
            blastRadius
        };
    }

    private isDuplicateStep(previous: FailureChainStep | undefined, step: FailureChainStep): boolean {
        return Boolean(previous && previous.kind === step.kind && previous.message === step.message);
    }

    private kindForIssue(issue: string): FailureKind {
        const normalised = issue.toLowerCase();
        if (normalised.includes("timeout")) return "timeout";
        if (normalised.includes("not found") || normalised.includes("module")) return "module";
        if (normalised.includes("einval") || normalised.includes("launch")) return "launcher";
        if (normalised.includes("architecture") || normalised.includes("plan")) return "compile";
        return "unknown";
    }

    private typeFor(chain: readonly FailureChainStep[]): string {
        const kinds = chain.map(step => step.kind);
        if (kinds.includes("compile")) return "COMPILE_FAILURE";
        if (kinds.includes("module")) return "MODULE_RESOLUTION_FAILURE";
        if (kinds.includes("launcher")) return "LAUNCHER_FAILURE";
        if (kinds.includes("timeout")) return "TIMEOUT_FAILURE";
        if (kinds.includes("assertion") || kinds.includes("test")) return "TEST_FAILURE";
        if (kinds.includes("runtime")) return "RUNTIME_FAILURE";
        return "UNKNOWN";
    }

    private firstFileReference(line: string): string | undefined {
        const matches = line.match(FILE_REFERENCE_PATTERN);
        return matches && matches[0] ? this.normalisePath(matches[0]) : undefined;
    }

    private referencedFiles(output: string, changedFiles: readonly string[]): string[] {
        const seen = new Set<string>();
        const ordered: string[] = [];
        const candidates = [...(output.match(FILE_REFERENCE_PATTERN) ?? []), ...changedFiles];
        for (const candidate of candidates) {
            if (!candidate) continue;
            const normalised = this.normalisePath(candidate);
            if (normalised === "unknown" || seen.has(normalised)) continue;
            seen.add(normalised);
            ordered.push(normalised);
        }
        return ordered;
    }

    private normalisePath(path: string): string {
        const unified = path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
        const root = this.options.root;
        if (root) {
            const absoluteRoot = resolve(root).replace(/\\/g, "/");
            if (unified.toLowerCase().startsWith(absoluteRoot.toLowerCase() + "/")) {
                return unified.slice(absoluteRoot.length + 1);
            }
        }
        return unified;
    }

    private rootCauses(
        chain: readonly FailureChainStep[],
        issues: readonly string[],
        files: readonly string[]
    ): RootCauseCandidate[] {
        const causes: RootCauseCandidate[] = [];
        const kinds = new Set(chain.map(step => step.kind));
        const primary = files[0];

        if (kinds.has("compile")) {
            const compileStep = chain.find(step => step.kind === "compile");
            causes.push({
                cause: `Type or contract mismatch in ${compileStep?.file ?? primary ?? "the changed source"}`,
                confidence: "HIGH",
                evidence: [compileStep?.message ?? "TypeScript compile error"]
            });
        }
        if (kinds.has("module")) {
            const moduleStep = chain.find(step => step.kind === "module");
            causes.push({
                cause: "Missing, misnamed or unresolvable module dependency",
                confidence: "HIGH",
                evidence: [moduleStep?.message ?? "Cannot find module"]
            });
        }
        if (kinds.has("timeout")) {
            causes.push({
                cause: "Unbounded or slow work exceeded the operation time budget",
                confidence: "MEDIUM",
                evidence: [chain.find(step => step.kind === "timeout")?.message ?? "Timeout"]
            });
        }
        if (kinds.has("launcher")) {
            causes.push({
                cause: "Process launcher misuse on this platform (shell-free .cmd/.bat or quoted command construction)",
                confidence: "HIGH",
                evidence: [chain.find(step => step.kind === "launcher")?.message ?? "Launcher failure"]
            });
        }
        if (kinds.has("assertion") || kinds.has("test")) {
            causes.push({
                cause: "Behavioral assertion mismatch between expected and observed behavior",
                confidence: "MEDIUM",
                evidence: chain.filter(step => step.kind === "assertion" || step.kind === "test").map(step => step.message)
            });
        }
        if (kinds.has("runtime")) {
            causes.push({
                cause: "Unhandled runtime error on an execution path reached by the change",
                confidence: "MEDIUM",
                evidence: [chain.find(step => step.kind === "runtime")?.message ?? "Runtime error"]
            });
        }

        const unresolvedIssues = issues.filter(issue => issue.trim().length > 0);
        if (unresolvedIssues.length > 0) {
            causes.push({
                cause: "Construction gate reported an unresolved issue for this knot",
                confidence: "LOW",
                evidence: unresolvedIssues.map(issue => issue.trim())
            });
        }

        return causes;
    }

    private blastRadius(files: readonly string[], evidence: FailureEvidence): BlastRadius {
        const directFiles = [...files];
        const reverse = this.reverseDependencies(directFiles);
        const owners = new Set<string>();

        for (const file of directFiles) {
            const owner = this.engineOwnerOf(file);
            if (owner) owners.add(owner);
        }
        for (const dependent of reverse.dependents) {
            const owner = this.engineOwnerOf(dependent);
            if (owner) owners.add(owner);
        }
        if (evidence.targetEngine) owners.add(evidence.targetEngine);

        const capabilities = new Set<string>();
        if (evidence.capabilityId) capabilities.add(evidence.capabilityId);
        for (const dependency of evidence.dependencies ?? []) {
            if (dependency.trim()) capabilities.add(dependency.trim());
        }

        return {
            directFiles,
            owners: [...owners].sort(),
            dependents: reverse.dependents,
            capabilities: [...capabilities].sort(),
            bounded: reverse.bounded,
            scannedFiles: reverse.scannedFiles
        };
    }

    private engineOwnerOf(file: string): string | undefined {
        const normalised = file.replace(/\\/g, "/");
        const match = normalised.match(/(?:^|\/)Engines\/([A-Za-z0-9_]+)\.ts$/);
        if (match) return match[1];
        const product = normalised.match(/(?:^|\/)Product\/([A-Za-z0-9_]+)\.ts$/);
        if (product) return product[1];
        return undefined;
    }

    private reverseDependencies(files: readonly string[]): { dependents: string[]; scannedFiles: number; bounded: boolean } {
        const root = this.options.root;
        const targets = files.filter(file => file && file !== "unknown");
        if (!root || targets.length === 0) {
            return { dependents: [], scannedFiles: 0, bounded: targets.length === 0 };
        }

        const targetAbsolute = new Set(targets.map(file => resolve(root, file).replace(/\\/g, "/").toLowerCase()));
        const maxScanFiles = this.options.maxScanFiles ?? DEFAULT_MAX_SCAN_FILES;
        const maxFileBytes = this.options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
        const candidates = this.collectSourceFiles(join(root, "Backend"), maxScanFiles + 1);
        const bounded = candidates.length <= maxScanFiles;
        const dependents = new Set<string>();

        let scannedFiles = 0;
        for (const candidate of candidates.slice(0, maxScanFiles)) {
            scannedFiles += 1;
            let source: string;
            try {
                if (statSync(candidate).size > maxFileBytes) continue;
                source = readFileSync(candidate, "utf8");
            } catch {
                continue;
            }
            for (const specifier of this.importSpecifiers(source)) {
                const resolved = this.resolveSpecifier(candidate, specifier);
                if (resolved && targetAbsolute.has(resolved.toLowerCase())) {
                    dependents.add(this.normalisePath(candidate));
                    break;
                }
            }
        }

        return { dependents: [...dependents].sort(), scannedFiles, bounded };
    }

    private collectSourceFiles(root: string, cap: number): string[] {
        const collected: string[] = [];
        const pending: string[] = [root];
        while (pending.length > 0 && collected.length < cap) {
            const current = pending.pop() as string;
            let entries: string[];
            try {
                entries = readdirSync(current);
            } catch {
                continue;
            }
            for (const entry of entries) {
                if (entry === "node_modules" || entry === "dist" || entry === ".kilo") continue;
                const full = join(current, entry);
                let isDirectory = false;
                try {
                    isDirectory = statSync(full).isDirectory();
                } catch {
                    continue;
                }
                if (isDirectory) {
                    pending.push(full);
                } else if (/\.(?:ts|tsx|js|cjs|mjs)$/.test(entry)) {
                    collected.push(full);
                    if (collected.length >= cap) break;
                }
            }
        }
        return collected;
    }

    private importSpecifiers(source: string): string[] {
        const specifiers: string[] = [];
        for (const match of source.matchAll(IMPORT_SPECIFIER_PATTERN)) {
            if (match[1]) specifiers.push(match[1]);
        }
        return specifiers;
    }

    private resolveSpecifier(fromFile: string, specifier: string): string | undefined {
        if (!specifier.startsWith(".")) return undefined;
        // Probe the real, case-preserving path: lower-casing before the filesystem
        // check breaks on case-sensitive filesystems when the checkout path itself
        // contains upper-case characters. Comparison with the target set happens
        // case-insensitively at the call site.
        const base = resolve(fromFile, "..", specifier);
        const extensions = ["", ".ts", ".tsx", ".js", ".cjs", ".mjs", "/index.ts", "/index.js"];
        for (const extension of extensions) {
            const candidate = base + extension;
            try {
                if (statSync(candidate).isFile()) return candidate.replace(/\\/g, "/");
            } catch {
                continue;
            }
        }
        return undefined;
    }
}
