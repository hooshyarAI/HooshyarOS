import { ContinuousImprovementEngine, ImprovementInput } from "../Assistant/Autonomous/ContinuousImprovementEngine";

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

    test("includes provenance in every result", () => {
        const result = engine.improve(baseInput);

        expect(result.provenance.traceId).toBeDefined();
        expect(result.provenance.inputHash).toBeDefined();
        expect(result.provenance.outputHash).toBeDefined();
        expect(result.provenance.verificationStatus).toBe("VERIFIED");
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
});
