import { execFileSync } from "node:child_process";
import { ConstructionContext, ConstructionStage, ConstructionTool } from "../../Builder/Autonomous/AutonomousConstructionEngine";

function run(command: string, args: string[], cwd: string, timeout = 15 * 60 * 1000): { ok: boolean; output: string; issue?: string } {
    try {
        const output = execFileSync(command, args, {
            cwd,
            encoding: "utf8",
            timeout,
            stdio: ["ignore", "pipe", "pipe"]
        });
        return { ok: true, output: String(output) };
    } catch (error: any) {
        return {
            ok: false,
            output: `${error?.stdout || ""}\n${error?.stderr || ""}`.trim(),
            issue: `${command} failed with exit code ${error?.status ?? "unknown"}`
        };
    }
}

/** Real local adapters used by the autonomous builder when it is running on the developer workstation. */
export function createLocalConstructionTools(root = process.cwd()): ConstructionTool[] {
    const prompt = (context: ConstructionContext, mode: "generate" | "repair") => [
        `You are the HooshyarOS autonomous construction agent. Mode: ${mode}.`,
        "Work directly in the current repository.",
        "Follow Architecture Freeze V4 and the final architecture already present in the repository.",
        "Inspect existing code before editing. Reuse capabilities and avoid duplicate engines.",
        "Implement the smallest complete next capability, add/repair tests, and run the relevant tests.",
        mode === "repair" ? "A previous verification failed. Diagnose the root cause and repair it, not just the symptom." : "",
        `Target engine: ${context.plan.targetEngine}`,
        `Capability: ${context.plan.capability}`,
        `Capability id: ${context.plan.capabilityId}`,
        `Architecture rules: ${context.plan.architectureRules.join("; ")}`,
        `Previous issues: ${context.issues.join("; ") || "none"}`,
        "Do not stop at analysis: make the code changes and verify them."
    ].filter(Boolean).join("\n");

    return [
        {
            name: "architecture",
            execute: (_stage: ConstructionStage, context: ConstructionContext) => ({
                ok: Boolean(context.plan.capabilityId && context.plan.capability && context.plan.targetEngine),
                artifact: { approved: true }
            })
        },
        {
            name: "codex",
            execute: (stage: ConstructionStage, context: ConstructionContext) => {
                if (stage !== "GENERATE" && stage !== "REPAIR") return { ok: true };
                const result = run("codex", ["exec", prompt(context, stage === "REPAIR" ? "repair" : "generate")], root);
                return result.ok
                    ? { ok: true, artifact: { tool: "codex", output: result.output.slice(-4000) } }
                    : { ok: false, issue: result.issue || "CODEX_EXEC_FAILED" };
            }
        },
        {
            name: "python",
            execute: (stage: ConstructionStage) => {
                if (stage !== "VERIFY") return { ok: true };
                const python = run("python", ["-m", "compileall", "-q", "Backend"], root, 5 * 60 * 1000);
                if (!python.ok) return { ok: false, issue: "PYTHON_COMPILE_FAILED" };
                const tests = run("npm", ["test", "--", "--runInBand"], root, 15 * 60 * 1000);
                return tests.ok
                    ? { ok: true, artifact: { python: "passed", jest: "passed" } }
                    : { ok: false, issue: "JEST_VERIFICATION_FAILED" };
            }
        },
        {
            name: "git",
            execute: (stage: ConstructionStage) => {
                if (stage !== "FINALIZE") return { ok: true };
                const status = run("git", ["status", "--porcelain"], root);
                if (!status.ok) return { ok: false, issue: "GIT_STATUS_FAILED" };
                if (!status.output.trim()) return { ok: true, artifact: { committed: false, reason: "clean" } };
                const add = run("git", ["add", "-A"], root);
                if (!add.ok) return { ok: false, issue: "GIT_ADD_FAILED" };
                const commit = run("git", ["commit", "-m", "feat(hbos): continue autonomous architecture-driven construction"], root);
                if (!commit.ok) return { ok: false, issue: "GIT_COMMIT_FAILED" };
                const push = run("git", ["push", "origin", "main"], root);
                return push.ok
                    ? { ok: true, artifact: { committed: true, pushed: true } }
                    : { ok: false, issue: "GIT_PUSH_FAILED" };
            }
        }
    ];
}
