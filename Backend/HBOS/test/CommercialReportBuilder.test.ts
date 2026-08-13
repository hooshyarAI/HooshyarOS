import { CommercialReportBuilder } from "../Product/CommercialReportBuilder";

describe("CommercialReportBuilder", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CommercialReportBuilder();
        expect(service.capabilityId).toBe("product.report-builder-and-export");
        expect(service.targetEngine).toBe("Executive Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("builds a governed report evidence set", () => {
        const result = new CommercialReportBuilder().buildReport("executive|financial|operational");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new CommercialReportBuilder().buildReport(" ").status).toBe("BLOCKED");
    });
});
