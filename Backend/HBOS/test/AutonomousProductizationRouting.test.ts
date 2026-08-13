import fs from "node:fs";
import path from "node:path";

describe("Autonomous productization routing", () => {
    const root = path.resolve(__dirname, "..", "..", "..");

    it("routes autonomous:assistant through the explicit productization entrypoint", () => {
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(root, "package.json"), "utf8"),
        );

        expect(packageJson.scripts["autonomous:assistant"]).toBe(
            "python Backend/AI_Runtime/autonomous_assistant.py",
        );
    });

    it("keeps productization completion separate from platform completion", () => {
        const worker = fs.readFileSync(
            path.join(root, "Backend", "AI_Runtime", "productization_worker.py"),
            "utf8",
        );

        expect(worker).toContain("AUTONOMOUS_PRODUCTIZATION_BLOCKED");
        expect(worker).toContain("AUTONOMOUS_PRODUCTIZATION_COMPLETE");
        expect(worker).toContain("AUTONOMOUS_PRODUCTIZATION_DELEGATE");
        expect(worker).toContain("AUTONOMOUS_PRODUCTIZATION_START");
        expect(worker).toContain("windows-installer-artifact-not-yet-built");
        expect(worker).toContain("android-project-incomplete");
        expect(worker).not.toContain("no supported Windows installer toolchain detected");
        expect(worker).not.toContain("no Android application project exists yet");
    });
});
