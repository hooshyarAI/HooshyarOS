import { buildWindowsKiloScript, kiloInvocation } from "../Autonomous/Runtime/KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter observability", () => {
    it("keeps the real kilo run command intact and adds heartbeat observability", () => {
        const prompt = "repair the current working tree before construction";
        const invocation = kiloInvocation("win32", prompt);
        expect(invocation.args).toEqual(["run", "--auto", prompt]);

        const script = buildWindowsKiloScript("C:/temp/payload.json");
        expect(script).toContain("& $payload.command @($payload.args)");
        expect(script).toContain("[KILO] HEARTBEAT state=RUNNING");
        expect(script).toContain("[KILO] EXECUTION_FINISHED code=");
    });
});
