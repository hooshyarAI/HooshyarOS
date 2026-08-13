import {
    CommercialDashboardApplication,
    DashboardInput,
} from "../Product/CommercialDashboardApplication";

describe("CommercialDashboardApplication", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CommercialDashboardApplication();

        expect(service.capabilityId).toBe(
            "product.dashboard-and-report-application",
        );
        expect(service.targetEngine).toBe("Executive Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("composes metrics, report sections and alert evaluation", () => {
        const input: DashboardInput = {
            title: "Executive Overview",
            metrics: {
                revenue: 100,
                cash: 60,
                risk: 4,
            },
            sections: ["Financial", "Risk"],
            alertThresholds: {
                risk: 3,
            },
        };

        const result = new CommercialDashboardApplication().build(input);

        expect(result.status).toBe("READY");
        expect(result.dashboard.total).toBe(164);
        expect(result.report.sections).toEqual(["Financial", "Risk"]);
        expect(result.alerts.risk.triggered).toBe(true);
        expect(result.alerts.risk.status).toBe("READY");
    });

    it("blocks invalid financial input", () => {
        const result = new CommercialDashboardApplication().build({
            title: "Executive Overview",
            metrics: {
                revenue: Number.NaN,
            },
            sections: ["Financial"],
        });

        expect(result.status).toBe("BLOCKED");
        expect(result.dashboard.status).toBe("BLOCKED");
    });
});
