import { AssistantEngine } from "../Engines/AssistantEngine";
import { OrchestratedDecisionIntelligenceService } from "../Product/OrchestratedDecisionIntelligenceService";

describe("AssistantEngine → Orchestrated Decision Intelligence integration (Phase 09-activation GAP 1)", () => {
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
            model: (p: Record<string, number>) => -1000 + (p["y1"] ?? 0) / (1 + (p["rate"] ?? 0)) + (p["y2"] ?? 0) / Math.pow(1 + (p["rate"] ?? 0), 2) + 400 / Math.pow(1 + (p["rate"] ?? 0), 3)
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

    test("AssistantEngine constructor accepts an injected OrchestratedDecisionIntelligenceService", () => {
        const orchestrated = new OrchestratedDecisionIntelligenceService();
        const engine = new AssistantEngine({ orchestrated });
        expect(engine).toBeDefined();
    });

    test("analyzeAcquisitionOpportunity returns READY when orchestrated math is READY", () => {
        const orchestrated = new OrchestratedDecisionIntelligenceService();
        const engine = new AssistantEngine({ orchestrated });
        const out = engine.analyzeAcquisitionOpportunity(
            "Should we acquire Company Y?",
            validInput
        );
        expect(out.orchestrated.status).toBe("READY");
        expect(out.orchestrated.financial.status).toBe("READY");
        expect(out.orchestrated.risk.status).toBe("READY");
        expect(out.orchestrated.decision.status).toBe("READY");
        expect(out.response.message).toContain("Financial:");
        expect(out.response.message).toContain("Risk:");
        expect(out.response.message).toContain("Decision:");
    });

    test("analyzeAcquisitionOpportunity propagates BLOCKED with limitations when math fails", () => {
        const orchestrated = new OrchestratedDecisionIntelligenceService();
        const engine = new AssistantEngine({ orchestrated });
        const out = engine.analyzeAcquisitionOpportunity("bad", {
            ...validInput,
            financial: {
                ...validInput.financial,
                revenue: Number.NaN,
                expenses: 700,
                assets: 2000,
                liabilities: 500
            }
        });
        expect(out.orchestrated.status).toBe("BLOCKED");
        expect(out.orchestrated.financial.status).toBe("BLOCKED");
        // explanation should still be produced
        expect(out.response.message).toContain("BLOCKED");
        expect(out.response.limitations).toBeDefined();
        expect(out.response.limitations!.length).toBeGreaterThan(0);
    });

    test("analyzeAcquisitionOpportunity rejects missing tenant", () => {
        const orchestrated = new OrchestratedDecisionIntelligenceService();
        const engine = new AssistantEngine({ orchestrated });
        expect(() =>
            engine.analyzeAcquisitionOpportunity("test", { ...validInput, tenantId: "" })
        ).toThrow("assistant-orchestration-tenant-required");
    });

    test("analyzeAcquisitionOpportunity rejects missing problem", () => {
        const orchestrated = new OrchestratedDecisionIntelligenceService();
        const engine = new AssistantEngine({ orchestrated });
        expect(() =>
            engine.analyzeAcquisitionOpportunity("", validInput)
        ).toThrow("assistant-orchestration-problem-required");
    });

    test("AssistantEngine does not duplicate financial math — all numbers come from the orchestrated service", () => {
        const orchestrated = new OrchestratedDecisionIntelligenceService();
        const engine = new AssistantEngine({ orchestrated });
        const out = engine.analyzeAcquisitionOpportunity("p", validInput);
        // Verify the explanation contains numbers that match the orchestrated result
        expect(out.response.message).toContain(`NPV=${out.orchestrated.financial.npv.toFixed(2)}`);
        expect(out.response.message).toContain(`score=${out.orchestrated.risk.score}`);
    });

    test("analyzeAcquisitionOpportunity preserves evidence/provenance fields", () => {
        const orchestrated = new OrchestratedDecisionIntelligenceService();
        const engine = new AssistantEngine({ orchestrated });
        const out = engine.analyzeAcquisitionOpportunity("p", validInput);
        expect(out.response.explanation).toBeDefined();
        expect(out.response.inputHash).toBeDefined();
        // evidence is on the response, not directly
    });
});
