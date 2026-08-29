import { KiloCodeExecutionAdapter, kiloInvocation } from "./KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter", () => {
    it("builds the governed autonomous CLI invocation with the verified free model", () => {
        const invocation = kiloInvocation("win32", "Implement one capability");

        expect(invocation.args).toEqual(["run", "--auto", "Implement one capability"]);
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
            ["run", "--auto", prompt],
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
            ["kilo.exe"],
            expect.objectContaining({ stdio: ["ignore", "pipe", "ignore"] })
        );
    });

    it("fails closed when the kilo executable is unavailable", () => {
        const runner = jest.fn(() => { throw new Error("not found"); });
        const adapter = new KiloCodeExecutionAdapter(runner as never);
        expect(adapter.isAvailable()).toBe(false);
    });
});
