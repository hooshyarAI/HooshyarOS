import { ProductionAcceptanceEngine } from "../Engines/ProductionAcceptanceEngine";

describe("ProductionAcceptanceEngine", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new ProductionAcceptanceEngine();
        expect(engine.name).toBe("ProductionAcceptanceEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "platform.production-acceptance",
            capability: "implement repository-native Production Acceptance capability and complete the internal acceptance gate before external deployment validation",
            targetEngine: "Production Acceptance Engine"
        });
    });
});
