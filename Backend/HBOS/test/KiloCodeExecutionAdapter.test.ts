import { buildWindowsKiloScript, kiloInvocation } from "../Autonomous/Runtime/KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter observability", () => {
    it("uses the dedicated HooshyarOS construction agent with a finite governed budget and no shell escape", () => {
        const prompt = "implement one canonical product capability";
        const invocation = kiloInvocation("win32", prompt);
        expect(invocation.args).toEqual(["run", "--agent", "hooshyar-construction", "--auto", prompt]);
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"hooshyar-construction"');
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"steps":12');
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"glob":"deny"');
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"grep":"deny"');
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"task":"deny"');
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"websearch":"deny"');
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"webfetch":"deny"');
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"bash":"deny"');
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain("Do not use the Task tool");
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain("Do not perform repository-wide exploration");
    });

    it("uses one bounded Windows monitor with live lifecycle output", () => {
        const script = buildWindowsKiloScript("C:/temp/payload.json");
        expect(script).toContain("Start-Process -FilePath $payload.command");
        expect(script).toContain("[KILO] HEARTBEAT pid=");
        expect(script).toContain("[KILO] PROCESS_FINISHED pid=");
        expect(script).toContain("$code = $child.ExitCode");
        expect(script).toContain("Read-SharedText");
        expect(script).not.toContain("while($true)");
    });
});
