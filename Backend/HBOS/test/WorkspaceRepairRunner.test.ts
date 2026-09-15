import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildWorkspaceRepairPrompt, repairWorkspace } from "../Autonomous/Runtime/WorkspaceRepairRunner";

describe("WorkspaceRepairRunner", () => {
    it("does not invoke repair work for an already clean repository", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-workspace-repair-"));
        try {
            execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
            const result = repairWorkspace(root);
            expect(result).toEqual({ ok: true, status: "clean", output: "" });
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("builds a fail-closed repair prompt from the observed dirty state", () => {
        const prompt = buildWorkspaceRepairPrompt("C:/repo", "?? partial-file.ts");
        expect(prompt).toContain("pre-construction repair pass");
        expect(prompt).toContain("?? partial-file.ts");
        expect(prompt).toContain("Do not create a new capability during this pass.");
        expect(prompt).toContain("Finish only when the repository is internally consistent and clean");
    });
});
