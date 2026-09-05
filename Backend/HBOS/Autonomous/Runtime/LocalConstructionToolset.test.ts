import { repositoryStateChanged, selectImplementationAgent, buildAgentArgs, emitKiloEscalation } from "./LocalConstructionToolset";

describe("LocalConstructionToolset", () => {
    it("reports a real working-tree change instead of trusting process success", () => {
        expect(repositoryStateChanged("", " M Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts")).toBe(true);
        expect(repositoryStateChanged("", "?? Backend/HBOS/Autonomous/Runtime/NewCapability.ts")).toBe(true);
    });

    it("does not report a change when repository state is unchanged", () => {
        expect(repositoryStateChanged("", "")).toBe(false);
        expect(repositoryStateChanged(" M existing.ts\n", " M existing.ts\n")).toBe(false);
    });

    it("selects Kilo automatically when available and falls back to Python", () => {
        expect(selectImplementationAgent(undefined, true, true)).toBe("kilo");
        expect(selectImplementationAgent(undefined, false, true)).toBe("python");
        expect(selectImplementationAgent("kilo", false, true)).toBe("python");
        expect(selectImplementationAgent("python", true, true)).toBe("python");
    });

    it("rejects unknown operator requests", () => {
        expect(selectImplementationAgent("cline", true, true)).toBe(null);
    });

    it("builds the governed autonomous Kilo command with the verified agent selection", () => {
        expect(buildAgentArgs("kilo", "Implement exactly one capability")).toEqual([
            "run",
            "--agent",
            "hooshyar-construction",
            "--auto",
            "Implement exactly one capability"
        ]);
    });

    it("emits machine-readable HELP_REQUIRED and ESCALATE when Kilo execution fails", () => {
        const logs: string[] = [];
        const spy = jest.spyOn(console, "log").mockImplementation((m?: unknown) => {
            logs.push(String(m));
        });
        try {
            emitKiloEscalation(
                "platform.user-management",
                { ok: false, code: 124, output: "", error: "Kilo execution timed out and its process tree was terminated", elapsedMs: 0, observable: true } as never
            );
            const joined = logs.join("\n");
            expect(joined).toContain("HELP_REQUIRED: kilo execution failed or was blocked");
            expect(joined).toContain("CAPABILITY: platform.user-management");
            expect(joined).toContain("AGENT: kilo");
            expect(joined).toContain("EVIDENCE_REQUIRED: Kilo execution timed out and its process tree was terminated");
            expect(joined).toContain("ESCALATE: approved execution operator may resolve and re-verify");
        } finally {
            spy.mockRestore();
        }
    });
});
