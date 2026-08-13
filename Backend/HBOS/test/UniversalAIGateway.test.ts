import { UniversalAIGateway } from "../Product/UniversalAIGateway";

describe("UniversalAIGateway", () => {
    it("exposes the canonical product boundary", () => {
        const service = new UniversalAIGateway();
        expect(service.capabilityId).toBe("product.universal-ai-gateway");
        expect(service.targetEngine).toBe("Reasoning Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new UniversalAIGateway().execute("continue").status).toBe("READY");
        expect(new UniversalAIGateway().execute(" ").status).toBe("BLOCKED");
    });
});
