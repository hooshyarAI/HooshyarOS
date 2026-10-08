import { KiloCodeExecutionAdapter, kiloInvocation } from "./KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter", () => {
    it("builds the governed autonomous CLI invocation with the verified free model", () => {
        const invocation = kiloInvocation("win32", "Implement one capability");

        expect(invocation.args).toEqual(["run", "--agent", "hooshyar-construction", "--auto", "Implement one capability"]);
        expect(invocation.shell).toBe(false);
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain("kilo/kilo-auto/free");
        expect(invocation.env.KILO_CONFIG_CONTENT).not.toContain("gemini-3-pro-image");
        expect(invocation.env.HOOSHYAR_AGENT).toBe("kilo");
    });

    it("executes the Windows command without splitting the prompt", () => {
        const runner = jest.fn().mockReturnValue("KILO_ADAPTER_RUNTIME_OK");
        const adapter = new KiloCodeExecutionAdapter(runner as never);
        const prompt = "Do not modify files with spaces in this prompt";
        const result = adapter.execute(prompt, process.cwd(), 30_000);

        expect(result.ok).toBe(true);
        expect(result.observable).toBe(false);
        expect(runner).toHaveBeenCalledWith(
            expect.any(String),
            ["run", "--agent", "hooshyar-construction", "--auto", prompt],
            expect.objectContaining({
                shell: false,
                cwd: process.cwd(),
                env: expect.objectContaining({
                    HOOSHYAR_AGENT: "kilo",
                    KILO_CONFIG_CONTENT: expect.stringContaining("kilo/kilo-auto/free")
                })
            })
        );
    });

    it("reports availability from the executable lookup", () => {
        const runner = jest.fn().mockReturnValue(Buffer.from("kilo"));
        const adapter = new KiloCodeExecutionAdapter(runner as never);
        expect(adapter.isAvailable()).toBe(true);
        expect(runner).toHaveBeenCalledWith(
            process.platform === "win32" ? "where.exe" : "which",
            [process.platform === "win32" ? "kilo.exe" : "kilo"],
            expect.objectContaining({ stdio: ["ignore", "pipe", "ignore"] })
        );
    });

    it("fails closed when the kilo executable is unavailable", () => {
        const runner = jest.fn(() => { throw new Error("not found"); });
        const adapter = new KiloCodeExecutionAdapter(runner as never);
        expect(adapter.isAvailable()).toBe(false);
    });

    it("terminates a REAL Windows parent+child process tree on timeout and reports EXECUTION_TIMEOUT", () => {
        if (process.platform !== "win32") {
            return;
        }
        const fs = require("node:fs");
        const path = require("node:path");
        const os = require("node:os");
        const child_process = require("node:child_process");

        // Requirement 2: deterministic local launcher that spawns a REAL child.
        // The launcher is a real .cmd. When launched by the adapter it becomes the
        // process-tree root (innerPid). It spawns `ping -t` (a real, long-lived child)
        // and records the child PID, then waits forever so the timeout fires.
        const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hooshyar-kilo-real-"));
        const launcherPath = path.join(testRoot, "launcher.cmd");
        const childPidFile = path.join(testRoot, "child.pid");

        const launcher = [
            "@echo off",
            `powershell.exe -NoProfile -NonInteractive -Command "$c = Start-Process -FilePath 'ping.exe' -ArgumentList '-t','127.0.0.1' -PassThru -NoNewWindow; Set-Content -LiteralPath $env:HBOS_CHILD_PID_FILE -Value $c.Id -NoNewline; while ($true) { Start-Sleep -Seconds 1 }"`
        ].join("\r\n");
        fs.writeFileSync(launcherPath, launcher, "utf8");

        const originalEnv = process.env.HBOS_CHILD_PID_FILE;
        process.env.HBOS_CHILD_PID_FILE = childPidFile;

        // Only intercept `where.exe kilo.exe` so the adapter launches OUR real launcher.
        // spawnSync, taskkill and tasklist run for REAL (genuine process tree + termination).
        jest.resetModules();
        jest.doMock("node:child_process", () => {
            const actual = jest.requireActual("node:child_process");
            return {
                ...actual,
                execFileSync: jest.fn((cmd: string, args: any, opts: any) => {
                    const c = String(cmd).toLowerCase();
                    if (c.endsWith("where.exe") || c === "where") {
                        return Buffer.from(launcherPath + "\r\n");
                    }
                    return actual.execFileSync(cmd, args, opts);
                })
            };
        });

        // Requirement 13: verify survival by PID only, never by filename.
        const pidAlive = (pid: number): boolean => {
            try {
                const out = child_process.execFileSync(
                    "tasklist",
                    ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"],
                    { encoding: "utf8", windowsHide: true }
                );
                return out.split(/\r?\n/).some(l => l.replace(/"/g, "").includes(String(pid)));
            } catch {
                return false;
            }
        };

        const timeoutMs = 12000;
        let parentPid = -1;
        let childPid = -1;
        let result: any;

        try {
            const { KiloCodeExecutionAdapter } = require("./KiloCodeExecutionAdapter");
            const adapter = new KiloCodeExecutionAdapter();

            // Requirement 3-6: run the adapter with a short timeout against the real launcher.
            result = adapter.execute("Implement one capability", testRoot, timeoutMs);

            // Captured REAL parent PID (the adapter's tree root) and REAL child PID.
            const pidPath = path.join(path.dirname(result.progressLogPath), "kilo.pid");
            expect(fs.existsSync(pidPath)).toBe(true);
            parentPid = parseInt(fs.readFileSync(pidPath, "utf8").trim(), 10);
            expect(Number.isInteger(parentPid)).toBe(true);

            expect(fs.existsSync(childPidFile)).toBe(true);
            childPid = parseInt(fs.readFileSync(childPidFile, "utf8").trim(), 10);
            expect(Number.isInteger(childPid)).toBe(true);

            // Requirement 7: timeout result code = 124.
            expect(result.code).toBe(124);
            expect(result.error).toBe("Kilo execution timed out and its process tree was terminated");
            expect(result.observable).toBe(true);
            expect(result.output).toContain("PROCESS_STARTED pid=" + parentPid);

            // Requirement 8 & 9: the REAL parent and REAL child PIDs are terminated.
            expect(pidAlive(parentPid)).toBe(false);
            expect(pidAlive(childPid)).toBe(false);

            // Requirement 10: no HEARTBEAT is emitted after the terminal timeout.
            const heartbeatMatches = result.output.match(/HEARTBEAT pid=\d+ state=RUNNING elapsedSeconds=\d+/g) || [];
            expect(heartbeatMatches.length).toBeGreaterThan(0);
            const maxElapsed = Math.max(
                0,
                ...heartbeatMatches.map((m: string) => parseInt(m.replace(/.*elapsedSeconds=(\d+).*/, "$1"), 10))
            );
            // Heartbeats must stop near the timeout, not continue unbounded.
            expect(maxElapsed).toBeLessThanOrEqual(Math.ceil(timeoutMs / 1000) + 5);

            const heartbeatCount = (line: string) => (line.match(/HEARTBEAT pid=\d+ state=RUNNING/g) || []).length;
            const before = heartbeatCount(fs.readFileSync(result.progressLogPath, "utf8"));
            // Settle window: the dead wrapper cannot append further heartbeats.
            const settleEnd = Date.now() + 2000;
            while (Date.now() < settleEnd) { /* wait */ }
            const after = heartbeatCount(fs.readFileSync(result.progressLogPath, "utf8"));
            expect(after).toBe(before);
        } finally {
            // Requirement 11: guaranteed cleanup even when assertions fail.
            jest.dontMock("node:child_process");
            jest.resetModules();
            if (originalEnv === undefined) {
                delete process.env.HBOS_CHILD_PID_FILE;
            } else {
                process.env.HBOS_CHILD_PID_FILE = originalEnv;
            }
            for (const pid of [parentPid, childPid]) {
                if (pid > 0 && pidAlive(pid)) {
                    try {
                        child_process.execFileSync(
                            "taskkill", ["/PID", String(pid), "/T", "/F"],
                            { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] }
                        );
                    } catch { /* best-effort */ }
                }
            }
            try { fs.rmSync(testRoot, { recursive: true, force: true }); } catch { /* ignore */ }
        }
    }, 120000);
});
