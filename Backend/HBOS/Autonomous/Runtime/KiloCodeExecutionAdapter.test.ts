import { KiloCodeExecutionAdapter, kiloInvocation } from "./KiloCodeExecutionAdapter";

describe("KiloCodeExecutionAdapter", () => {
    it("builds the documented autonomous CLI invocation", () => {
        expect(kiloInvocation("win32", "Implement one capability")).toEqual({
            command: "kilo.cmd",
            args: ["run", "--auto", "Implement one capability"],
            shell: true
        });
        expect(kiloInvocation("linux", "Implement one capability")).toEqual({
            command: "kilo",
            args: ["run", "--auto", "Implement one capability"],
            shell: false
        });
    });

    it("executes the Windows command through cmd.exe without splitting the prompt", () => {
        const runner = jest.fn().mockReturnValue("KILO_ADAPTER_RUNTIME_OK");
        const adapter = new KiloCodeExecutionAdapter(runner as never);
        const prompt = "Do not modify files with spaces in this prompt";
        const result = adapter.execute(prompt, process.cwd(), 30_000);

        expect(result.ok).toBe(true);
        if (process.platform === "win32") {
            expect(runner).toHaveBeenCalledWith(
                process.env.ComSpec || "cmd.exe",
                ["/d", "/s", "/c", `kilo.cmd run --auto "${prompt}"`],
                expect.objectContaining({ shell: false, cwd: process.cwd() })
            );
        } else {
            expect(runner).toHaveBeenCalledWith(
                "kilo",
                ["run", "--auto", prompt],
                expect.objectContaining({ shell: false, cwd: process.cwd() })
            );
        }
    });

    it("reports availability from the executable lookup", () => {
        const runner = jest.fn().mockReturnValue(Buffer.from("kilo"));
        const adapter = new KiloCodeExecutionAdapter(runner as never);
        expect(adapter.isAvailable()).toBe(true);
        expect(runner).toHaveBeenCalledWith(
            process.platform === "win32" ? "where.exe" : "which",
            ["kilo"],
            expect.objectContaining({ stdio: ["ignore", "pipe", "ignore"] })
        );
    });

    it("fails closed when the kilo executable is unavailable", () => {
        const runner = jest.fn(() => { throw new Error("not found"); });
        const adapter = new KiloCodeExecutionAdapter(runner as never);
        expect(adapter.isAvailable()).toBe(false);
    });
});
