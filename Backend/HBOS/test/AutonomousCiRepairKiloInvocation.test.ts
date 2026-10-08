import path from "node:path";

interface RunnerModule {
    buildKiloInvocation(handoffPath: string, prompt: string): { command: string; args: string[] };
}

/**
 * `kilo run` declares the message positional (`message..`) and `-f, --file` as
 * array options (`kilo run --help`). yargs drains every following value into an
 * array option until it meets another flag, so emitting `-f <handoff> <prompt>`
 * consumed the repair prompt as a second "file to attach". The CI job then died
 * before repair with:
 *
 *   Error: File not found: You are HooshyarOS autonomous CI repair operator....
 *
 * These tests pin the emitted argv so the message can never be swallowed again.
 */
describe("Autonomous CI repair Kilo invocation", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    const runner = require(path.join(root, "scripts", "autonomous-ci-repair-runner.cjs")) as RunnerModule;
    const handoff = path.join(root, ".hooshyar", "autonomous-repair-handoff.json");
    const prompt = "You are HooshyarOS autonomous CI repair operator. Read the handoff and repair the first failing target.";

    it("emits the repair prompt as the message positional, before the file array option", () => {
        const invocation = runner.buildKiloInvocation(handoff, prompt);
        expect(invocation.command).toBe("kilo");
        expect(invocation.args[0]).toBe("run");
        expect(invocation.args).toContain("--auto");
        expect(invocation.args[invocation.args.indexOf("--agent") + 1]).toBe("hooshyar-repair");

        const promptIndex = invocation.args.indexOf(prompt);
        const fileIndex = invocation.args.indexOf("--file");
        expect(promptIndex).toBeGreaterThan(-1);
        expect(fileIndex).toBeGreaterThan(promptIndex);
    });

    it("leaves exactly one value after the file array option so nothing is drained as a file", () => {
        const invocation = runner.buildKiloInvocation(handoff, prompt);
        const fileIndex = invocation.args.indexOf("--file");
        expect(invocation.args.slice(fileIndex)).toEqual(["--file", handoff]);
        expect(invocation.args.filter((arg) => arg === "--file")).toHaveLength(1);
        expect(invocation.args.filter((arg) => arg === prompt)).toHaveLength(1);
    });
});
