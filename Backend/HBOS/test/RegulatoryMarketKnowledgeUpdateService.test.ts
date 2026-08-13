import { RegulatoryMarketKnowledgeUpdateService } from "../Product/RegulatoryMarketKnowledgeUpdateService";

describe("RegulatoryMarketKnowledgeUpdateService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new RegulatoryMarketKnowledgeUpdateService();
        expect(service.capabilityId).toBe("product.regulatory-standards-and-market-knowledge-updates");
        expect(service.targetEngine).toBe("Knowledge Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new RegulatoryMarketKnowledgeUpdateService().execute("continue").status).toBe("READY");
        expect(new RegulatoryMarketKnowledgeUpdateService().execute(" ").status).toBe("BLOCKED");
    });
});
