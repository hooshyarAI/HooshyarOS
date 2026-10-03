import { mkdirSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SecurityAuditEngine, SecurityAuditResult, SecurityFinding } from "../Engines/SecurityAuditEngine";

describe("SecurityAuditEngine Phase 10-1.2 - Real Security Evidence Boundary", () => {
    const engine = new SecurityAuditEngine();

    function createTempRepo(): string {
        const root = mkdtempSync(join(tmpdir(), "sec-audit-10-1.2-"));
        // Seed minimal required artifacts
        writeFileSync(join(root, ".gitignore"), ".env\nnode_modules/\n", "utf8");
        writeFileSync(join(root, "AGENTS.md"), "# AGENTS\nSecurity governance is permanent.\n", "utf8");
        mkdirSync(join(root, "Docs"), { recursive: true });
        mkdirSync(join(root, "Assistant"), { recursive: true });
        writeFileSync(join(root, "Docs/AI_RULES.md"), "# AI Rules\n", "utf8");
        writeFileSync(join(root, "Assistant/SYSTEM_PROMPT.md"), "System prompt with sufficient content for testing purposes. This system prompt contains governance instructions, security policies, and operational guidelines to ensure proper autonomous construction behavior throughout the HooshyarOS platform lifecycle as defined by the master charter and architecture freeze V4.", "utf8");
        mkdirSync(join(root, "Backend/HBOS/Engines"), { recursive: true });
        writeFileSync(join(root, "Backend/HBOS/Engines/SecurityLayerEngine.ts"), "export class SecurityLayerEngine {}\n", "utf8");
        // AI_Runtime directory with autonomous_builder.py
        mkdirSync(join(root, "Backend/AI_Runtime"), { recursive: true });
        writeFileSync(join(root, "Backend/AI_Runtime/autonomous_builder.py"), "# autonomous builder\n", "utf8");
        return root;
    }

    afterEach(() => {
        // cleanup is per-test via finally blocks
    });

    describe("scan(root) returns findings", () => {
        it("returns empty findings for a clean repository", () => {
            const root = createTempRepo();
            try {
                const findings = engine.scan(root);
                expect(findings).toEqual([]);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("detects missing required artifacts", () => {
            const root = join(tmpdir(), `sec-audit-missing-${Date.now()}`);
            mkdirSync(root, { recursive: true });
            try {
                const findings = engine.scan(root);
                expect(findings.some(f => f.category === "ARTIFACT")).toBe(true);
                const missing = findings.filter(f => f.category === "ARTIFACT");
                expect(missing.length).toBeGreaterThan(0);
                expect(missing[0].severity).toBe("HIGH");
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("detects forbidden secret files in root", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, ".env"), "SECRET=abc123\n", "utf8");
                const findings = engine.scan(root);
                const secretFindings = findings.filter(f => f.category === "SECRET" && f.file === ".env");
                expect(secretFindings.length).toBe(1);
                expect(secretFindings[0].severity).toBe("CRITICAL");
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });
    });

    describe("secret content scanning", () => {
        it("detects private key blocks in source files", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, "Backend/HBOS/Engines/key.ts"), "const KEY = `-----BEGIN RSA PRIVATE KEY-----\\nMIIE...\\n-----END RSA PRIVATE KEY-----`;\n", "utf8");
                const findings = engine.scan(root);
                const keyFindings = findings.filter(f => f.category === "SECRET" && f.description.includes("Private key block"));
                expect(keyFindings.length).toBe(1);
                expect(keyFindings[0].severity).toBe("CRITICAL");
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("detects GitHub tokens", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, "config.py"), "token = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890AB'\n", "utf8");
                const findings = engine.scan(root);
                expect(findings.some(f => f.description === "GitHub token detected in file")).toBe(true);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("detects AWS access keys", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, "secrets.py"), "aws_key = 'AKIAIOSFODNN7EXAMPLE'\n", "utf8");
                const findings = engine.scan(root);
                expect(findings.some(f => f.description === "AWS access key detected in file")).toBe(true);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("detects Slack tokens", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, "config.js"), "SLACK_TOKEN = 'xoxb-1234567890-abcdefghij-klmnopqrst';\n", "utf8");
                const findings = engine.scan(root);
                expect(findings.some(f => f.description === "Slack token detected in file")).toBe(true);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("does not flag legitimate code as secrets", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, "app.js"), "const api_endpoint = 'https://api.example.com';\nconst debug = false;\n", "utf8");
                const findings = engine.scan(root);
                // Should not have any secret findings for this file
                const fileFindings = findings.filter(f => f.file === "app.js" && f.category === "SECRET");
                expect(fileFindings).toEqual([]);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });
    });

    describe("configuration audit", () => {
        it("detects .gitignore missing .env exclusion", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, ".gitignore"), "node_modules/\nbuild/\n", "utf8");
                const findings = engine.scan(root);
                expect(findings.some(f => f.id === "CONFIG_GITIGNORE_NO_ENV")).toBe(true);
                const finding = findings.find(f => f.id === "CONFIG_GITIGNORE_NO_ENV");
                expect(finding?.severity).toBe("MEDIUM");
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("detects AGENTS.md missing security reference", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, "AGENTS.md"), "# Agent Instructions\nJust do stuff.\n", "utf8");
                const findings = engine.scan(root);
                expect(findings.some(f => f.id === "CONFIG_AGENTS_NO_SECURITY")).toBe(true);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });
    });

    describe("dependency audit", () => {
        it("detects cloud-provider artifacts in AI_Runtime", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, "Backend/AI_Runtime/claude_adapter.py"), "# claude integration\n", "utf8");
                const findings = engine.scan(root);
                expect(findings.some(f => f.category === "DEPENDENCY" && f.id === "CLOUD_PROVIDER_claude")).toBe(true);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("detects openai artifacts in AI_Runtime", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, "Backend/AI_Runtime/openai_wrapper.py"), "# openai wrapper\n", "utf8");
                const findings = engine.scan(root);
                expect(findings.some(f => f.category === "DEPENDENCY" && f.id === "CLOUD_PROVIDER_openai")).toBe(true);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });
    });

    describe("findings structure", () => {
        it("each finding has id, category, severity, file, description, and remediation", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, ".env"), "KEY=value\n", "utf8");
                const findings = engine.scan(root);
                const finding = findings.find(f => f.file === ".env");
                expect(finding).toBeDefined();
                expect(finding?.id).toBeDefined();
                expect(finding?.category).toBe("SECRET");
                expect(finding?.severity).toBeDefined();
                expect(finding?.file).toBe(".env");
                expect(finding?.description).toBeDefined();
                expect(finding?.remediation).toBeDefined();
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });
    });

    describe("backward compatibility: audit(root)", () => {
        it("audit returns secure when scan finds no issues", () => {
            const root = createTempRepo();
            try {
                const result = engine.audit(root);
                expect(result.secure).toBe(true);
                expect(result.missingArtifacts).toEqual([]);
                expect(result.forbiddenArtifacts).toEqual([]);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("audit returns findings field with detailed results", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, ".env"), "SECRET=test\n", "utf8");
                const result = engine.audit(root);
                expect(result.secure).toBe(false);
                expect(result.findings.length).toBeGreaterThan(0);
                expect(result.findingCount).toBeGreaterThan(0);
                expect(result.scannedAt).toBeDefined();
                expect(result.rootPath).toBe(root);
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("audit maps missing artifacts correctly", () => {
            const root = join(tmpdir(), `sec-audit-artifacts-${Date.now()}`);
            mkdirSync(root, { recursive: true });
            try {
                const result = engine.audit(root);
                expect(result.secure).toBe(false);
                expect(result.missingArtifacts).toContain(".gitignore");
                expect(result.missingArtifacts).toContain("AGENTS.md");
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });

        it("audit maps forbidden artifacts correctly", () => {
            const root = createTempRepo();
            try {
                writeFileSync(join(root, ".env.local"), "API_KEY=sk-1234567890123456789012345678901234567890\n", "utf8");
                const result = engine.audit(root);
                expect(result.secure).toBe(false);
                expect(result.forbiddenArtifacts).toContain(".env.local");
            } finally {
                rmSync(root, { recursive: true, force: true });
            }
        });
    });

    describe("audit on current repository", () => {
        it("reports the current repository as secure", () => {
            const result = engine.audit(process.cwd());
            expect(result.secure).toBe(true);
            expect(result.missingArtifacts).toEqual([]);
            expect(result.forbiddenArtifacts).toEqual([]);
        });
    });
});




