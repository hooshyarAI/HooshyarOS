import { buildWindowsKiloScript } from "../Autonomous/Runtime/KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter observability", () => {
    it("streams every Kilo output line to the operator and preserves it in the progress log", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\payload.json");

        expect(script).toContain("[KILO] EXECUTION_STARTED");
        expect(script).toContain("ForEach-Object");
        expect(script).toContain("Add-Content -LiteralPath $payload.logPath -Value $line");
        expect(script).toContain("Write-Host (\"[KILO] \" + $line)");
        expect(script).toContain("[KILO] EXECUTION_FINISHED code=");
        expect(script).toContain("exit [int]$code");
    });

    it("escapes a single quote in the temporary payload path", () => {
        const script = buildWindowsKiloScript("C:\\Temp\\ali's\\payload.json");

        expect(script).toContain("ali''s");
        expect(script).not.toContain("ali's\\payload.json' | ConvertFrom-Json");
    });
});
