import { buildWindowsKiloScript, kiloInvocation } from "../Autonomous/Runtime/KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter observability", () => {
    it("uses the repository-owned construction agent without injecting a conflicting permission policy", () => {
        const prompt = "implement one canonical product capability";
        const invocation = kiloInvocation("win32", prompt);
        const config = JSON.parse(invocation.env.KILO_CONFIG_CONTENT || "{}");

        expect(invocation.args).toEqual(["run", "--agent", "hooshyar-construction", "--auto", prompt]);
        expect(config).toEqual({ model: "kilo/kilo-auto/free" });
        expect(config).not.toHaveProperty("agent");
        expect(config).not.toHaveProperty("permissions");
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
