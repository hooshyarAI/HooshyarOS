import { buildWindowsKiloScript, kiloInvocation } from "../Autonomous/Runtime/KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter observability", () => {
    it("keeps the real kilo run command intact and binds it to the governed code agent", () => {
        const prompt = "implement one canonical product capability";
        const invocation = kiloInvocation("win32", prompt);
        expect(invocation.args).toEqual(["run", "--agent", "code", "--auto", prompt]);
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"steps":30');
        expect(invocation.env.KILO_CONFIG_CONTENT).toContain('"task":"deny"');
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
