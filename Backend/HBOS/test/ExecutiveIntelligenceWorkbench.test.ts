import { ExecutiveIntelligenceWorkbench } from "../Product/ExecutiveIntelligenceWorkbench";

describe("ExecutiveIntelligenceWorkbench", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new ExecutiveIntelligenceWorkbench();
        expect(engine.name).toBe("ExecutiveIntelligenceWorkbench");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "repair-product.executive-intelligence-workbench",
            capability: "repair commercial quality failure for product.executive-intelligence-workbench: compose executive KPI, dashboard and performance intelligence from verified platform evidence",
            targetEngine: "Executive Intelligence Engine"
        });
    });
});
