/// <reference types="node" />
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, relative, resolve, sep } from "node:path";
import { ConstructionContext, ConstructionTool } from "../../Builder/Autonomous/AutonomousConstructionEngine";
import { ensurePytest } from "./PythonVerificationBootstrap";
import { CommercialArtifactQualityAudit } from "./CommercialArtifactQualityAudit";

function run(command: string, args: string[], cwd: string, timeout = 15 * 60 * 1000) {
    const started = Date.now();
    try {
        let executable = command;
        let executableArgs = args;
        if (process.platform === "win32") {
            if (command === "git") executable = "git.exe";
            if (command === "npx") {
                executable = process.env.ComSpec || "cmd.exe";
                executableArgs = ["/d", "/s", "/c", "npx.cmd", ...args];
            }
        }
        const output = execFileSync(executable, executableArgs, { cwd, encoding: "utf8", timeout, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        return { ok: true, code: 0, output: String(output), error: null, elapsedMs: Date.now() - started };
    } catch (error: any) {
        const stdout = String(error?.stdout || "");
        const stderr = String(error?.stderr || "");
        const exitCode = error?.status ?? 1;
        const expectedGitDiffQuiet = command === "git" && args[0] === "diff" && args[1] === "--cached" && args[2] === "--quiet" && exitCode === 1;
        if (expectedGitDiffQuiet) return { ok: true, code: 1, output: `${stdout}${stderr}`, error: null, elapsedMs: Date.now() - started };
        console.error(JSON.stringify({ type: "AUTONOMOUS_TOOL_ERROR", command, args, cwd, exitCode, stdout, stderr, elapsedMs: Date.now() - started, message: error?.message ?? `${command} failed` }, null, 2));
        return { ok: false, code: exitCode, output: `${stdout}\n${stderr}`, error: error?.message ?? `${command} failed`, elapsedMs: Date.now() - started };
    }
}

function commandExists(command: string, cwd: string): boolean {
    try {
        const locator = process.platform === "win32" ? "where.exe" : "which";
        execFileSync(locator, [command], { cwd, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
        return true;
    } catch {
        return false;
    }
}

export type ImplementationAgent = "python";

export function resolveImplementationAgent(root = process.cwd()): ImplementationAgent | null {
    const requested = process.env.HOOSHYAR_AGENT?.trim().toLowerCase();
    if (requested && requested !== "python") return null;
    return commandExists("python", root) ? "python" : null;
}

export function repositoryStateChanged(before: string, after: string): boolean {
    return before.trim() !== after.trim();
}

export function buildAgentArgs(_agent: ImplementationAgent, prompt: string): string[] {
    return ["Backend/AI_Runtime/autonomous_builder.py", "--prompt", prompt];
}

const DEFAULT_DIRECTIVES = [
    "Implement exactly one concrete capability from the canonical mission.",
    "Create or update the focused implementation, focused test and documentation required by the architecture.",
    "Run focused verification for the selected knot; run Autonomous Builder tests periodically; run the full Jest suite only at the periodic integration checkpoint.",
    "Repair verification failures before finalization.",
    "Do not redesign Architecture Freeze V4.",
    "Never modify an existing dependency, engine, test or document merely to make the selected capability appear implemented.",
    "For a product capability, implement the product artifact paths declared by the durable product roadmap; do not substitute the target engine as the implementation artifact."
];

const REPOSITORY_STATUS_ARGS = ["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ":(exclude)node_modules"];
const FULL_VERIFY_EVERY = Math.max(1, Number.parseInt(process.env.HOOSHYAR_FULL_VERIFY_EVERY || "10", 10) || 10);
const BUILDER_TEST_EVERY = Math.max(1, Number.parseInt(process.env.HOOSHYAR_BUILDER_TEST_EVERY || "5", 10) || 5);

function focusedTestFor(capabilityId: string, root = process.cwd()): string | null {
    const canonicalCapabilityId = capabilityId.replace(/^(repair-)+/, "");
    const roadmapPath = join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json");
    if (existsSync(roadmapPath)) {
        try {
            const roadmap = JSON.parse(readFileSync(roadmapPath, "utf8")) as { capabilities?: Array<{ capabilityId?: string; testPath?: string }> };
            const capability = roadmap.capabilities?.find(item => item.capabilityId === canonicalCapabilityId);
            if (capability?.testPath) return capability.testPath;
        } catch {}
    }
    const known: Record<string, string> = {
        "platform.user-management": "Backend/HBOS/test/UserManagementEngine.test.ts",
        "platform.organization-model": "Backend/HBOS/test/OrganizationModelEngine.test.ts",
        "platform.security-layer": "Backend/HBOS/test/SecurityLayerEngine.test.ts",
        "platform.api-gateway": "Backend/HBOS/test/APIGatewayEngine.test.ts",
        "engine.reasoning.canonical": "Backend/HBOS/test/ReasoningEngine.test.ts",
        "engine.organizational.canonical": "Backend/HBOS/test/OrganizationalIntelligenceEngine.test.ts",
        "engine.autonomous-operations.canonical": "Backend/HBOS/test/AutonomousOperationsEngine.test.ts",
        "runtime.reasoning.bridge": "Backend/HBOS/test/PythonReasoningAdapter.test.ts",
        "platform.financial-intelligence": "Backend/HBOS/test/FinancialIntelligenceEngine.test.ts",
        "platform.budget-intelligence": "Backend/HBOS/test/BudgetIntelligenceEngine.test.ts",
        "platform.tax-intelligence": "Backend/HBOS/test/TaxIntelligenceEngine.test.ts",
        "platform.risk-intelligence": "Backend/HBOS/test/RiskIntelligenceEngine.test.ts",
        "platform.dashboard": "Backend/HBOS/test/DashboardEngine.test.ts",
        "platform.reports": "Backend/HBOS/test/ReportsEngine.test.ts",
        "platform.alerts": "Backend/HBOS/test/AlertsEngine.test.ts",
        "platform.production-readiness": "Backend/HBOS/test/ProductionReadinessEngine.test.ts",
        "platform.security-audit": "Backend/HBOS/test/SecurityAuditEngine.test.ts",
        "platform.performance-testing": "Backend/HBOS/test/PerformanceTestingEngine.test.ts",
        "platform.customer-testing": "Backend/HBOS/test/CustomerTestingEngine.test.ts",
        "platform.deployment-readiness": "Backend/HBOS/test/DeploymentReadinessEngine.test.ts",
        "platform.deployment-contract": "Backend/HBOS/test/DeploymentContractEngine.test.ts"
    };
    return known[canonicalCapabilityId] || null;
}

export function productRoadmapPaths(root: string, capabilityId: string): string[] {
    const roadmapPath = join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json");
    if (!existsSync(roadmapPath)) return [];
    const canonicalCapabilityId = capabilityId.replace(/^(repair-)+/, "");
    try {
        const roadmap = JSON.parse(readFileSync(roadmapPath, "utf8")) as { capabilities?: Array<{ capabilityId?: string; implementationPath?: string; testPath?: string; documentationPath?: string }> };
        const capability = roadmap.capabilities?.find(item => item.capabilityId === canonicalCapabilityId);
        if (!capability) return [];
        return [capability.implementationPath, capability.testPath, capability.documentationPath].filter(Boolean).map(path => join(root, path!));
    } catch {
        return [];
    }
}

export function declaredArtifactPaths(root: string, capabilityId: string, targetEngine: string): string[] {
    const roadmapPaths = productRoadmapPaths(root, capabilityId);
    if (roadmapPaths.length > 0) return roadmapPaths;
    return [
        join(root, "Backend", "HBOS", "Engines", `${targetEngine.replace(/[^A-Za-z0-9]/g, "")}.ts`),
        join(root, "Backend", "HBOS", "test", `${targetEngine.replace(/[^A-Za-z0-9]/g, "")}.test.ts`),
        join(root, "Docs", "Engines", `${targetEngine.replace(/[^A-Za-z0-9]/g, "")}.md`)
    ];
}

function relativeStatusPaths(statusOutput: string, root: string): string[] {
    return statusOutput.split(/\r?\n/).map(line => line.slice(3).trim()).filter(Boolean).map(path => normalize(join(root, path)));
}

export function isDeclaredArtifactPath(candidate: string, declared: string): boolean {
    const candidateAbs = resolve(candidate);
    const declaredAbs = resolve(declared);
    if (candidateAbs === declaredAbs) return true;
    if (!existsSync(declaredAbs)) return false;
    return relative(declaredAbs, candidateAbs) !== "" && !relative(declaredAbs, candidateAbs).split(sep).includes("..") && !relative(declaredAbs, candidateAbs).startsWith(`..${sep}`);
}

export function unexpectedArtifactPaths(changedPaths: string[], allowedPaths: string[]): string[] {
    return changedPaths.filter(candidate => !allowedPaths.some(declared => isDeclaredArtifactPath(candidate, declared)));
}

export function evaluateBehavioralEvidence(root: string, capabilityId: string, jestPassed: boolean, jestOutput: string): { verified: boolean; source: "commercial-artifact-quality" | "test-output"; failures: string[] } {
    const canonicalCapabilityId = capabilityId.replace(/^(repair-)+/, "");
    if (canonicalCapabilityId.startsWith("product.")) {
        const paths = productRoadmapPaths(root, canonicalCapabilityId);
        if (paths.length >= 2) {
            const quality = new CommercialArtifactQualityAudit().auditCapability(
                root,
                canonicalCapabilityId,
                paths[0].slice(root.length + 1),
                paths[1].slice(root.length + 1)
            );
            return { verified: jestPassed && quality.complete, source: "commercial-artifact-quality", failures: quality.failures };
        }
    }
    return {
        verified: jestPassed && /(?:behavior|analy|calculat|evaluat|assess|transform|ingest|persist|authorize|decision|kpi|financial|variance|evidence|ready)/i.test(jestOutput),
        source: "test-output",
        failures: []
    };
}

function buildAgentPrompt(context: ConstructionContext): string {
    const requiredPaths = declaredArtifactPaths(process.cwd(), context.plan.capabilityId, context.plan.targetEngine);
    return [
        "You are the repository-native Python implementation worker inside HooshyarOS Autonomous Operations Engine.",
        "Read AGENTS.md, Docs/ARCHITECTURE.md, and Assistant/SYSTEM_PROMPT.md before changing code.",
        "The frozen platform architecture, its Engines, decision logic, lifecycle, governance and autonomous construction rules are authoritative inputs to this mission.",
        "Architecture Freeze V4 is authoritative; do not redesign or duplicate existing engines.",
        "Implement exactly ONE capability for this mission:",
        `Capability ID: ${context.plan.capabilityId}`,
        `Capability: ${context.plan.capability}`,
        `Target Engine: ${context.plan.targetEngine}`,
        `Dependencies: ${context.plan.dependencies.join(", ") || "none"}`,
        `Required artifact paths: ${requiredPaths.join(" ; ")}`,
        `Architecture rules: ${context.plan.architectureRules.join(" ; ") || "preserve existing rules"}`,
        `Directives: ${DEFAULT_DIRECTIVES.join(" ; ")}`,
        "For product capabilities, the required artifact paths above are the authoritative product boundary. Do not implement the capability by rewriting an existing engine unless one of those paths is that engine path.",
        "Use only repository-native Python construction. Do not invoke Copilot, Codex, Claude, or any cloud coding CLI.",
        "Reuse existing capabilities and engine boundaries; never invent business semantics that are absent from repository architecture or evidence.",
        "Produce a real repository change when the selected deterministic capability is missing."
    ].join("\n");
}

export function createLocalConstructionTools(root = process.cwd()): ConstructionTool[] {
    let verificationCount = 0;
    let builderTestsRequired = false;
    return [
        {
            name: "architecture",
            execute: (_stage, context) => ({ ok: Boolean(context.plan.capabilityId && context.plan.capability && context.plan.targetEngine), artifact: { approved: true, capabilityId: context.plan.capabilityId, targetEngine: context.plan.targetEngine, architectureRules: context.plan.architectureRules, directives: DEFAULT_DIRECTIVES, requiredPaths: declaredArtifactPaths(root, context.plan.capabilityId, context.plan.targetEngine) } })
        },
        {
            name: "generator",
            execute: (stage, context) => {
                if (stage !== "GENERATE") return { ok: true };
                const before = run("git", REPOSITORY_STATUS_ARGS, root);
                if (!before.ok) return { ok: false, issue: "AUTONOMOUS_REPOSITORY_STATE_UNAVAILABLE", artifact: before };
                if (before.output.trim()) return { ok: false, issue: "AUTONOMOUS_WORKTREE_DIRTY", artifact: { clean: false, output: before.output } };
                const agent = resolveImplementationAgent(root);
                if (!agent) return { ok: false, issue: "AUTONOMOUS_AGENT_UNAVAILABLE", artifact: { provider: null, changed: false } };
                const requiredPaths = declaredArtifactPaths(root, context.plan.capabilityId, context.plan.targetEngine);
                const result = run(agent, buildAgentArgs(agent, context), root, 30 * 60 * 1000);
                const after = run("git", REPOSITORY_STATUS_ARGS, root);
                const changed = after.ok && repositoryStateChanged(before.output, after.output);
                const changedPaths = after.ok ? relativeStatusPaths(after.output, root) : [];
                const unexpectedPaths = unexpectedArtifactPaths(changedPaths, requiredPaths);
                const touchesDeclaredArtifact = changedPaths.some(path => requiredPaths.some(declared => isDeclaredArtifactPath(path, declared)));
                const artifact = { type: "AUTONOMOUS_AGENT_GENERATION_RESULT", provider: agent, capabilityId: context.plan.capabilityId, capability: context.plan.capability, targetEngine: context.plan.targetEngine, requiredPaths, changedPaths, unexpectedPaths, exitCode: result.code, changed, elapsedMs: result.elapsedMs, output: result.output, error: result.error, timestamp: new Date().toISOString() };
                console.log(JSON.stringify(artifact, null, 2));
                if (!result.ok) return { ok: false, issue: "AUTONOMOUS_AGENT_GENERATION_FAILED", artifact };
                if (!after.ok) return { ok: false, issue: "AUTONOMOUS_REPOSITORY_STATE_UNAVAILABLE", artifact };
                if (!changed) return { ok: false, issue: "AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE", artifact };
                if (!touchesDeclaredArtifact || unexpectedPaths.length > 0) return { ok: false, issue: "AUTONOMOUS_ARTIFACT_BOUNDARY_VIOLATION", artifact };
                return { ok: true, artifact };
            }
        },
        {
            name: "python",
            execute: (stage, context) => {
                if (stage !== "VERIFY") return { ok: true };
                verificationCount += 1;
                const focused = focusedTestFor(context.plan.capabilityId, root);
                const fullVerify = verificationCount % FULL_VERIFY_EVERY === 0 || process.env.HOOSHYAR_FULL_VERIFY === "1";
                const runBuilderTests = builderTestsRequired || verificationCount % BUILDER_TEST_EVERY === 0 || fullVerify || process.env.HOOSHYAR_BUILDER_VERIFY === "1";
                const syntax = run("python", ["-m", "compileall", "-q", "Backend/AI_Runtime"], root);
                if (!syntax.ok) return { ok: false, issue: "AUTONOMOUS_PYTHON_SYNTAX_VERIFY_FAILED", artifact: { syntaxVerified: false, elapsedMs: syntax.elapsedMs, output: syntax.output, error: syntax.error } };
                let bootstrap = { ok: true, installed: false, output: "pytest verification skipped", error: null as string | null };
                let builderTests = { ok: true, code: 0, output: "builder verification skipped", error: null as string | null, elapsedMs: 0 };
                if (runBuilderTests) {
                    bootstrap = ensurePytest(root);
                    if (!bootstrap.ok) {
                        builderTestsRequired = true;
                        return { ok: false, issue: "AUTONOMOUS_PYTEST_BOOTSTRAP_FAILED", artifact: { syntaxVerified: true, pytestBootstrapped: false, syntaxElapsedMs: syntax.elapsedMs, output: bootstrap.output, error: bootstrap.error } };
                    }
                    builderTests = run("python", ["-m", "pytest", "Backend/AI_Runtime/tests/test_autonomous_builder_platform.py", "Backend/AI_Runtime/tests/test_autonomous_spec.py"], root, 30 * 60 * 1000);
                    if (!builderTests.ok) builderTestsRequired = true;
                }
                let focusedResult = { ok: true, code: 0, output: "focused verification skipped", error: null as string | null, elapsedMs: 0 };
                if (focused && existsSync(join(root, focused))) focusedResult = run("npx", ["jest", "--runInBand", focused], root, 15 * 60 * 1000);
                else if (context.plan.capabilityId.startsWith("product.")) focusedResult = { ok: false, code: 1, output: `Missing focused test: ${focused ?? "unknown"}`, error: "missing_focused_test", elapsedMs: 0 };
                const full = fullVerify ? run("npm", ["test", "--", "--runInBand"], root, 45 * 60 * 1000) : { ok: true, code: 0, output: "full Jest verification skipped", error: null as string | null, elapsedMs: 0 };
                const passed = focusedResult.ok && builderTests.ok && full.ok;
                const behavioral = evaluateBehavioralEvidence(root, context.plan.capabilityId, passed, `${focusedResult.output}\n${builderTests.output}\n${full.output}`);
                const clean = run("git", REPOSITORY_STATUS_ARGS, root);
                const artifact = { testsPassed: passed, jestVerified: focusedResult.ok && full.ok, builderTestsVerified: builderTests.ok, behavioralEvidenceVerified: behavioral.verified, integrationVerified: fullVerify ? full.ok : focusedResult.ok, cleanRepository: clean.ok && !clean.output.trim(), focusedTest: focused, focusedOutput: focusedResult.output, builderOutput: builderTests.output, fullOutput: full.output, evidenceSource: behavioral.source, evidenceFailures: behavioral.failures, syntaxVerified: syntax.ok, pythonVerification: syntax.output, elapsedMs: syntax.elapsedMs + focusedResult.elapsedMs + builderTests.elapsedMs + full.elapsedMs };
                if (!clean.ok || !clean.output.trim()) return { ok: passed && behavioral.verified, artifact };
                return { ok: false, issue: "AUTONOMOUS_WORKTREE_NOT_CLEAN_AFTER_VERIFY", artifact };
            }
        },
        {
            name: "git",
            execute: (stage, context) => {
                const status = run("git", REPOSITORY_STATUS_ARGS, root);
                if (!status.ok) return { ok: false, issue: "AUTONOMOUS_GIT_STATE_UNAVAILABLE", artifact: status };
                if (stage === "FINALIZE") {
                    const expected = declaredArtifactPaths(root, context.plan.capabilityId, context.plan.targetEngine);
                    const changed = relativeStatusPaths(status.output, root);
                    const unexpected = unexpectedArtifactPaths(changed, expected);
                    if (unexpected.length > 0) return { ok: false, issue: "AUTONOMOUS_ARTIFACT_BOUNDARY_VIOLATION", artifact: { changedPaths: changed, requiredPaths: expected, unexpectedPaths: unexpected } };
                    const add = run("git", ["add", "-A"], root);
                    if (!add.ok) return { ok: false, issue: "GIT_ADD_FAILED", artifact: add };
                    const cached = run("git", ["diff", "--cached", "--quiet"], root);
                    if (cached.ok && cached.code === 0) return { ok: false, issue: "GIT_NO_REPOSITORY_CHANGE", artifact: { clean: true } };
                    const message = `feat(autonomous): construct ${context.plan.capabilityId}`;
                    const commit = run("git", ["commit", "-m", message], root);
                    if (!commit.ok) return { ok: false, issue: "GIT_COMMIT_FAILED", artifact: commit };
                    const branch = run("git", ["branch", "--show-current"], root);
                    if (!branch.ok || !branch.output.trim()) return { ok: false, issue: "GIT_BRANCH_UNAVAILABLE", artifact: branch };
                    const push = run("git", ["push", "origin", branch.output.trim()], root);
                    if (!push.ok) return { ok: false, issue: "GIT_PUSH_FAILED", artifact: push };
                    const clean = run("git", REPOSITORY_STATUS_ARGS, root);
                    return { ok: clean.ok && !clean.output.trim(), issue: clean.ok && !clean.output.trim() ? undefined : "GIT_REPOSITORY_NOT_CLEAN", artifact: { committed: true, pushed: true, clean: clean.ok && !clean.output.trim(), commit: commit.output, push: push.output } };
                }
                return { ok: true, artifact: { status: status.output } };
            }
        }
    ];
}
