import { execFileSync } from "node:child_process";
import { KiloCodeExecutionAdapter } from "./KiloCodeExecutionAdapter";

const STATUS_ARGS = ["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ":(exclude)node_modules"];

function repositoryStatus(root: string): string {
    return execFileSync("git", STATUS_ARGS, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
    }).trim();
}

export function buildWorkspaceRepairPrompt(root: string, status: string): string {
    return [
        "You are the HooshyarOS autonomous workspace repair operator.",
        "This is a pre-construction repair pass, not a new product capability.",
        "Inspect the repository and the current working-tree changes before acting.",
        "Read AGENTS.md, Docs/ARCHITECTURE.md and Assistant/SYSTEM_PROMPT.md.",
        "Restore the repository to a verified clean checkpoint without redesigning Architecture Freeze V4.",
        "Preserve committed repository content.",
        "Treat uncommitted changes as disposable only when they are clearly incomplete/generated autonomous construction artifacts; do not erase an unrelated user change merely because it is uncommitted.",
        "When a dirty path is a partial autonomous construction artifact, either complete it into a valid committed capability or remove/revert it so the workspace can return to a verified checkpoint.",
        "Do not create a new capability during this pass.",
        `Working tree status before repair:\n${status}`,
        `Repository root: ${root}`,
        "Finish only when the repository is internally consistent and clean; leave a concise execution summary in your normal Kilo output."
    ].join("\n");
}

export function repairWorkspace(root = process.cwd()): { ok: boolean; status: string; output: string; progressLogPath?: string } {
    const before = repositoryStatus(root);
    if (!before) {
        console.log(JSON.stringify({
            type: "AUTONOMOUS_WORKSPACE_REPAIR",
            phase: "PREFLIGHT",
            status: "ALREADY_CLEAN",
            timestamp: new Date().toISOString()
        }));
        return { ok: true, status: "clean", output: "" };
    }

    console.log(JSON.stringify({
        type: "AUTONOMOUS_WORKSPACE_REPAIR",
        phase: "START",
        status: "DIRTY",
        changedPaths: before.split(/\r?\n/).filter(Boolean),
        timestamp: new Date().toISOString()
    }));

    const adapter = new KiloCodeExecutionAdapter();
    const result = adapter.execute(buildWorkspaceRepairPrompt(root, before), root);
    const after = repositoryStatus(root);
    const ok = result.ok && after.length === 0;

    console.log(JSON.stringify({
        type: "AUTONOMOUS_WORKSPACE_REPAIR",
        phase: "END",
        status: ok ? "VERIFIED_CLEAN" : "BLOCKED",
        exitCode: result.code,
        repositoryClean: after.length === 0,
        remainingChanges: after.split(/\r?\n/).filter(Boolean),
        progressLogPath: result.progressLogPath,
        timestamp: new Date().toISOString()
    }));

    return {
        ok,
        status: ok ? "clean" : "blocked",
        output: result.output,
        progressLogPath: result.progressLogPath
    };
}

if (require.main === module) {
    const result = repairWorkspace();
    process.exitCode = result.ok ? 0 : 1;
}
