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

    it("aggregates repository-native readiness evidence into one internal verdict", () => {
        const result = new ProductionAcceptanceEngine().audit(process.cwd());
        expect(result.evidence.productionReadiness).toBe(true);
        expect(result.evidence.deploymentReadiness).toBe(true);
        expect(result.evidence.deploymentContract).toBe(true);
        expect(result.evidence.performanceEvidence).toBe(true);
        expect(result.evidence.customerEvidence).toBe(true);
        expect(result.evidence.securityEvidence).toBe(true);
        expect(result.evidence.coreArtifacts).toBe(true);
        expect(result.internalReady).toBe(true);
        expect(result.accepted).toBe(true);
        expect(result.externalValidationRequired).toBe(true);
        expect(result.blockers).toEqual([]);
    });
});
