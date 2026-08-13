import { DecisionWorkbench } from "../Product/DecisionWorkbench";

describe("DecisionWorkbench", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new DecisionWorkbench();
        expect(engine.name).toBe("DecisionWorkbench");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "repair-product.decision-workbench",
            capability: "repair commercial quality failure for product.decision-workbench: provide explainable decision scenarios, Expert Choice/AHP-style evaluation and recommendation evidence",
            targetEngine: "Decision Intelligence Engine"
        });
    });
});
