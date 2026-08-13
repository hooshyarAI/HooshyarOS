import { TalentSuccessionService } from "../Product/TalentSuccessionService";

describe("TalentSuccessionService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new TalentSuccessionService();
        expect(service.capabilityId).toBe("product.talent-and-succession");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new TalentSuccessionService().execute("continue").status).toBe("READY");
        expect(new TalentSuccessionService().execute(" ").status).toBe("BLOCKED");
    });
});
