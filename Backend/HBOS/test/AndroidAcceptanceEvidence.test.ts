import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * The Android product acceptance evidence artifact is consumed by
 * `scripts/cline-runtime-evidence-collector.cjs` to mark the `android-release`
 * qualification cell. It must be produced by the harness that performs the real
 * device checks, never hand-authored by a CI workflow. These tests exercise the
 * real evidence owner (and, where bash is available, the real harness) with real
 * subprocesses and a real filesystem.
 */

const root = resolve(__dirname, "../../..");
const helper = join(root, "scripts", "android-acceptance-evidence.cjs");
const harness = "scripts/android-product-acceptance.sh";

/** Contract expected by the qualification collector; asserted independently. */
const EXPECTED_STEPS = [
    "apk-present",
    "device-online",
    "android-booted",
    "package-manager-ready",
    "apk-installed",
    "launcher-start",
    "process-alive",
    "main-activity-visible",
];

const tempDirs: string[] = [];

function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "hooshyar-android-evidence-"));
    tempDirs.push(dir);
    return dir;
}

function runHelper(args: string[], evidenceFile: string): string {
    return execFileSync(process.execPath, [helper, ...args], {
        cwd: root,
        env: { ...process.env, HOOSHYAR_ANDROID_EVIDENCE_PATH: evidenceFile },
        encoding: "utf8",
    });
}

function runHelperFailure(args: string[], evidenceFile: string): { status: number; output: string } {
    try {
        runHelper(args, evidenceFile);
    } catch (error) {
        const failure = error as { status?: number; stdout?: string; stderr?: string };
        if (typeof failure.status === "number") {
            return { status: failure.status, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
        }
        throw error;
    }
    throw new Error(`expected helper command to fail: ${args.join(" ")}`);
}

function readEvidence(file: string): Record<string, unknown> {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

function gitHead(): string {
    return execFileSync(process.platform === "win32" ? "git.exe" : "git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
    }).trim();
}

function resolveBash(): string | null {
    const candidates: string[] = [];
    if (process.env.BASH) candidates.push(process.env.BASH);
    candidates.push("bash");
    if (process.platform === "win32") {
        candidates.push("C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files\\Git\\usr\\bin\\bash.exe");
    }
    for (const candidate of candidates) {
        try {
            execFileSync(candidate, ["--version"], { stdio: "ignore" });
            return candidate;
        } catch {
            /* try the next candidate */
        }
    }
    return null;
}

const bashPath = resolveBash();
const integrationIt = bashPath ? it : it.skip;

afterAll(() => {
    for (const dir of tempDirs) {
        try {
            rmSync(dir, { recursive: true, force: true });
        } catch {
            /* temp cleanup is best-effort */
        }
    }
});

describe("Android acceptance evidence owner", () => {
    it("begins a commit-bound IN_PROGRESS artifact with no claimed verification", () => {
        const evidenceFile = join(tempDir(), "android-acceptance-success.json");
        runHelper(["begin"], evidenceFile);

        const record = readEvidence(evidenceFile);
        expect(record.type).toBe("ANDROID_PRODUCT_ACCEPTANCE_SUCCESS");
        expect(record.status).toBe("IN_PROGRESS");
        expect(record.acceptance).toEqual([]);
        expect(record.commit).toBe(gitHead());
    });

    it("records only real verification steps and rejects unknown ones", () => {
        const evidenceFile = join(tempDir(), "android-acceptance-success.json");
        runHelper(["begin"], evidenceFile);
        runHelper(["record", "device-online"], evidenceFile);
        expect(readEvidence(evidenceFile).acceptance).toEqual(["device-online"]);

        const failure = runHelperFailure(["record", "totally-made-up-step"], evidenceFile);
        expect(failure.status).not.toBe(0);
        expect(failure.output).toContain("ANDROID_ACCEPTANCE_UNKNOWN_STEP");
        expect(readEvidence(evidenceFile).acceptance).toEqual(["device-online"]);
    });

    it("refuses to complete until every real device step was recorded", () => {
        const evidenceFile = join(tempDir(), "android-acceptance-success.json");
        runHelper(["begin"], evidenceFile);
        for (const step of EXPECTED_STEPS.slice(0, -1)) {
            runHelper(["record", step], evidenceFile);
        }

        const failure = runHelperFailure(["complete"], evidenceFile);
        expect(failure.status).not.toBe(0);
        expect(failure.output).toContain("ANDROID_ACCEPTANCE_EVIDENCE_INCOMPLETE");
        expect(readEvidence(evidenceFile).status).not.toBe("PASS");

        const verification = runHelperFailure(["verify"], evidenceFile);
        expect(verification.status).not.toBe(0);
        expect(verification.output).toContain("ANDROID_ACCEPTANCE_EVIDENCE_INVALID");
    });

    it("produces a PASS artifact listing exactly the recorded steps", () => {
        const evidenceFile = join(tempDir(), "android-acceptance-success.json");
        runHelper(["begin"], evidenceFile);
        for (const step of EXPECTED_STEPS) {
            runHelper(["record", step], evidenceFile);
        }
        runHelper(["complete"], evidenceFile);

        const record = readEvidence(evidenceFile);
        expect(record.status).toBe("PASS");
        expect(record.acceptance).toEqual(EXPECTED_STEPS);
        expect(() => runHelper(["verify"], evidenceFile)).not.toThrow();
    });

    it("clears a previous PASS on a new run so a failure cannot inherit it", () => {
        const evidenceFile = join(tempDir(), "android-acceptance-success.json");
        runHelper(["begin"], evidenceFile);
        for (const step of EXPECTED_STEPS) {
            runHelper(["record", step], evidenceFile);
        }
        runHelper(["complete"], evidenceFile);
        expect(readEvidence(evidenceFile).status).toBe("PASS");

        runHelper(["begin"], evidenceFile);
        const restarted = readEvidence(evidenceFile);
        expect(restarted.status).toBe("IN_PROGRESS");
        expect(restarted.acceptance).toEqual([]);

        const verification = runHelperFailure(["verify"], evidenceFile);
        expect(verification.status).not.toBe(0);
    });

    it("removes the artifact on failure and refuses to verify a missing artifact", () => {
        const evidenceFile = join(tempDir(), "android-acceptance-success.json");
        runHelper(["begin"], evidenceFile);
        for (const step of EXPECTED_STEPS) {
            runHelper(["record", step], evidenceFile);
        }
        runHelper(["complete"], evidenceFile);

        runHelper(["fail", "ANDROID_ACCEPTANCE_FAILED:exit=1"], evidenceFile);
        expect(() => readFileSync(evidenceFile, "utf8")).toThrow();

        const verification = runHelperFailure(["verify"], evidenceFile);
        expect(verification.status).not.toBe(0);
        expect(verification.output).toContain("ANDROID_ACCEPTANCE_EVIDENCE_MISSING");
    });
});

describe("Android acceptance harness evidence ownership", () => {
    integrationIt("produces its own PASS evidence through the real canonical harness", () => {
        const dir = tempDir();
        const apk = join(dir, "app-debug.apk");
        writeFileSync(apk, "fake-apk-bytes");
        const evidenceFile = join(dir, "android-acceptance-success.json");
        const fakeAdb = join(dir, "fake-adb.sh");
        writeFileSync(fakeAdb, [
            "#!/usr/bin/env bash",
            "case \"$1\" in",
            "  wait-for-device) exit 0 ;;",
            "  get-state) echo device; exit 0 ;;",
            "  install) exit 0 ;;",
            "  logcat) exit 0 ;;",
            "  shell)",
            "    shift",
            "    case \"$1\" in",
            "      getprop) echo 1 ;;",
            "      cmd) exit 0 ;;",
            "      am) exit 0 ;;",
            "      pidof) echo 4242 ;;",
            "      dumpsys)",
            "        shift",
            "        if [ \"$1\" = \"activity\" ] && [ \"$2\" = \"activities\" ]; then",
            "          echo \"mResumedActivity: ai.hooshyar.client/.MainActivity\"",
            "        fi",
            "        exit 0 ;;",
            "    esac",
            "    exit 0 ;;",
            "esac",
            "exit 0",
            "",
        ].join("\n"), "utf8");

        const posix = (value: string) => value.replace(/\\/g, "/");
        execFileSync(bashPath as string, ["-c", `chmod +x "${posix(fakeAdb)}"`], { stdio: "ignore" });

        execFileSync(bashPath as string, [harness], {
            cwd: root,
            encoding: "utf8",
            timeout: 120000,
            env: {
                ...process.env,
                ADB: posix(fakeAdb),
                APK: posix(apk),
                NODE: posix(process.execPath),
                HOOSHYAR_ANDROID_EVIDENCE_PATH: posix(evidenceFile),
            },
        });

        const record = readEvidence(evidenceFile);
        expect(record.type).toBe("ANDROID_PRODUCT_ACCEPTANCE_SUCCESS");
        expect(record.status).toBe("PASS");
        expect(record.acceptance).toEqual(EXPECTED_STEPS);
        expect(record.commit).toBe(gitHead());
    });
});
