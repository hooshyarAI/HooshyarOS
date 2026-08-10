import { repositoryStateChanged } from "./LocalConstructionToolset";

describe("LocalConstructionToolset repository change detection", () => {
    it("reports a real working-tree change instead of trusting process success", () => {
        expect(repositoryStateChanged("", " M Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts")).toBe(true);
        expect(repositoryStateChanged("", "?? Backend/HBOS/Autonomous/Runtime/NewCapability.ts")).toBe(true);
    });

    it("does not report a change when repository state is unchanged", () => {
        expect(repositoryStateChanged("", "")).toBe(false);
        expect(repositoryStateChanged(" M existing.ts\n", " M existing.ts\n")).toBe(false);
    });
});
