import { UniversalAIGateway } from "../Product/UniversalAIGateway";

describe("UniversalAIGateway", () => {
    it("exposes the canonical product boundary", () => {
        const service = new UniversalAIGateway();
        expect(service.capabilityId).toBe("product.universal-ai-gateway");
        expect(service.targetEngine).toBe("Reasoning Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("evaluates AI provider readiness evidence", () => {
        const result = new UniversalAIGateway().evaluate("provider=python;health=ready;local=true");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new UniversalAIGateway().evaluate(" ").status).toBe("BLOCKED");
    });
});
