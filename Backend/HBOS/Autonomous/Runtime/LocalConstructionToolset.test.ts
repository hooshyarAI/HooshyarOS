import { repositoryStateChanged, selectImplementationAgent, buildAgentArgs } from "./LocalConstructionToolset";

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

    it("builds the autonomous Kilo command without changing its prompt semantics", () => {
        expect(buildAgentArgs("kilo", "Implement exactly one capability")).toEqual([
            "run",
            "--auto",
            "Implement exactly one capability"
        ]);
    });
});
