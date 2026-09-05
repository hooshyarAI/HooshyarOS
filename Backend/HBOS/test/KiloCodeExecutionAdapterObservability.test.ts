import { buildWindowsKiloScript } from "../Autonomous/Runtime/KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter observability", () => {
    it("streams every Kilo output line to the operator and preserves it in the progress log", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\payload.json", 30_000);

        expect(script).toContain("Emit-KiloLine 'EXECUTION_STARTED'");
        expect(script).toContain("ForEach-Object");
        expect(script).toContain("Add-Content -LiteralPath $payload.logPath -Value $line");
        expect(script).toContain("Write-Host (\"[KILO] \" + $line)");
        expect(script).toContain('Emit-KiloLine ("EXECUTION_FINISHED code=" + $code)');
        expect(script).toContain("exit [int]$code");
    });

    it("escapes a single quote in the temporary payload path", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\ali's\\payload.json", 30_000);

        expect(script).toContain("ali''s");
        expect(script).not.toContain("ali's\\payload.json' | ConvertFrom-Json");
    });

    it("writes the inner process PID to a dedicated file immediately after Start-Process", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\payload.json", 30_000);
        expect(script).toContain("Set-Content -LiteralPath $payload.pidPath -Value $child.Id -NoNewline");
        expect(script).toContain("$payload.pidPath");
    });

    it("terminates the inner process tree on timeout and exits with code 124", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\payload.json", 5_000);
        expect(script).toContain("$timeoutMs = [long]$payload.timeout");
        expect(script).toContain("$elapsedMs = (Get-Date) - $startTime");
        expect(script).toContain("if ($elapsedMs.TotalMilliseconds -gt $timeoutMs) {");
        expect(script).toContain("Emit-KiloLine 'EXECUTION_TIMEOUT'");
        expect(script).toContain("& taskkill /PID $child.Id /T /F 2>$null");
        expect(script).toContain("exit 124");
    });
});
