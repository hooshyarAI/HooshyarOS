import { ImpactMeasurementService } from "../Product/ImpactMeasurementService";

describe("ImpactMeasurementService", () => {
    const service = new ImpactMeasurementService();
    const TENANT = "tenant:impact-test";

    const baseline = {
        tenantId: TENANT,
        revenue: 1000,
        profit: 200,
        profitMargin: 0.2,
        debtRatio: 0.3,
        cycleTime: 10,
        throughput: 50,
        errorRate: 0.05,
        capacity: 100,
        operatingCost: 500,
        decisionLatency: 2,
        riskScore: 0.1,
        recordedAt: "2026-01-01T00:00:00Z"
    };

    const post = {
        tenantId: TENANT,
        revenue: 1200,
        profit: 300,
        profitMargin: 0.25,
        debtRatio: 0.25,
        cycleTime: 8,
        throughput: 60,
        errorRate: 0.03,
        capacity: 120,
        operatingCost: 450,
        decisionLatency: 1.5,
        riskScore: 0.08,
        recordedAt: "2026-02-01T00:00:00Z"
    };

    test("measures positive impact across financial and operational metrics", () => {
        const result = service.measure(baseline, post);

        expect(result.status).toBe("READY");
        expect(result.tenantId).toBe(TENANT);
        expect(result.deltas.revenue).toBe(200);
        expect(result.deltas.profit).toBe(100);
        expect(result.percentChanges.revenue).toBeCloseTo(0.2, 5);
        expect(result.percentChanges.profit).toBeCloseTo(0.5, 5);
        expect(result.actualImpact.timeSaved).toBe(2);
        expect(result.actualImpact.operatingCostReduced).toBe(50);
        expect(result.actualImpact.actualFinancialValue).toBeGreaterThan(0);
        expect(result.actualImpact.actualROI).toBeGreaterThan(0);
        expect(result.actualImpact.sustainability).toBe("SUSTAINABLE");
    });

    test("returns NEEDS_DATA when baseline is invalid", () => {
        const result = service.measure(
            { ...baseline, revenue: -100 },
            post
        );

        expect(result.status).toBe("NEEDS_DATA");
    });

    test("returns NEEDS_DATA when post is invalid", () => {
        const result = service.measure(
            baseline,
            { ...post, profit: NaN }
        );

        expect(result.status).toBe("NEEDS_DATA");
    });

    test("returns NEEDS_DATA when tenant IDs mismatch", () => {
        const result = service.measure(
            baseline,
            { ...post, tenantId: "tenant:other" }
        );

        expect(result.status).toBe("NEEDS_DATA");
    });

    test("tracks expected impact separately from actual", () => {
        const expected = {
            timeSaved: 5,
            costReduced: 100,
            capacityRelease: 20,
            qualityImprovement: 0.02,
            riskReduction: 0.05,
            financialValue: 200,
            roi: 0.4
        };

        const result = service.measure(baseline, post, expected);

        expect(result.expectedImpact).toBeDefined();
        expect(result.expectedImpact!.timeSaved).toBe(5);
        expect(result.actualImpact.timeSaved).toBe(2);
        expect(result.actualImpact.timeSaved).not.toBe(result.expectedImpact!.timeSaved);
    });

    test("distinguishes expected vs actual impact when no expectation provided", () => {
        const result = service.measure(baseline, post);

        expect(result.expectedImpact).toBeUndefined();
        expect(result.actualImpact.actualFinancialValue).toBeGreaterThan(0);
    });

    test("handles negative impact scenarios", () => {
        const worsePost = {
            tenantId: TENANT,
            revenue: 800,
            profit: 100,
            profitMargin: 0.125,
            debtRatio: 0.5,
            cycleTime: 15,
            throughput: 30,
            errorRate: 0.1,
            capacity: 80,
            operatingCost: 700,
            decisionLatency: 4,
            riskScore: 0.3,
            recordedAt: "2026-02-01T00:00:00Z"
        };

        const result = service.measure(baseline, worsePost);

        expect(result.deltas.revenue).toBe(-200);
        expect(result.percentChanges.revenue).toBeCloseTo(-0.2, 5);
        expect(result.actualImpact.operatingCostReduced).toBe(0);
        expect(result.actualImpact.actualFinancialValue).toBe(0);
        expect(result.actualImpact.sustainability).toBe("NOT_SUSTAINABLE");
    });

    test("includes provenance in every result", () => {
        const result = service.measure(baseline, post);

        expect(result.provenance.traceId).toBeDefined();
        expect(result.provenance.inputHash).toBeDefined();
        expect(result.provenance.outputHash).toBeDefined();
        expect(result.provenance.verificationStatus).toBe("VERIFIED");
        expect(result.provenance.sourceRef).toBe("ImpactMeasurementService");
    });
});
