import { CommercialE2EAcceptanceScenario } from "../Product/CommercialE2EAcceptanceScenario";

describe("CommercialE2EAcceptanceScenario", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CommercialE2EAcceptanceScenario();
        expect(service.capabilityId).toBe("product.commercial-e2e-acceptance");
        expect(service.targetEngine).toBe("Autonomous Operations Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new CommercialE2EAcceptanceScenario().execute("continue").status).toBe("READY");
        expect(new CommercialE2EAcceptanceScenario().execute(" ").status).toBe("BLOCKED");
    });
});
