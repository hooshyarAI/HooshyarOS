import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

describe("productization live monitor contract", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const monitor = path.join(root, "Backend", "AI_Runtime", "productization_monitor.py");

    it("exists and exposes stage-aware progress mapping", () => {
        expect(fs.existsSync(monitor)).toBe(true);
        const source = fs.readFileSync(monitor, "utf8");
        expect(source).toContain("BUILD_VERIFY");
        expect(source).toContain("WINDOWS");
        expect(source).toContain("ANDROID");
        expect(source).toContain("AUTONOMOUS_PRODUCTIZATION_COMPLETE");
        expect(source).toContain("PROGRESS :");
        expect(source).toContain("CURRENT  :");
        expect(source).toContain("ELAPSED  :");
    });

    it("is syntactically valid Python", () => {
        execFileSync(process.platform === "win32" ? "python.exe" : "python3", ["-m", "py_compile", monitor], { cwd: root });
    });
});
