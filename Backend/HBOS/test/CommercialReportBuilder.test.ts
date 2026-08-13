import { CommercialReportBuilder } from "../Product/CommercialReportBuilder";

describe("CommercialReportBuilder", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CommercialReportBuilder();
        expect(service.capabilityId).toBe("product.report-builder-and-export");
        expect(service.targetEngine).toBe("Executive Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new CommercialReportBuilder().execute("continue").status).toBe("READY");
        expect(new CommercialReportBuilder().execute(" ").status).toBe("BLOCKED");
    });
});
