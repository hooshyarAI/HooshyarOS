import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { npmInvocation } from "../Autonomous/Product/AutonomousProductFactory";

interface LaunchOutcome {
    exitCode: number;
    signal: string | null;
    error: string | null;
}

interface QualificationModule {
    launchNpm(args: string[], stdio?: string): LaunchOutcome;
    steps: Array<[string, string[]]>;
}

interface RunnerModule {
    normalizeCommand(command: string, args: string[]): { command: string; args: string[] };
}

function assertSpawnable(invocation: { command: string; args: string[] }): void {
    const result = spawnSync(invocation.command, invocation.args, { stdio: "pipe", shell: false, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
}

/**
 * Node refuses to spawn a `.cmd`/`.bat` file with `shell: false` on Windows and
 * reports EINVAL before the child starts. Every canonical launcher in this
 * repository must therefore resolve a spawnable npm invocation on the host it
 * runs on. These tests launch the real subprocesses through the production
 * resolvers (no mocks). Importing the launcher modules also proves they no longer
 * execute or exit at load time.
 */
describe("Windows npm launcher normalization", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const qualification = require(path.join(root, "scripts", "real-product-qualification.cjs")) as QualificationModule;
    const runner = require(path.join(root, "scripts", "autonomous-ci-repair-runner.cjs")) as RunnerModule;
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

    it("resolves a spawnable invocation for the canonical product qualification wrapper", () => {
        const outcome = qualification.launchNpm(["--version"], "pipe");
        expect(outcome.error).toBeNull();
        expect(outcome.exitCode).toBe(0);
    });

    it("runs a real canonical npm script through the qualification wrapper launch path", () => {
        const outcome = qualification.launchNpm(["run", "product:assurance"], "pipe");
        expect(outcome.error).toBeNull();
        expect(outcome.exitCode).toBe(0);
    }, 120_000);

    it("resolves a spawnable invocation for the construction CI repair runner", () => {
        assertSpawnable(runner.normalizeCommand(npmCommand, ["--version"]));
    });

    it("normalizes only .cmd/.bat launchers and leaves native executables untouched", () => {
        const native = runner.normalizeCommand(process.execPath, ["--version"]);
        expect(native.command).toBe(process.execPath);
        assertSpawnable(native);

        const normalized = runner.normalizeCommand(npmCommand, ["--version"]);
        if (process.platform === "win32") {
            expect(/cmd\.exe$/i.test(normalized.command)).toBe(true);
            expect(normalized.args.slice(0, 3)).toEqual(["/d", "/s", "/c"]);
            expect(normalized.args[3]).toContain("npm.cmd --version");
        } else {
            expect(normalized.command).toBe("npm.cmd");
        }
    });

    it("resolves a spawnable invocation for the canonical product factory contract", () => {
        assertSpawnable(npmInvocation(["--version"]));
    });

    it("fails closed on an empty product factory npm invocation", () => {
        expect(() => npmInvocation([])).toThrow(/PRODUCT_FACTORY_EMPTY_NPM_ARGS/);
    });

    it("binds the canonical qualification steps to scripts that package.json defines", () => {
        const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
            scripts?: Record<string, string>;
        };
        expect(qualification.steps.map(([label]) => label)).toEqual([
            "web-acceptance",
            "security-tenant-acceptance",
            "factory",
            "cline-evidence"
        ]);
        for (const [label, args] of qualification.steps) {
            expect(args[0]).toBe("run");
            expect(packageJson.scripts?.[args[1]]).toBeDefined();
        }
    });
});
