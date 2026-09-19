import fs from "node:fs";
import path from "node:path";

interface LaunchOutcome {
    exitCode: number;
    signal: string | null;
    error: string | null;
}

interface HarnessModule {
    launchNpm(args: string[], stdio?: string): LaunchOutcome;
    runScript(name: string, stdio?: string): LaunchOutcome;
    checks: Array<[string, string]>;
    SCRIPT_NAMES: string[];
    evidencePath: string;
}

/**
 * The combined commercial application acceptance harness must be able to launch
 * the canonical `npm run` capability acceptance scripts on the host it runs on.
 * On Windows `spawnSync("npm.cmd", …, { shell: false })` reports EINVAL before the
 * child starts, so the harness recorded BLOCKED / exit 1 without ever running a
 * capability. These tests exercise the real subprocess launch path (no mocks).
 */
describe("Commercial application acceptance harness", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const harnessPath = path.join(root, "scripts", "commercial-application-acceptance.cjs");
    const harness = require(harnessPath) as HarnessModule;

    it("launches the npm CLI on this host instead of failing before the process starts", () => {
        const outcome = harness.launchNpm(["--version"], "pipe");
        expect(outcome.error).toBeNull();
        expect(outcome.exitCode).toBe(0);
    });

    it("runs a real canonical npm script through the same launch path", () => {
        const outcome = harness.launchNpm(["run", "product:assurance"], "pipe");
        expect(outcome.error).toBeNull();
        expect(outcome.exitCode).toBe(0);
    }, 120_000);

    it("surfaces a real child failure as an exit code rather than a launcher error", () => {
        const outcome = harness.launchNpm(["run", "__hooshyar_missing_acceptance_script__"], "pipe");
        expect(outcome.error).toBeNull();
        expect(outcome.exitCode).not.toBe(0);
    }, 120_000);

    it("fails closed on an unknown capability script", () => {
        expect(() => harness.runScript("product:does-not-exist", "pipe")).toThrow(/COMMERCIAL_ACCEPTANCE_UNKNOWN_SCRIPT/);
    });

    it("binds exactly the canonical capability acceptance scripts that package.json defines", () => {
        const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
            scripts?: Record<string, string>;
        };
        expect(harness.SCRIPT_NAMES).toEqual([
            "product:web:acceptance",
            "product:pdf:acceptance",
            "product:security:acceptance"
        ]);
        for (const name of harness.SCRIPT_NAMES) {
            expect(packageJson.scripts?.[name]).toBeDefined();
        }
        expect(harness.checks.map(([, capability]) => capability)).toEqual([
            "web-application",
            "pdf-acquisition",
            "security-application"
        ]);
    });

    it("does not execute the acceptance chain when it is merely imported", () => {
        const readEvidence = () =>
            fs.existsSync(harness.evidencePath) ? fs.readFileSync(harness.evidencePath, "utf8") : null;
        const before = readEvidence();
        delete require.cache[require.resolve(harnessPath)];
        const reloaded = require(harnessPath) as HarnessModule;
        expect(typeof reloaded.runScript).toBe("function");
        const after = readEvidence();
        expect(after).toBe(before);
    });
});
