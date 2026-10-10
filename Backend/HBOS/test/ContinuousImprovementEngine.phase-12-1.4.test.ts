import { ContinuousImprovementEngine, ImprovementInput } from "../Assistant/Autonomous/ContinuousImprovementEngine";
import { ImpactMeasurementService } from "../Product/ImpactMeasurementService";

describe("ContinuousImprovementEngine", () => {
    const engine = new ContinuousImprovementEngine();
    const TENANT = "tenant:improvement-test";

    const baseInput: ImprovementInput = {
        tenantId: TENANT,
        domain: "financial",
        actualImpact: {
            timeSaved: 10,
            operatingCostReduced: 500,
            actualFinancialValue: 1000,
            actualROI: 0.5,
            sustainability: "SUSTAINABLE"
        },
        expectedImpact: {
            timeSaved: 8,
            costReduced: 400,
            financialValue: 800,
            roi: 0.4
        },
        currentState: {
            revenue: 5000,
            profit: 1000,
            riskScore: 0.2,
            decisionLatency: 3
        }
    };

    test("generates adaptation recommendations when gaps are detected", () => {
        const result = engine.improve({
            ...baseInput,
            actualImpact: {
                timeSaved: 2,
                operatingCostReduced: 100,
                actualFinancialValue: 200,
                actualROI: 0.1,
                sustainability: "NOT_SUSTAINABLE"
            }
        });

        expect(result.status).toBe("READY");
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations.some(r => r.priority === "HIGH")).toBe(true);
        expect(result.learningSummary.gapDetected).toBe(true);
        expect(result.learningSummary.adaptationRequired).toBe(true);
    });

    test("returns maintain recommendation when no gaps detected", () => {
        const result = engine.improve(baseInput);

        expect(result.status).toBe("READY");
        expect(result.learningQualification).toBe("REVIEW_REQUIRED");
        expect(result.learningSummary.confidence).toBe(0);
        expect(result.provenance.verificationStatus).toBe("PENDING");
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations.some(r => r.action === "Maintain current trajectory")).toBe(true);
        expect(result.learningSummary.gapDetected).toBe(false);
        expect(result.learningSummary.sustainabilityMet).toBe(true);
    });

    test("blocks when tenantId is missing", () => {
        const result = engine.improve({
            ...baseInput,
            tenantId: ""
        });

        expect(result.status).toBe("NEEDS_DATA");
    });

    test("blocks when actualImpact is missing", () => {
        const result = engine.improve({
            ...baseInput,
            actualImpact: undefined as any
        });

        expect(result.status).toBe("NEEDS_DATA");
    });

    test("fails safe with NEEDS_DATA when no measurement input is supplied", () => {
        const result = engine.improve(null);

        expect(result.status).toBe("NEEDS_DATA");
        expect(result.recommendations).toEqual([]);
        expect(result.learningSummary.adaptationRequired).toBe(false);
        expect(result.provenance.verificationStatus).toBe("FAILED");
    });

    test("fails safe with NEEDS_DATA for undefined measurement input", () => {
        const result = engine.improve(undefined);

        expect(result.status).toBe("NEEDS_DATA");
        expect(result.recommendations).toEqual([]);
    });

    test("includes provenance in every result", () => {
        const result = engine.improve(baseInput);

        expect(result.provenance.traceId).toBeDefined();
        expect(result.provenance.inputHash).toBeDefined();
        expect(result.provenance.outputHash).toBeDefined();
        expect(result.provenance.verificationStatus).toBe("PENDING");
        expect(result.provenance.inputHash).toMatch(/^[a-f0-9]{64}$/);
        expect(result.provenance.outputHash).toMatch(/^[a-f0-9]{64}$/);
        expect(Number.isFinite(Date.parse(result.provenance.calculatedAt))).toBe(true);
        expect(result.provenance.sourceRef).toBe("ContinuousImprovementEngine");
    });

    test("generates risk-specific recommendation when riskScore is elevated", () => {
        const result = engine.improve({
            ...baseInput,
            currentState: {
                revenue: 5000,
                profit: 1000,
                riskScore: 0.5,
                decisionLatency: 3
            }
        });

        expect(result.recommendations.some(r => r.action.includes("risk"))).toBe(true);
    });

    test("generates decision-latency recommendation when latency is high", () => {
        const result = engine.improve({
            ...baseInput,
            currentState: {
                revenue: 5000,
                profit: 1000,
                riskScore: 0.1,
                decisionLatency: 10
            }
        });

        expect(result.recommendations.some(r => r.action.includes("decision workflow"))).toBe(true);
    });
    test("qualifies learning only when source measurement provenance is verified", () => {
        const result = engine.improve({
            ...baseInput,
            measurementProvenance: {
                traceId: "TRACE-verified",
                inputHash: "a".repeat(64),
                outputHash: "b".repeat(64),
                verificationStatus: "VERIFIED",
                sourceRef: "verified-source-evidence",
                calculatedAt: "2026-03-01T12:00:00.000Z"
            }
        });
        expect(result.status).toBe("READY");
        expect(result.learningQualification).toBe("QUALIFIED");
        expect(result.learningSummary.confidence).toBeGreaterThan(0);
        expect(result.provenance.verificationStatus).toBe("VERIFIED");
        expect(result.provenance.measurementTraceId).toBe("TRACE-verified");
    });

    test("feeds measured outcomes into learning but preserves pending source qualification", () => {
        const measurementService = new ImpactMeasurementService();
        const baseline = {
            tenantId: TENANT, revenue: 1000, profit: 200, profitMargin: 0.2, debtRatio: 0.3,
            cycleTime: 10, throughput: 50, errorRate: 0.05, capacity: 100,
            operatingCost: 500, decisionLatency: 2, riskScore: 0.1,
            recordedAt: "2026-01-01T00:00:00.000Z"
        };
        const post = {
            ...baseline, revenue: 1200, profit: 300, profitMargin: 0.25, debtRatio: 0.25,
            cycleTime: 8, throughput: 60, errorRate: 0.03, capacity: 120,
            operatingCost: 450, decisionLatency: 1.5, riskScore: 0.08,
            recordedAt: "2026-02-01T00:00:00.000Z"
        };
        const measured = measurementService.measure(baseline, post, {
            timeSaved: 3, costReduced: 70, capacityRelease: 10,
            qualityImprovement: 0.03, riskReduction: 0.02, financialValue: 200, roi: 0.4
        });
        const result = engine.improveFromMeasurement(measured, baseInput.currentState, TENANT);
        expect(result.status).toBe("READY");
        expect(result.learningQualification).toBe("REVIEW_REQUIRED");
        expect(result.provenance.measurementTraceId).toBe(measured.provenance.traceId);
        expect(result.learningSummary.confidence).toBe(0);
        expect(result.recommendations.length).toBeGreaterThan(0);
    });

    test("blocks cross-tenant measurement before learning", () => {
        const measurementService = new ImpactMeasurementService();
        const baseline = {
            tenantId: TENANT, revenue: 1000, profit: 200, profitMargin: 0.2, debtRatio: 0.3,
            cycleTime: 10, throughput: 50, errorRate: 0.05, capacity: 100,
            operatingCost: 500, decisionLatency: 2, riskScore: 0.1,
            recordedAt: "2026-01-01T00:00:00.000Z"
        };
        const post = { ...baseline, cycleTime: 8, operatingCost: 450, errorRate: 0.03, recordedAt: "2026-02-01T00:00:00.000Z" };
        const measured = measurementService.measure(baseline, post);
        const result = engine.improveFromMeasurement(measured, baseInput.currentState, "tenant:other");
        expect(result.status).toBe("NEEDS_DATA");
        expect(result.learningQualification).toBe("NEEDS_DATA");
        expect(result.recommendations).toEqual([]);
        expect(result.provenance.verificationStatus).toBe("FAILED");
    });

    test("rejects non-finite learning metrics", () => {
        const result = engine.improve({
            ...baseInput,
            currentState: { ...baseInput.currentState, riskScore: Number.NaN }
        });
        expect(result.status).toBe("NEEDS_DATA");
        expect(result.learningQualification).toBe("NEEDS_DATA");
        expect(result.recommendations).toEqual([]);
    });

});
