import { buildWindowsKiloScript, kiloInvocation } from "../Autonomous/Runtime/KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter observability", () => {
    it("keeps the real kilo run command intact and uses one bounded Windows monitor", () => {
        const prompt = "repair the current working tree before construction";
        const invocation = kiloInvocation("win32", prompt);
        expect(invocation.args).toEqual(["run", "--auto", prompt]);

        const script = buildWindowsKiloScript("C:/temp/payload.json");
        expect(script).toContain("Start-Process -FilePath $payload.command");
        expect(script).toContain("[KILO] HEARTBEAT pid=");
        expect(script).toContain("[KILO] PROCESS_FINISHED pid=");
        expect(script).toContain("$code = $child.ExitCode");
        expect(script).not.toContain("while($true)");
    });
});
