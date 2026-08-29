/// <reference types="node" />
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import { ConstructionContext, ConstructionTool } from "../../Builder/Autonomous/AutonomousConstructionEngine";
import { KiloCodeExecutionAdapter } from "./KiloCodeExecutionAdapter";
import { ensurePytest } from "./PythonVerificationBootstrap";

function run(command: string, args: string[], cwd: string, timeout = 15 * 60 * 1000) {
    const started = Date.now();
    try {
        let executable = command;
        let executableArgs = args;
        let useShell = false;
        if (process.platform === "win32") {
            if (command === "git") executable = "git.exe";
            if (command === "npx") {
                executable = process.env.ComSpec || "cmd.exe";
                executableArgs = ["/d", "/s", "/c", "npx.cmd", ...args];
            }
        }
        const output = execFileSync(executable, executableArgs, {
            cwd,
            encoding: "utf8",
            timeout,
            shell: useShell,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"]
        });
        return { ok: true, code: 0, output: String(output), error: null, elapsedMs: Date.now() - started };
    } catch (error: any) {
        const stdout = String(error?.stdout || "");
        const stderr = String(error?.stderr || "");
        const exitCode = error?.status ?? 1;
        const expectedGitDiffQuiet = command === "git"
            && args[0] === "diff"
            && args[1] === "--cached"
            && args[2] === "--quiet"
            && exitCode === 1;
        if (expectedGitDiffQuiet) {
            return { ok: true, code: 1, output: `${stdout}${stderr}`, error: null, elapsedMs: Date.now() - started };
        }
        console.error(JSON.stringify({
            type: "AUTONOMOUS_TOOL_ERROR",
            command,
            args,
            cwd,
            exitCode,
            stdout,
            stderr,
            elapsedMs: Date.now() - started,
            message: error?.message ?? `${command} failed`
        }, null, 2));
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

export type ImplementationAgent = "kilo" | "python";

export function selectImplementationAgent(
    requested: string | undefined,
    kiloAvailable: boolean,
    pythonAvailable: boolean
): ImplementationAgent | null {
    const normalized = requested?.trim().toLowerCase() || "auto";
    if (normalized === "kilo") return kiloAvailable ? "kilo" : pythonAvailable ? "python" : null;
    if (normalized === "python") return pythonAvailable ? "python" : null;
    if (normalized !== "auto") return null;
    if (kiloAvailable) return "kilo";
    if (pythonAvailable) return "python";
    return null;
}

export function resolveImplementationAgent(root = process.cwd()): ImplementationAgent | null {
    return selectImplementationAgent(
        process.env.HOOSHYAR_AGENT,
        commandExists("kilo", root),
        commandExists("python", root)
    );
}

export function repositoryStateChanged(before: string, after: string): boolean {
    return before.trim() !== after.trim();
}

export function buildAgentArgs(agent: ImplementationAgent, prompt: string): string[] {
    if (agent === "kilo") return ["run", "--auto", prompt];
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

function focusedTestFor(capabilityId: string): string | null {
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
    return known[capabilityId] || null;
}

export function productRoadmapPaths(root: string, capabilityId: string): string[] {
    const roadmapPath = join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json");
    if (!existsSync(roadmapPath)) return [];
    const canonicalCapabilityId = capabilityId.startsWith("repair-")
        ? capabilityId.slice("repair-".length)
        : capabilityId;
    try {
        const roadmap = JSON.parse(readFileSync(roadmapPath, "utf8")) as {
            capabilities?: Array<{ capabilityId?: string; implementationPath?: string; testPath?: string; documentationPath?: string }>;
        };
        const capability = roadmap.capabilities?.find(item => item.capabilityId === canonicalCapabilityId);
        if (!capability) return [];
        return [capability.implementationPath, capability.testPath, capability.documentationPath]
            .filter(Boolean)
            .map(path => join(root, path!));
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
    return statusOutput.split(/\r?\n/)
        .map(line => line.slice(3).trim())
        .filter(Boolean)
        .map(path => normalize(join(root, path)));
}

function buildAgentPrompt(context: ConstructionContext): string {
    const requiredPaths = declaredArtifactPaths(process.cwd(), context.plan.capabilityId, context.plan.targetEngine);
    return [
        "You are an approved execution operator inside HooshyarOS Autonomous Operations Engine.",
        "Read AGENTS.md, Docs/ARCHITECTURE.md, Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md, and Assistant/SYSTEM_PROMPT.md before changing code.",
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
        "Use only approved repository-local operators. Do not invoke Copilot, Codex, Claude, or another unapproved coding agent.",
        "Reuse existing capabilities and engine boundaries; never invent business semantics that are absent from repository architecture or evidence.",
        "Produce a real repository change when the selected deterministic capability is missing."
    ].join("\n");
}

export function createLocalConstructionTools(root = process.cwd()): ConstructionTool[] {
    let verificationCount = 0;
    const kiloOperator = new KiloCodeExecutionAdapter();
    return [
        {
            name: "architecture",
            execute: (_stage, context) => ({
                ok: Boolean(context.plan.capabilityId && context.plan.capability && context.plan.targetEngine),
                artifact: {
                    approved: true,
                    capabilityId: context.plan.capabilityId,
                    targetEngine: context.plan.targetEngine,
                    architectureRules: context.plan.architectureRules,
                    directives: DEFAULT_DIRECTIVES,
                    requiredPaths: declaredArtifactPaths(root, context.plan.capabilityId, context.plan.targetEngine)
                }
            })
        },
        {
            name: "generator",
            execute: (stage, context) => {
                if (stage !== "GENERATE") return { ok: true };
                const before = run("git", REPOSITORY_STATUS_ARGS, root);
                if (!before.ok) return { ok: false, issue: "AUTONOMOUS_REPOSITORY_STATE_UNAVAILABLE", artifact: before };
                if (before.output.trim()) return { ok: false, issue: "AUTONOMOUS_WORKTREE_DIRTY", artifact: { clean: false, output: before.output } };

                const requested = process.env.HOOSHYAR_AGENT?.trim().toLowerCase() || "auto";
                const primaryAgent = resolveImplementationAgent(root);
                const candidates: ImplementationAgent[] = primaryAgent === "kilo"
                    ? ["kilo"]
                    : primaryAgent === "python"
                        ? ["python"]
                        : [];
                if (requested !== "auto" && !["kilo", "python"].includes(requested)) {
                    return { ok: false, issue: "AUTONOMOUS_AGENT_REQUEST_INVALID", artifact: { requested } };
                }
                if (candidates.length === 0) {
                    return { ok: false, issue: "AUTONOMOUS_AGENT_UNAVAILABLE", artifact: { providersTried: [], changed: false } };
                }

                const requiredPaths = declaredArtifactPaths(root, context.plan.capabilityId, context.plan.targetEngine);
                const allowed = requiredPaths.map(path => normalize(path));
                const attempts: unknown[] = [];

                for (const agent of candidates) {
                    const prompt = buildAgentPrompt(context);
                    const result = agent === "kilo"
                        ? kiloOperator.execute(prompt, root)
                        : run(agent, buildAgentArgs(agent, prompt), root, 30 * 60 * 1000);
                    const after = run("git", REPOSITORY_STATUS_ARGS, root);
                    const changed = after.ok && repositoryStateChanged(before.output, after.output);
                    const changedPaths = after.ok ? relativeStatusPaths(after.output, root) : [];
                    const unexpectedPaths = changedPaths.filter(path => !allowed.includes(path));
                    const touchesDeclaredArtifact = changedPaths.some(path => allowed.includes(path));
                    const artifact = {
                        type: "AUTONOMOUS_AGENT_GENERATION_RESULT",
                        provider: agent,
                        capabilityId: context.plan.capabilityId,
                        capability: context.plan.capability,
                        targetEngine: context.plan.targetEngine,
                        requiredPaths,
                        changedPaths,
                        unexpectedPaths,
                        exitCode: result.code,
                        changed,
                        elapsedMs: result.elapsedMs,
                        output: result.output,
                        error: result.error,
                        timestamp: new Date().toISOString()
                    };
                    attempts.push(artifact);
                    console.log(JSON.stringify(artifact, null, 2));

                    if (!after.ok) return { ok: false, issue: "AUTONOMOUS_REPOSITORY_STATE_UNAVAILABLE", artifact: { attempts } };
                    if (unexpectedPaths.length > 0) {
                        return { ok: false, issue: "AUTONOMOUS_ARTIFACT_BOUNDARY_VIOLATION", artifact: { attempts } };
                    }
                    if (result.ok && changed && touchesDeclaredArtifact) {
                        return { ok: true, artifact: { ...artifact, fallbackUsed: false } };
                    }
                    if (changed) {
                        return { ok: false, issue: "AUTONOMOUS_AGENT_PARTIAL_CHANGE_REQUIRES_REPAIR", artifact: { attempts } };
                    }
                    if (!result.ok) return { ok: false, issue: "AUTONOMOUS_AGENT_GENERATION_FAILED", artifact: { attempts } };
                    return { ok: false, issue: "AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE", artifact: { attempts } };
                }

                return { ok: false, issue: "AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE", artifact: { attempts } };
            }
        },
        {
            name: "python",
            execute: (stage, context) => {
                if (stage !== "VERIFY") return { ok: true };
                verificationCount += 1;
                const focused = focusedTestFor(context.plan.capabilityId);
                const fullVerify = verificationCount % FULL_VERIFY_EVERY === 0 || process.env.HOOSHYAR_FULL_VERIFY === "1";
                const runBuilderTests = verificationCount % BUILDER_TEST_EVERY === 0 || fullVerify || process.env.HOOSHYAR_BUILDER_VERIFY === "1";
                const syntax = run("python", ["-m", "compileall", "-q", "Backend/AI_Runtime"], root);
                if (!syntax.ok) return { ok: false, issue: "AUTONOMOUS_PYTHON_SYNTAX_VERIFY_FAILED", artifact: { syntaxVerified: false, elapsedMs: syntax.elapsedMs, output: syntax.output, error: syntax.error } };
                let bootstrap = { ok: true, installed: false, output: "pytest verification skipped", error: null as string | null };
                let builderTests = { ok: true, code: 0, output: "builder verification skipped", error: null as string | null, elapsedMs: 0 };
                if (runBuilderTests) {
                    bootstrap = ensurePytest(root);
                    if (!bootstrap.ok) return { ok: false, issue: "AUTONOMOUS_PYTEST_BOOTSTRAP_FAILED", artifact: { syntaxVerified: true, pytestBootstrapped: false, syntaxElapsedMs: syntax.elapsedMs, output: bootstrap.output, error: bootstrap.error } };
                    builderTests = run("python", ["-m", "pytest", "Backend/AI_Runtime/tests/test_autonomous_builder_platform.py", "Backend/AI_Runtime/tests/test_autonomous_spec.py", "-q"], root);
                    if (!builderTests.ok) return { ok: false, issue: "AUTONOMOUS_BUILDER_TESTS_FAILED", artifact: { syntaxVerified: true, pytestBootstrapped: true, builderTestsVerified: false, syntaxElapsedMs: syntax.elapsedMs, builderTestsElapsedMs: builderTests.elapsedMs, output: builderTests.output, error: builderTests.error } };
                }
                const jestArgs = ["./node_modules/jest/bin/jest.js", "--config", "./jest.config.js", "--maxWorkers=50%"];
                if (!fullVerify && focused) jestArgs.push(focused);
                const jest = run("node", jestArgs, root);
                const artifact = {
                    type: "AUTONOMOUS_VERIFY_RESULT",
                    verificationMode: fullVerify ? "full" : focused ? "focused" : "syntax+autonomous-tests",
                    focusedTest: focused,
                    fullVerify,
                    fullVerifyEvery: FULL_VERIFY_EVERY,
                    builderTestsRun: runBuilderTests,
                    builderTestEvery: BUILDER_TEST_EVERY,
                    syntaxVerified: true,
                    pytestBootstrapped: bootstrap.installed,
                    builderTestsVerified: runBuilderTests && builderTests.code === 0,
                    jestVerified: jest.code === 0,
                    verified: jest.code === 0,
                    syntaxElapsedMs: syntax.elapsedMs,
                    builderTestsElapsedMs: builderTests.elapsedMs,
                    jestElapsedMs: jest.elapsedMs,
                    totalVerifyElapsedMs: syntax.elapsedMs + builderTests.elapsedMs + jest.elapsedMs,
                    timestamp: new Date().toISOString(),
                    output: `${syntax.output}\n${bootstrap.output}\n${builderTests.output}\n${jest.output}`,
                    error: jest.error
                };
                console.log(JSON.stringify(artifact, null, 2));
                return jest.code === 0
                    ? { ok: true, artifact }
                    : { ok: false, issue: "AUTONOMOUS_VERIFY_FAILED", artifact: { ...artifact, repairRequired: true } };
            }
        },
        {
            name: "git",
            execute: (stage) => {
                if (stage !== "FINALIZE") return { ok: true };
                const status = run("git", REPOSITORY_STATUS_ARGS, root);
                if (!status.ok) return { ok: false, issue: "GIT_STATUS_FAILED", artifact: { output: status.output, error: status.error } };
                if (!status.output.trim()) return { ok: false, issue: "GIT_NO_REPOSITORY_CHANGE", artifact: { clean: true, committed: false, pushed: false, changeDetected: false } };
                const add = run("git", ["add", "-A"], root);
                if (!add.ok) return { ok: false, issue: "GIT_ADD_FAILED", artifact: { output: add.output, error: add.error } };
                const staged = run("git", ["diff", "--cached", "--quiet"], root);
                if (!staged.ok && staged.code !== 1) return { ok: false, issue: "GIT_STAGED_DIFF_CHECK_FAILED", artifact: { output: staged.output, error: staged.error } };
                if (staged.code === 0) return { ok: false, issue: "GIT_NO_STAGED_CHANGE", artifact: { clean: true, committed: false, pushed: false, changeDetected: false } };
                const commit = run("git", ["commit", "-m", "feat(hbos): autonomous construction progress"], root);
                if (!commit.ok) return { ok: false, issue: "GIT_COMMIT_FAILED", artifact: { output: commit.output, error: commit.error } };
                const branchResult = run("git", ["branch", "--show-current"], root);
                if (!branchResult.ok) return { ok: false, issue: "GIT_BRANCH_DETECTION_FAILED", artifact: { output: branchResult.output, error: branchResult.error } };
                const branch = branchResult.output.trim();
                if (!branch) return { ok: false, issue: "GIT_DETACHED_HEAD", artifact: { committed: true, pushed: false, changeDetected: true } };
                const fetch = run("git", ["fetch", "origin", branch], root);
                if (!fetch.ok) return { ok: false, issue: "GIT_FETCH_FAILED", artifact: { branch, output: fetch.output, error: fetch.error } };
                const remoteRef = `origin/${branch}`;
                const remoteExists = run("git", ["rev-parse", "--verify", remoteRef], root);
                if (remoteExists.ok) {
                    const remoteAncestor = run("git", ["merge-base", "--is-ancestor", remoteRef, "HEAD"], root);
                    if (!remoteAncestor.ok && remoteAncestor.code !== 1) return { ok: false, issue: "GIT_DIVERGENCE_CHECK_FAILED", artifact: { branch, output: remoteAncestor.output, error: remoteAncestor.error } };
                    if (remoteAncestor.code === 1) {
                        const rebase = run("git", ["rebase", remoteRef], root);
                        if (!rebase.ok) {
                            run("git", ["rebase", "--abort"], root);
                            return { ok: false, issue: "GIT_REBASE_CONFLICT", artifact: { branch, output: rebase.output, error: rebase.error } };
                        }
                    }
                }
                const push = run("git", ["push", "origin", branch], root);
                if (!push.ok) return { ok: false, issue: "GIT_PUSH_FAILED", artifact: { branch, output: push.output, error: push.error } };
                return { ok: true, artifact: { committed: true, pushed: true, branch, changeDetected: true } };
            }
        }
    ];
}
