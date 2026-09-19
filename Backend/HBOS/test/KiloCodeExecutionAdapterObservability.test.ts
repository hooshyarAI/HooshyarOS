import { buildWindowsKiloScript } from "../Autonomous/Runtime/KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter observability", () => {
    it("emits and streams every Kilo output line through the progress log", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\payload.json");

        expect(script).toContain("Emit-KiloLine 'EXECUTION_STARTED'");
        expect(script).toContain("Add-Content -LiteralPath $payload.logPath -Value $line");
        expect(script).toContain("Write-Host (\"[KILO] \" + $line)");
        expect(script).toContain("ForEach-Object");
        expect(script).toContain('Emit-KiloLine ("EXECUTION_FINISHED code=" + $code)');
        expect(script).toContain("exit [int]$code");
    });

    it("streams stdout and stderr deltas incrementally instead of buffering until exit", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\payload.json");

        expect(script).toContain("$stdoutOffset = 0");
        expect(script).toContain("$stderrOffset = 0");
        expect(script).toContain("Emit-KiloLine (\"[STDOUT] \" + $_)");
        expect(script).toContain("Emit-KiloLine (\"[STDERR] \" + $_)");
        expect(script).toContain("HEARTBEAT pid=");
        expect(script).toContain("Start-Sleep -Seconds 5");
    });

    it("escapes a single quote in the temporary payload path", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\ali's\\payload.json");

        expect(script).toContain("ali''s");
        expect(script).not.toContain("ali's\\payload.json' | ConvertFrom-Json");
    });

    it("writes the inner process PID immediately after Start-Process", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\payload.json");

        const startIndex = script.indexOf("Start-Process");
        const pidIndex = script.indexOf("Set-Content -LiteralPath $payload.pidPath -Value $child.Id -NoNewline");

        expect(startIndex).toBeGreaterThanOrEqual(0);
        expect(pidIndex).toBeGreaterThan(startIndex);
    });

    it("normalizes .cmd/.bat launchers through cmd.exe", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\payload.json");

        expect(script).toContain("$extension = [System.IO.Path]::GetExtension($command).ToString().ToLower()");
        expect(script).toContain("if ($extension -eq '.cmd' -or $extension -eq '.bat') {");
        expect(script).toContain("$launchCommand = 'cmd.exe'");
        expect(script).toContain("$launchArgs = @('/c', $command) + $payload.args");
    });

    it("terminates the inner process tree on timeout and exits with code 124", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\payload.json");

        expect(script).toContain("$elapsedMs = ((Get-Date) - $startTime).TotalMilliseconds");
        expect(script).toContain("if ($elapsedMs -gt $payload.timeout) {");
        expect(script).toContain("Emit-KiloLine 'EXECUTION_TIMEOUT'");
        expect(script).toContain("& taskkill /PID $child.Id /T /F 2>`$null");
        expect(script).toContain("exit 124");
    });
});
