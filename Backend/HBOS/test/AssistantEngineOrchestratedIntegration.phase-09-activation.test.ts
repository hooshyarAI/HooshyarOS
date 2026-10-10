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

    test("analyzeAcquisitionOpportunity exposes PARTIAL quality status when math is READY but qualification is pending", () => {
        const orchestrated = new OrchestratedDecisionIntelligenceService();
        const engine = new AssistantEngine({ orchestrated });
        const out = engine.analyzeAcquisitionOpportunity(
            "Should we acquire Company Y?",
            validInput
        );
        expect(out.orchestrated.status).toBe("PARTIAL");
        expect(out.orchestrated.executionStatus).toBe("READY");
        expect(out.orchestrated.quality.status).toBe("REVIEW_REQUIRED");
        expect(out.response.message).toContain("Overall: PARTIAL");
        expect(out.response.message).toContain("Quality: REVIEW_REQUIRED");
        expect(out.response.limitations).toContain("Decision confidence is unavailable because the quality gate has not qualified this result.");
        expect(out.response.confidence).toBeUndefined();
        expect(out.response.traceId).toBe(out.orchestrated.quality.provenance.traceId);
        expect(out.orchestrated.financial.status).toBe("READY");
        expect(out.orchestrated.risk.status).toBe("READY");
        expect(out.orchestrated.decision.status).toBe("READY");
        expect(out.response.message).toContain("Financial:");
        expect(out.response.message).toContain("Risk:");
        expect(out.response.message).toContain("Decision:");
        expect(out.response.message).toContain("Sciences:");
    });

    test("AssistantEngine surfaces Expert Choice recommendation in its interpreted response", () => {
        const engine = new AssistantEngine();
        const out = engine.analyzeAcquisitionOpportunity("Choose expansion", {
            ...validInput,
            problem: "Choose expansion",
            decision: {
                ...validInput.decision,
                expertChoice: {
                    alternatives: ["Expansion A", "Expansion B"],
                    criteria: [
                        { name: "profit", weight: 0.6, direction: "benefit" as const },
                        { name: "risk", weight: 0.4, direction: "cost" as const }
                    ],
                    scores: [[8, 4], [6, 3]]
                }
            }
        });

        expect(out.orchestrated.decision.expertChoice?.status).toBe("READY");
        expect(out.response.message).toContain("Expert Choice: Expansion A");
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
