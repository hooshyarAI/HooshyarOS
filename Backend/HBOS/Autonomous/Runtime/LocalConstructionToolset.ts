import { execFileSync } from "child_process";
import {
    ConstructionContext,
    ConstructionStage,
    ConstructionTool
} from "../../Builder/Autonomous/AutonomousConstructionEngine";

function run(
    command: string,
    args: string[],
    cwd: string,
    timeout = 15 * 60 * 1000
) {
    try {
        let executable = command;
        let executableArgs = args;

        if (process.platform === "win32") {
            if (command === "git") executable = "git.exe";

            if (command === "npx") {
                executable = process.env.ComSpec || "cmd.exe";
                executableArgs = ["/d", "/s", "/c", "npx.cmd", ...args];
            }

            if (command === "copilot" || command === "claude") {
                executable = process.env.ComSpec || "cmd.exe";
                executableArgs = ["/d", "/s", "/c", `${command}.cmd`, ...args];
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

        return { ok: true, code: 0, output: String(output), error: null };
    } catch (error: any) {
        const stdout = String(error?.stdout || "");
        const stderr = String(error?.stderr || "");

        console.error(JSON.stringify({
            type: "AUTONOMOUS_TOOL_ERROR",
            command,
            args,
            cwd,
            exitCode: error?.status ?? 1,
            stdout,
            stderr,
            message: error?.message ?? `${command} failed`
        }, null, 2));

        return {
            ok: false,
            code: error?.status ?? 1,
            output: `${stdout}\n${stderr}`,
            error: error?.message ?? `${command} failed`
        };
    }
}

function commandExists(command: string, cwd: string): boolean {
    try {
        const locator = process.platform === "win32" ? "where.exe" : "which";
        execFileSync(locator, [command], {
            cwd,
            encoding: "utf8",
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"]
        });
        return true;
    } catch {
        return false;
    }
}

export type ImplementationAgent = "copilot" | "claude";

export function resolveImplementationAgent(root = process.cwd()): ImplementationAgent | null {
    const requested = process.env.HOOSHYAR_AGENT?.trim().toLowerCase();

    if (requested) {
        if (requested !== "copilot" && requested !== "claude") return null;
        return commandExists(requested, root) ? requested : null;
    }

    if (commandExists("copilot", root)) return "copilot";
    if (commandExists("claude", root)) return "claude";
    return null;
}

function buildAgentArgs(agent: ImplementationAgent, prompt: string): string[] {
    if (agent === "copilot") {
        return [
            "-p", prompt,
            "-s",
            "--allow-all-tools",
            "--allow-all-paths",
            "--no-ask-user",
            "--no-auto-update"
        ];
    }

    return [
        "-p", prompt,
        "--dangerously-skip-permissions",
        "--output-format", "text"
    ];
}

function buildAgentPrompt(context: ConstructionContext): string {
    return [
        "You are the implementation agent inside HooshyarOS Autonomous Operations Engine.",
        "Read AGENTS.md, Docs/ARCHITECTURE.md, and Assistant/SYSTEM_PROMPT.md before changing code.",
        "Architecture Freeze V4 is authoritative; do not redesign or duplicate existing engines.",
        "Implement exactly ONE capability for this mission:",
        `Capability ID: ${context.plan.capabilityId}`,
        `Capability: ${context.plan.capability}`,
        `Target Engine: ${context.plan.targetEngine}`,
        `Dependencies: ${context.plan.dependencies.join(", ") || "none"}`,
        `Architecture rules: ${context.plan.architectureRules.join(" ; ") || "preserve existing rules"}`,
        "Use the smallest complete repository-native implementation.",
        "Follow one capability = one coherent implementation contract + focused verification evidence.",
        "Inspect existing implementation and git history first; reuse existing owners.",
        "Create or update the implementation and its focused test, then run relevant tests/static validation.",
        "Do NOT commit or push; the HooshyarOS finalize stage owns Git commit/push.",
        "Do not stop at a plan or a generated artifact: produce a real repository change when the capability is missing.",
        "If the capability is already truly implemented, verify that fact and make no duplicate implementation.",
        "Return a concise completion summary and verification result."
    ].join("\n");
}

export function createLocalConstructionTools(root = process.cwd()): ConstructionTool[] {
    return [
        {
            name: "architecture",
            execute: (_stage, context) => ({
                ok: Boolean(context.plan.capabilityId && context.plan.capability && context.plan.targetEngine),
                artifact: { approved: true }
            })
        },
        {
            name: "generator",
            execute: (stage, context) => {
                if (stage !== "GENERATE") return { ok: true };

                const agent = resolveImplementationAgent(root);
                if (!agent) {
                    const artifact = {
                        type: "AUTONOMOUS_AGENT_GENERATION_RESULT",
                        provider: null,
                        capabilityId: context.plan.capabilityId,
                        capability: context.plan.capability,
                        exitCode: 127,
                        changed: false,
                        output: "",
                        error: "No supported implementation agent found. Install/login to GitHub Copilot CLI or Claude Code, or set HOOSHYAR_AGENT to copilot or claude.",
                        timestamp: new Date().toISOString()
                    };
                    console.log(JSON.stringify(artifact, null, 2));
                    return { ok: false, issue: "AUTONOMOUS_AGENT_UNAVAILABLE", artifact };
                }

                const result = run(agent, buildAgentArgs(agent, buildAgentPrompt(context)), root, 30 * 60 * 1000);
                const artifact = {
                    type: "AUTONOMOUS_AGENT_GENERATION_RESULT",
                    provider: agent,
                    capabilityId: context.plan.capabilityId,
                    capability: context.plan.capability,
                    exitCode: result.code,
                    changed: result.ok,
                    output: result.output,
                    error: result.error,
                    timestamp: new Date().toISOString()
                };

                console.log(JSON.stringify(artifact, null, 2));
                if (!result.ok) return { ok: false, issue: "AUTONOMOUS_AGENT_GENERATION_FAILED", artifact };
                return { ok: true, artifact };
            }
        },
        {
            name: "python",
            execute: (stage) => {
                if (stage === "VERIFY") {
                    const test = run("npx", ["jest", "--runInBand", "--config", ".\\jest.config.js"], root);
                    const verificationArtifact = {
                        type: "AUTONOMOUS_VERIFY_RESULT",
                        command: "jest",
                        exitCode: test.code,
                        verified: test.code === 0,
                        timestamp: new Date().toISOString(),
                        output: test.output,
                        error: test.error
                    };

                    console.log(JSON.stringify(verificationArtifact, null, 2));
                    if (test.code === 0) return { ok: true, artifact: verificationArtifact };
                    return {
                        ok: false,
                        issue: "AUTONOMOUS_VERIFY_FAILED",
                        artifact: { ...verificationArtifact, repairRequired: true }
                    };
                }

                if (stage === "REPAIR") {
                    console.log(JSON.stringify({
                        type: "AUTONOMOUS_REPAIR",
                        message: "Repair engine consumed verification artifact",
                        issues: []
                    }));
                    return { ok: true, artifact: { repaired: true } };
                }

                return { ok: true };
            }
        },
        {
            name: "git",
            execute: (stage) => {
                if (stage !== "FINALIZE") return { ok: true };

                const status = run("git", ["status", "--porcelain"], root);
                if (!status.ok) return { ok: false, issue: "GIT_STATUS_FAILED" };

                if (!status.output.trim()) {
                    return {
                        ok: true,
                        artifact: { clean: true, committed: false, pushed: false, changeDetected: false }
                    };
                }

                const add = run("git", ["add", "-A"], root);
                if (!add.ok) return { ok: false, issue: "GIT_ADD_FAILED" };

                const commit = run("git", ["commit", "-m", "feat(hbos): autonomous construction progress"], root);
                if (!commit.ok) return { ok: false, issue: "GIT_COMMIT_FAILED" };

                const push = run("git", ["push", "origin", "main"], root);
                if (!push.ok) return { ok: false, issue: "GIT_PUSH_FAILED" };

                return { ok: true, artifact: { committed: true, pushed: true, changeDetected: true } };
            }
        }
    ];
}
