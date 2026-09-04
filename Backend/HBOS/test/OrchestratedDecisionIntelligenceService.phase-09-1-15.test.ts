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

    test("orchestrate returns full READY when all inputs are valid", () => {
        const r = service.orchestrate(validInput);
        expect(r.tenantId).toBe("tenant-1");
        expect(r.status).toBe("READY");
        expect(r.financial.status).toBe("READY");
        expect(r.financial.profit).toBe(300);
        expect(r.risk.status).toBe("READY");
        expect(r.risk.score).toBe(30);
        expect(r.decision.status).toBe("READY");
        expect(r.decision.ahp.consistent).toBe(true);
        expect(r.decision.topsis.bestIndex).toBe(0);
    });

    test("orchestrate blocks on missing tenantId", () => {
        const r = service.orchestrate({ ...validInput, tenantId: "" });
        expect(r.status).toBe("BLOCKED");
    });

    test("orchestrate preserves per-section BLOCKED status when sub-result is BLOCKED", () => {
        const r = service.orchestrate({
            ...validInput,
            financial: { ...validInput.financial, revenue: Number.NaN, expenses: 700, assets: 2000, liabilities: 500 }
        });
        // The financial section is BLOCKED, but the risk and decision sections can still be READY.
        expect(r.financial.status).toBe("BLOCKED");
        expect(r.risk.status).toBe("READY");
        expect(r.decision.status).toBe("READY");
    });

    test("orchestrate blocks when AHP matrix is invalid", () => {
        const r = service.orchestrate({ ...validInput, decision: { ...validInput.decision, ahpMatrix: [[1, 2]] } });
        expect(r.decision.ahp.status).toBe("BLOCKED");
    });

    test("orchestrate blocks when TOPSIS matrix has wrong dimensions", () => {
        const r = service.orchestrate({ ...validInput, decision: { ...validInput.decision, topsis: { matrix: [[1, 2], [3]], weights: [1, 1], criteria: ["benefit", "benefit"] } } });
        expect(r.decision.topsis.status).toBe("BLOCKED");
    });

    test("tenantId propagated through result", () => {
        const r = service.orchestrate({ ...validInput, tenantId: "tenant-42" });
        expect(r.tenantId).toBe("tenant-42");
    });

    test("no NaN/Infinity leaks in READY sub-results", () => {
        const r = service.orchestrate(validInput);
        expect(r.status).toBe("READY");
        expect(Number.isFinite(r.financial.npv)).toBe(true);
        expect(Number.isFinite(r.financial.irr)).toBe(true);
        expect(Number.isFinite(r.financial.wacc)).toBe(true);
        for (const w of r.decision.ahp.weights) expect(Number.isFinite(w)).toBe(true);
    });
});
