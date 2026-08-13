import { TalentSuccessionService } from "../Product/TalentSuccessionService";

describe("TalentSuccessionService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new TalentSuccessionService();
        expect(service.capabilityId).toBe("product.talent-and-succession");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("assesses talent and succession evidence", () => {
        const result = new TalentSuccessionService().assess("coverage=4;continuity=5;transfer=3");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new TalentSuccessionService().assess(" ").status).toBe("BLOCKED");
    });
});
