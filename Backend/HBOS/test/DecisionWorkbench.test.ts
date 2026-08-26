import { DecisionWorkbench } from "../Product/DecisionWorkbench";

describe("DecisionWorkbench", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new DecisionWorkbench();
        expect(engine.name).toBe("DecisionWorkbench");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "repair-product.decision-workbench",
            capability: "repair and re-verify knot product.decision-workbench from checkpoint 4c9aeefb",
            targetEngine: "Decision Intelligence Engine"
        });
    });
});

