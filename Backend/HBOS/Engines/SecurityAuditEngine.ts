import { existsSync, readdirSync, readFileSync, Dirent } from "node:fs";
import { join } from "node:path";
import { Engine } from "../Core/Engine";

export type SecurityFindingCategory =
    | "SECRET"
    | "CONFIG"
    | "DEPENDENCY"
    | "TENANT_BOUNDARY"
    | "ENCRYPTION"
    | "ARTIFACT";

export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityFinding {
    readonly id: string;
    readonly category: SecurityFindingCategory;
    readonly severity: SecuritySeverity;
    readonly file: string;
    readonly line?: number;
    readonly description: string;
    readonly remediation: string;
}

export interface SecurityAuditResult {
    secure: boolean;
    missingArtifacts: string[];
    forbiddenArtifacts: string[];
    readonly findings: SecurityFinding[];
    readonly scannedAt: string;
    readonly rootPath: string;
    readonly findingCount: number;
}

const SECRET_ENV_FILES = [".env", ".env.local", ".env.production", ".env.development"];
const SECRET_KEY_FILES = ["id_rsa", "id_ed25519", "id_ecdsa", "id_dsa", ".private", ".htpasswd"];
const CLOUD_PROVIDER_PATTERNS = ["copilot", "codex", "claude", "openai", "anthropic"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".venv", ".cache", "build", "coverage"]);
const SCAN_EXTENSIONS = new Set([".ts", ".js", ".cjs", ".py", ".json", ".yaml", ".yml", ".env", ".txt", ".toml", ".cfg"]);

const PRIVATE_KEY_REGEX = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const SECRET_FILE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
    { name: "GitHub token", pattern: /ghp_[a-zA-Z0-9]{36}/ },
    { name: "Slack token", pattern: /xox[baprs]-[a-zA-Z0-9-]+/ },
    { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
    { name: "AWS secret key", pattern: /aws_secret_access_key\s*=\s*['"][A-Za-z0-9/+=]{40}['"]/ },
    { name: "Generic API key", pattern: /["']?api[_-]?key["']?\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/ },
    { name: "Generic secret", pattern: /["']?secret["']?\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/ },
    { name: "Private key block", pattern: PRIVATE_KEY_REGEX }
];

/** Repository-native production security evidence boundary. */
export class SecurityAuditEngine implements Engine {
    name = "SecurityAuditEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    scan(root: string = process.cwd()): SecurityFinding[] {
        const findings: SecurityFinding[] = [];

        // 1. Required artifact check
        const required = [
            ".gitignore",
            "AGENTS.md",
            "Docs/AI_RULES.md",
            "Assistant/SYSTEM_PROMPT.md",
            "Backend/HBOS/Engines/SecurityLayerEngine.ts"
        ];
        for (const artifact of required) {
            if (!existsSync(join(root, artifact))) {
                findings.push({
                    id: `ARTIFACT_MISSING_${artifact}`,
                    category: "ARTIFACT",
                    severity: "HIGH",
                    file: artifact,
                    description: `Required security artifact is missing: ${artifact}`,
                    remediation: `Ensure ${artifact} exists in the repository root`
                });
            }
        }

        // 2. Forbidden artifact check
        for (const forbidden of [...SECRET_ENV_FILES, ...SECRET_KEY_FILES]) {
            if (existsSync(join(root, forbidden))) {
                findings.push({
                    id: `FORBIDDEN_ARTIFACT_${forbidden}`,
                    category: "SECRET",
                    severity: "CRITICAL",
                    file: forbidden,
                    description: `Forbidden secret-bearing artifact found in repository root: ${forbidden}`,
                    remediation: `Remove ${forbidden} and move secrets to a managed secrets provider`
                });
            }
        }

        // 3. Cloud provider / external coding agent check in AI_Runtime
        const autonomousPath = join(root, "Backend", "AI_Runtime", "autonomous_builder.py");
        const autonomousDirectory = join(root, "Backend", "AI_Runtime");
        if (existsSync(autonomousPath) && existsSync(autonomousDirectory)) {
            const files = readdirSync(autonomousDirectory, { withFileTypes: true })
                .filter(entry => entry.isFile())
                .map(entry => String(entry.name).toLowerCase());
            for (const artifact of CLOUD_PROVIDER_PATTERNS) {
                if (files.some(file => file.includes(artifact))) {
                    findings.push({
                        id: `CLOUD_PROVIDER_${artifact}`,
                        category: "DEPENDENCY",
                        severity: "HIGH",
                        file: `Backend/AI_Runtime/${artifact}`,
                        description: `Cloud-provider artifact detected in autonomous runtime: ${artifact}`,
                        remediation: "Remove cloud-provider dependencies from the autonomous construction runtime"
                    });
                }
            }
        }

        // 4. Recursive secret content scan
        findings.push(...this.scanFileContents(root));

        // 5. Configuration audit
        findings.push(...this.auditConfiguration(root));

        // Deduplicate findings by id
        const seen = new Set<string>();
        const unique: SecurityFinding[] = [];
        for (const f of findings) {
            if (!seen.has(f.id)) {
                seen.add(f.id);
                unique.push(f);
            }
        }
        return unique;
    }

    private scanFileContents(root: string): SecurityFinding[] {
        const findings: SecurityFinding[] = [];
        const visited = new Set<string>();

        const walk = (dir: string): void => {
            const resolved = join(root, dir);
            if (visited.has(resolved)) return;
            visited.add(resolved);

            let entries: Array<Dirent>;
            try {
                entries = readdirSync(resolved, { withFileTypes: true }) as Array<Dirent>;
            } catch {
                return;
            }

            for (const entry of entries) {
                const entryName = String(entry.name);

                if (entry.isDirectory()) {
                    if (SKIP_DIRS.has(entryName)) continue;
                    walk(join(dir, entryName));
                    continue;
                }
                if (!entry.isFile()) continue;

                if (!SCAN_EXTENSIONS.has(this.getFileExtension(entryName))) continue;
                if (entryName.startsWith(".env")) continue;

                const fullPath = join(root, dir, entryName);
                const relativePath = this.toPosixPath(join(dir, entryName));
                // Skip test files — they contain intentional test fixtures
                if (relativePath.includes("/test/") || relativePath.includes("\\test\\")) continue;

                let content: string;
                try {
                    content = readFileSync(fullPath, "utf8");
                } catch {
                    continue;
                }

                for (const { name, pattern } of SECRET_FILE_PATTERNS) {
                    const lines = content.split("\n");
                    for (let i = 0; i < lines.length; i++) {
                        if (pattern.test(lines[i])) {
                            findings.push({
                                id: `SECRET_${name}_${relativePath}_${i + 1}`,
                                category: "SECRET",
                                severity: name === "Private key block" ? "CRITICAL" : "HIGH",
                                file: relativePath,
                                line: i + 1,
                                description: `${name} detected in file`,
                                remediation: "Remove the secret from source code and rotate the credential immediately"
                            });
                        }
                    }
                }
            }
        };

        walk(".");
        return findings;
    }

    private auditConfiguration(root: string): SecurityFinding[] {
        const findings: SecurityFinding[] = [];

        // Verify .gitignore excludes .env
        const gitignorePath = join(root, ".gitignore");
        if (existsSync(gitignorePath)) {
            const gitignore = readFileSync(gitignorePath, "utf8");
            if (!/\.env/.test(gitignore)) {
                findings.push({
                    id: "CONFIG_GITIGNORE_NO_ENV",
                    category: "CONFIG",
                    severity: "MEDIUM",
                    file: ".gitignore",
                    description: ".gitignore does not exclude .env files",
                    remediation: "Add .env to .gitignore to prevent secret leakage"
                });
            }
        }

        // Verify AGENTS.md mentions security
        const agentsPath = join(root, "AGENTS.md");
        if (existsSync(agentsPath)) {
            const agents = readFileSync(agentsPath, "utf8");
            if (!/security/i.test(agents)) {
                findings.push({
                    id: "CONFIG_AGENTS_NO_SECURITY",
                    category: "CONFIG",
                    severity: "LOW",
                    file: "AGENTS.md",
                    description: "AGENTS.md does not reference security governance",
                    remediation: "Ensure AGENTS.md documents security as a permanent governing concern"
                });
            }
        }

        // Verify SYSTEM_PROMPT.md has substantial content
        const systemPromptPath = join(root, "Assistant", "SYSTEM_PROMPT.md");
        if (existsSync(systemPromptPath)) {
            const content = readFileSync(systemPromptPath, "utf8");
            if (content.trim().length < 100) {
                findings.push({
                    id: "CONFIG_SYSTEM_PROMPT_INCOMPLETE",
                    category: "CONFIG",
                    severity: "LOW",
                    file: "Assistant/SYSTEM_PROMPT.md",
                    description: "SYSTEM_PROMPT.md is suspiciously short",
                    remediation: "Ensure the system prompt contains complete governance instructions"
                });
            }
        }

        return findings;
    }

    audit(root = process.cwd()): SecurityAuditResult {
        const findings = this.scan(root);
        const missingArtifacts = findings
            .filter(f => f.category === "ARTIFACT")
            .map(f => f.file);
        const forbiddenArtifacts = findings
            .filter(f => f.category === "SECRET" && f.severity === "CRITICAL" && (f.file.startsWith(".") || SECRET_KEY_FILES.includes(f.file)))
            .map(f => f.id.replace(/^FORBIDDEN_ARTIFACT_/, ""));

        return {
            secure: findings.length === 0,
            missingArtifacts,
            forbiddenArtifacts,
            findings,
            scannedAt: new Date().toISOString(),
            rootPath: root,
            findingCount: findings.length
        };
    }

    private getFileExtension(filename: string): string {
        const dot = filename.lastIndexOf(".");
        return dot > 0 ? filename.slice(dot) : "";
    }

    private toPosixPath(path: string): string {
        return path.replace(/\\/g, "/");
    }
}




