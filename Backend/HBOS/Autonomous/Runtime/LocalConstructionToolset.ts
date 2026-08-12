/// <reference types="node" />
import { execFileSync } from "child_process";
import { ConstructionContext, ConstructionTool } from "../../Builder/Autonomous/AutonomousConstructionEngine";
import { ensurePytest } from "./PythonVerificationBootstrap";

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

        const output = execFileSync(executable, executableArgs, {
            cwd,
            encoding: "utf8",
            timeout,
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"]
        });

        return { ok: true, code: 0, output: String(output), error: null, elapsedMs: Date.now() - started };
    } catch (error: any) {
        const stdout = String(error?.stdout || "");
        const stderr = String(error?.stderr || "");
        const elapsedMs = Date.now() - started;
        console.error(JSON.stringify({ type: "AUTONOMOUS_TOOL_ERROR", command, args, cwd, exitCode: error?.status ?? 1, stdout, stderr, elapsedMs, message: error?.message ?? `${command} failed` }, null, 2));
        return { ok: false, code: error?.status ?? 1, output: `${stdout}\n${stderr}`, error: error?.message ?? `${command} failed`, elapsedMs };
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
    "Run focused verification for the selected knot; run the full Jest suite only at the periodic integration checkpoint.",
    "Repair verification failures before finalization.",
    "Do not redesign Architecture Freeze V4."
];

const REPOSITORY_STATUS_ARGS = ["status", "--porcelain=v1", "--", ".", ":(exclude)node_modules"];
const FULL_VERIFY_EVERY = Math.max(1, Number.parseInt(process.env.HOOSHYAR_FULL_VERIFY_EVERY || "5", 10) || 5);

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

function buildAgentPrompt(context: ConstructionContext): string {
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
        `Architecture rules: ${context.plan.architectureRules.join(" ; ") || "preserve existing rules"}`,
        `Directives: ${DEFAULT_DIRECTIVES.join(" ; ")}`,
        "Use only repository-native Python construction. Do not invoke Copilot, Codex, Claude, or any cloud coding CLI.",
        "Reuse existing capabilities and engine boundaries; never invent business semantics that are absent from repository architecture or evidence.",
        "Produce a real repository change when the selected deterministic capability is missing."
    ].join("\n");
}

export function createLocalConstructionTools(root = process.cwd()): ConstructionTool[] {
    let verificationCount = 0;

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
                    directives: DEFAULT_DIRECTIVES
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

                const agent = resolveImplementationAgent(root);
                if (!agent) return { ok: false, issue: "AUTONOMOUS_AGENT_UNAVAILABLE", artifact: { provider: null, changed: false } };
                const result = run(agent, buildAgentArgs(agent, buildAgentPrompt(context)), root, 30 * 60 * 1000);
                const after = run("git", REPOSITORY_STATUS_ARGS, root);
                const changed = after.ok && repositoryStateChanged(before.output, after.output);
                const artifact = { type: "AUTONOMOUS_AGENT_GENERATION_RESULT", provider: agent, capabilityId: context.plan.capabilityId, capability: context.plan.capability, exitCode: result.code, changed, elapsedMs: result.elapsedMs, output: result.output, error: result.error, timestamp: new Date().toISOString() };
                console.log(JSON.stringify(artifact, null, 2));
                if (!result.ok) return { ok: false, issue: "AUTONOMOUS_AGENT_GENERATION_FAILED", artifact };
                if (!after.ok) return { ok: false, issue: "AUTONOMOUS_REPOSITORY_STATE_UNAVAILABLE", artifact };
                if (!changed) return { ok: false, issue: "AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE", artifact };
                return { ok: true, artifact };
            }
        },
        {
            name: "python",
            execute: (stage, context) => {
                if (stage === "VERIFY") {
                    verificationCount += 1;
                    const focused = focusedTestFor(context.plan.capabilityId);
                    const fullVerify = verificationCount % FULL_VERIFY_EVERY === 0 || process.env.HOOSHYAR_FULL_VERIFY === "1";
                    const syntax = run("python", ["-m", "compileall", "-q", "Backend/AI_Runtime"], root);
                    if (!syntax.ok) return { ok: false, issue: "AUTONOMOUS_PYTHON_SYNTAX_VERIFY_FAILED", artifact: { syntaxVerified: false, elapsedMs: syntax.elapsedMs, output: syntax.output, error: syntax.error } };

                    const bootstrap = ensurePytest(root);
                    if (!bootstrap.ok) {
                        return {
                            ok: false,
                            issue: "AUTONOMOUS_PYTEST_BOOTSTRAP_FAILED",
                            artifact: {
                                syntaxVerified: true,
                                pytestBootstrapped: false,
                                syntaxElapsedMs: syntax.elapsedMs,
                                output: bootstrap.output,
                                error: bootstrap.error
                            }
                        };
                    }

                    const builderTests = run("python", ["-m", "pytest", "Backend/AI_Runtime/tests/test_autonomous_builder_platform.py", "Backend/AI_Runtime/tests/test_autonomous_spec.py", "-q"], root);
                    if (!builderTests.ok) return { ok: false, issue: "AUTONOMOUS_BUILDER_TESTS_FAILED", artifact: { syntaxVerified: true, pytestBootstrapped: true, builderTestsVerified: false, syntaxElapsedMs: syntax.elapsedMs, builderTestsElapsedMs: builderTests.elapsedMs, output: builderTests.output, error: builderTests.error } };

                    const jestArgs = ["./node_modules/jest/bin/jest.js", "--config", "./jest.config.js", "--maxWorkers=50%"];
                    if (!fullVerify && focused) jestArgs.push(focused);
                    const jest = run("node", jestArgs, root);
                    const artifact = {
                        type: "AUTONOMOUS_VERIFY_RESULT",
                        verificationMode: fullVerify ? "full" : focused ? "focused" : "syntax+autonomous-tests",
                        focusedTest: focused,
                        fullVerify,
                        fullVerifyEvery: FULL_VERIFY_EVERY,
                        syntaxVerified: true,
                        pytestBootstrapped: bootstrap.installed,
                        builderTestsVerified: builderTests.code === 0,
                        jestVerified: jest.code === 0,
                        verified: jest.code === 0,
                        syntaxElapsedMs: syntax.elapsedMs,
                        builderTestsElapsedMs: builderTests.elapsedMs,
                        jestElapsedMs: jest.elapsedMs,
                        timestamp: new Date().toISOString(),
                        output: `${syntax.output}\n${bootstrap.output}\n${builderTests.output}\n${jest.output}`,
                        error: jest.error
                    };
                    console.log(JSON.stringify(artifact, null, 2));
                    return jest.code === 0 ? { ok: true, artifact } : { ok: false, issue: "AUTONOMOUS_VERIFY_FAILED", artifact: { ...artifact, repairRequired: true } };
                }

                if (stage === "REPAIR") {
                    const agent = resolveImplementationAgent(root);
                    if (!agent) return { ok: false, issue: "AUTONOMOUS_REPAIR_AGENT_UNAVAILABLE", artifact: { repaired: false, provider: null } };
                    const plan = context.artifacts.REPAIR_PLAN;
                    const issue = typeof plan === "object" && plan !== null && "issue" in plan ? String((plan as { issue?: unknown }).issue ?? "VERIFY_FAILED") : "VERIFY_FAILED";
                    const prompt = `${buildAgentPrompt(context)}\nRepair mode: regenerate only the deterministic artifacts owned by this capability.\nRepair issue: ${issue}`;
                    const result = run(agent, ["Backend/AI_Runtime/autonomous_builder.py", "--repair", "--prompt", prompt, "--issue", issue], root, 30 * 60 * 1000);
                    const changed = result.ok && result.output.includes("Repaired:");
                    const artifact = {
                        type: "AUTONOMOUS_REPAIR_RESULT",
                        provider: agent,
                        capabilityId: context.plan.capabilityId,
                        repaired: result.ok && changed,
                        exitCode: result.code,
                        elapsedMs: result.elapsedMs,
                        output: result.output,
                        error: result.error,
                        timestamp: new Date().toISOString()
                    };
                    console.log(JSON.stringify(artifact, null, 2));
                    return result.ok && changed
                        ? { ok: true, artifact }
                        : { ok: false, issue: "AUTONOMOUS_REPAIR_FAILED", artifact };
                }
                return { ok: true };
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
                const push = run("git", ["push", "origin", "main"], root);
                if (!push.ok) return { ok: false, issue: "GIT_PUSH_FAILED", artifact: { output: push.output, error: push.error } };
                return { ok: true, artifact: { committed: true, pushed: true, changeDetected: true } };
            }
        }
    ];
}
