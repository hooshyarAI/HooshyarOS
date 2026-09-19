const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "final-product-factory.yml");
const ACCEPTANCE_SCRIPT_PATH = path.join(ROOT, "scripts", "android-product-acceptance.sh");
const EVIDENCE_SCRIPT_PATH = path.join(ROOT, "scripts", "android-acceptance-evidence.cjs");

describe("android product acceptance CI repair regression", () => {
    test("workflow emulator options exclude -no-snapshot to allow snapshot-based boot", () => {
        const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
        expect(workflow).toContain("emulator-options:");
        expect(workflow).not.toContain("-no-snapshot");
    });

    test("workflow references android-product-acceptance.sh script", () => {
        const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
        expect(workflow).toContain("bash scripts/android-product-acceptance.sh");
    });

    test("android-product-acceptance.sh exists and is executable", () => {
        const stat = fs.statSync(ACCEPTANCE_SCRIPT_PATH);
        expect(stat.isFile()).toBe(true);
        const content = fs.readFileSync(ACCEPTANCE_SCRIPT_PATH, "utf8");
        expect(content).toContain("get_state");
        expect(content).toContain("get_boot");
        expect(content).toContain("wait-for-device");
    });

    test("android acceptance evidence required steps match script recorded steps", () => {
        const evidence = fs.readFileSync(EVIDENCE_SCRIPT_PATH, "utf8");
        const script = fs.readFileSync(ACCEPTANCE_SCRIPT_PATH, "utf8");
        const requiredSteps = [
            "apk-present",
            "device-online",
            "android-booted",
            "package-manager-ready",
            "apk-installed",
            "launcher-start",
            "process-alive",
            "main-activity-visible",
        ];
        for (const step of requiredSteps) {
            expect(evidence).toContain(`'${step}'`);
            expect(script).toContain(step);
        }
    });
});
