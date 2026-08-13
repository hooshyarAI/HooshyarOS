import { CommercialE2EAcceptanceScenario } from "../Product/CommercialE2EAcceptanceScenario";

describe("CommercialE2EAcceptanceScenario", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CommercialE2EAcceptanceScenario();
        expect(service.capabilityId).toBe("product.commercial-e2e-acceptance");
        expect(service.targetEngine).toBe("Autonomous Operations Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("validates the commercial end-to-end evidence path", () => {
        const result = new CommercialE2EAcceptanceScenario().validate("onboard->ingest->insight->decision->execute->outcome");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new CommercialE2EAcceptanceScenario().validate(" ").status).toBe("BLOCKED");
    });
});
