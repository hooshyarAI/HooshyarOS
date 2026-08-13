import { CommercialDashboardApplication } from "../Product/CommercialDashboardApplication";

describe("CommercialDashboardApplication", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CommercialDashboardApplication();
        expect(service.capabilityId).toBe("product.dashboard-and-report-application");
        expect(service.targetEngine).toBe("Executive Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new CommercialDashboardApplication().execute("continue").status).toBe("READY");
        expect(new CommercialDashboardApplication().execute(" ").status).toBe("BLOCKED");
    });
});
