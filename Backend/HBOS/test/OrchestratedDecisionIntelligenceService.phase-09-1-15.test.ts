import { OrchestratedDecisionIntelligenceService } from "../Product/OrchestratedDecisionIntelligenceService";

describe("OrchestratedDecisionIntelligenceService (09-1.15)", () => {
    const service = new OrchestratedDecisionIntelligenceService();

    const validInput = {
        tenantId: "tenant-1",
        problem: "Should we invest in Project X?",
        financial: {
            revenue: 1000,
            expenses: 700,
            assets: 2000,
            liabilities: 500,
            cashFlows: { initial: -1000, flows: [400, 400, 400], discountRate: 0.10 },
            waccInputs: { equity: 1200, debt: 800, costOfEquity: 0.12, costOfDebt: 0.06, taxRate: 0.25 }
        },
        risk: {
            probability: 0.3,
            impact: 100,
            criteria: [
                { name: "rate", params: { value: 0.10 } },
                { name: "y1", params: { value: 400 } },
                { name: "y2", params: { value: 400 } }
            ],
            model: (p: any) => -1000 + p.y1 / (1 + p.rate) + p.y2 / Math.pow(1 + p.rate, 2) + 400 / Math.pow(1 + p.rate, 3)
        },
        decision: {
            ahpMatrix: [[1, 2, 4], [0.5, 1, 2], [0.25, 0.5, 1]],
            topsis: {
                matrix: [[8, 7], [5, 9]],
                weights: [1, 1],
                criteria: ["benefit", "benefit"] as ("benefit" | "cost")[]
            }
        }
    };

    test("composes calculation results but requires review while science/data-quality coverage is partial", () => {
        const r = service.orchestrate(validInput);
        expect(r.tenantId).toBe("tenant-1");
        expect(r.executionStatus).toBe("READY");
        expect(r.status).toBe("PARTIAL");
        expect(r.financial.status).toBe("READY");
        expect(r.financial.profit).toBe(300);
        expect(r.risk.status).toBe("READY");
        expect(r.risk.score).toBe(30);
        expect(r.decision.status).toBe("READY");
        expect(r.decision.execution.methods).toEqual(["ahp", "topsis"]);
        expect(r.decision.ahp.consistent).toBe(true);
        expect(r.decision.topsis.bestIndex).toBe(0);
        expect(r.science?.status).toBe("PARTIAL");
        expect(r.science?.selected.map(item => item.domainId)).toEqual(expect.arrayContaining([
            "financial-management",
            "financial-engineering",
            "decision-science",
            "risk-uncertainty-analysis"
        ]));
        expect(r.quality.status).toBe("REVIEW_REQUIRED");
        expect(r.quality.requiresHumanReview).toBe(true);
        expect(r.quality.checks.map(check => check.id)).toEqual(expect.arrayContaining([
            "financial-calculations",
            "risk-calculations",
            "decision-method-composition",
            "science-selection",
            "source-data-quality"
        ]));
        expect(r.quality.provenance.inputHash).toMatch(/^[a-f0-9]{64}$/);
        expect(r.quality.provenance.outputHash).toMatch(/^[a-f0-9]{64}$/);
        expect(r.quality.provenance.traceId).toContain("TRACE-");
        expect(r.quality.provenance.verificationStatus).toBe("PENDING");
    });

    test("orchestrate blocks on missing tenantId before executing methods", () => {
        const r = service.orchestrate({ ...validInput, tenantId: "" });
        expect(r.status).toBe("BLOCKED");
        expect(r.executionStatus).toBe("BLOCKED");
        expect(r.quality.status).toBe("BLOCKED");
        expect(r.quality.provenance.verificationStatus).toBe("FAILED");
        expect(r.decision.execution.methods).toHaveLength(0);
    });

    test("keeps per-section readiness visible while the quality gate blocks invalid financial inputs", () => {
        const r = service.orchestrate({
            ...validInput,
            financial: { ...validInput.financial, revenue: Number.NaN, expenses: 700, assets: 2000, liabilities: 500 }
        });
        expect(r.status).toBe("BLOCKED");
        expect(r.financial.status).toBe("BLOCKED");
        expect(r.risk.status).toBe("READY");
        expect(r.decision.status).toBe("READY");
        expect(r.quality.checks.find(check => check.id === "financial-calculations")?.status).toBe("BLOCKED");
    });

    test("reports blocked AHP method without discarding the other decision result", () => {
        const r = service.orchestrate({
            ...validInput,
            decision: { ...validInput.decision, ahpMatrix: [[1, 2]] }
        });
        expect(r.decision.ahp.status).toBe("BLOCKED");
        expect(r.decision.topsis.status).toBe("READY");
        expect(r.decision.execution.status).toBe("PARTIAL");
        expect(r.decision.execution.blockedMethods).toEqual(["ahp"]);
        expect(r.status).toBe("BLOCKED");
    });

    test("reports blocked TOPSIS input while retaining AHP evidence", () => {
        const r = service.orchestrate({
            ...validInput,
            decision: {
                ...validInput.decision,
                topsis: { matrix: [[1, 2], [3]], weights: [1, 1], criteria: ["benefit", "benefit"] }
            }
        });
        expect(r.decision.topsis.status).toBe("BLOCKED");
        expect(r.decision.ahp.status).toBe("READY");
        expect(r.decision.execution.status).toBe("PARTIAL");
        expect(r.decision.execution.blockedMethods).toEqual(["topsis"]);
        expect(r.status).toBe("BLOCKED");
    });

    test("executes the optional decision tree only when supplied and exposes its expected value", () => {
        const r = service.orchestrate({
            ...validInput,
            decision: {
                ...validInput.decision,
                decisionTree: {
                    name: "investment",
                    children: [
                        { name: "success", probability: 0.6, value: 100 },
                        { name: "failure", probability: 0.4, value: 0 }
                    ]
                }
            }
        });
        expect(r.decision.status).toBe("READY");
        expect(r.decision.execution.methods).toEqual(["ahp", "topsis", "decisionTree"]);
        expect(r.decision.decisionTree?.status).toBe("READY");
        expect(r.decision.decisionTree?.expectedValue).toBeCloseTo(60, 8);
    });

    test("propagates tenantId unchanged", () => {
        const r = service.orchestrate({ ...validInput, tenantId: "tenant-42" });
        expect(r.tenantId).toBe("tenant-42");
    });

    test("keeps numeric sub-results finite even while quality review is pending", () => {
        const r = service.orchestrate(validInput);
        expect(r.executionStatus).toBe("READY");
        expect(r.status).toBe("PARTIAL");
        expect(Number.isFinite(r.financial.npv)).toBe(true);
        expect(Number.isFinite(r.financial.irr)).toBe(true);
        expect(Number.isFinite(r.financial.wacc)).toBe(true);
        for (const w of r.decision.ahp.weights) expect(Number.isFinite(w)).toBe(true);
    });

    test("returns a blocked quality report for a missing required payload", () => {
        const r = service.orchestrate({
            ...validInput,
            risk: { ...validInput.risk, model: undefined as never }
        });
        expect(r.status).toBe("BLOCKED");
        expect(r.quality.checks[0].status).toBe("BLOCKED");
    });

    test("records unsupported supplemental science signals and requires review instead of guessing", () => {
        const r = service.orchestrate({
            ...validInput,
            additionalScienceSignals: ["unknown-signal" as never]
        });

        expect(r.science?.unresolvedSignals).toContain("unknown-signal");
        expect(r.status).toBe("PARTIAL");
        expect(r.quality.requiresHumanReview).toBe(true);
    });
});
