const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "final-product-factory.yml");
const ANDROID_RELEASE_WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "android-release.yml");
const ACCEPTANCE_SCRIPT_PATH = path.join(ROOT, "scripts", "android-product-acceptance.sh");
const EVIDENCE_SCRIPT_PATH = path.join(ROOT, "scripts", "android-acceptance-evidence.cjs");

describe("android product acceptance CI repair regression", () => {
    test("workflow emulator options exclude -no-snapshot to allow snapshot-based boot", () => {
        const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
        expect(workflow).toContain("emulator-options:");
        expect(workflow).not.toContain("-no-snapshot");
    });

    test("Android release workflow uses bounded, deterministic emulator setup", () => {
        const workflow = fs.readFileSync(ANDROID_RELEASE_WORKFLOW_PATH, "utf8");
        expect(workflow).toContain("timeout-minutes: 30");
        // These exact settings passed the previous Android release verification run.
        expect(workflow).toContain("force-avd-creation: true");
        expect(workflow).toContain("disable-animations: false");
        expect(workflow).toContain("emulator-options: -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim");
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

    test("ADB wait and device probes are bounded before the finite boot loop", () => {
        const script = fs.readFileSync(ACCEPTANCE_SCRIPT_PATH, "utf8");
        expect(script).toContain('timeout 5s "$ADB" wait-for-device');
        expect(script).toContain('timeout 2s "$ADB" get-state');
        expect(script).toContain('timeout 2s "$ADB" shell getprop sys.boot_completed');
        expect(script).toContain('for i in $(seq 1 90)');
        expect(script).toContain('attempt ${i}/90: state=');
        expect(script).toContain('test "$boot" = "1"');
        expect(script).not.toContain('test "$(get_boot)" = "1"');
        expect(script).toContain('test "$state" = "device"');
        expect(script).not.toContain('test "$(get_state)" = "device"');
        expect(script).not.toMatch(/\n\s*"\$ADB" wait-for-device\s*\n/);
    });

    test("Package Manager readiness is recorded from the successful bounded probe without a duplicate timeout probe", () => {
        const script = fs.readFileSync(ACCEPTANCE_SCRIPT_PATH, "utf8");
        expect(script).toContain("PACKAGE_MANAGER_READY=false");
        expect(script).toContain("PACKAGE_MANAGER_READY=true");
        expect(script).toContain('test "$PACKAGE_MANAGER_READY" = "true"');
        expect(script).not.toContain('timeout 3s "$ADB" shell cmd package list packages >/dev/null\nrecord_step package-manager-ready');
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
