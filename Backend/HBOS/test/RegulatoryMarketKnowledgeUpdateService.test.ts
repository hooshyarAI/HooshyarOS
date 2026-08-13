import { RegulatoryMarketKnowledgeUpdateService } from "../Product/RegulatoryMarketKnowledgeUpdateService";

describe("RegulatoryMarketKnowledgeUpdateService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new RegulatoryMarketKnowledgeUpdateService();
        expect(service.capabilityId).toBe("product.regulatory-standards-and-market-knowledge-updates");
        expect(service.targetEngine).toBe("Knowledge Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("normalizes governed regulatory knowledge evidence", () => {
        const result = new RegulatoryMarketKnowledgeUpdateService().normalize("source=tax;version=2026;status=approved");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new RegulatoryMarketKnowledgeUpdateService().normalize(" ").status).toBe("BLOCKED");
    });
});
