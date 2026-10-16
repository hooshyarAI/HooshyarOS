import { KnowledgeEngine } from "../Engines/KnowledgeEngine";

describe("AI CFO skill pack — governed KnowledgeEngine selection", () => {
    test("registers CFO advisory as a skill pack, not a new canonical engine", () => {
        const engine = new KnowledgeEngine();
        const skillPack = engine.getScienceDomain("ai-cfo-skill-pack");

        expect(engine.name).toBe("KnowledgeEngine");
        expect(skillPack).toBeDefined();
        expect(skillPack?.readiness).toBe("PARTIAL");
        expect(skillPack?.signals).toContain("cfo-advisory");
        expect(skillPack?.owner).toContain("KnowledgeEngine");
        expect(skillPack?.availableOperations).toContain("FinancialIntelligenceEngine.workingCapital");
        expect(skillPack?.availableOperations).toContain("BudgetIntelligenceEngine.analyzeBudget");
        expect(skillPack?.availableOperations).toContain("RiskIntelligenceEngine.scenario");
        expect(skillPack?.limitations.join(" ")).toContain("Governance");
    });

    test("routes CFO intent to existing financial, budget, risk and evidence guardrails", () => {
        const plan = new KnowledgeEngine().planScienceSelection({
            signals: [
                "cfo-advisory",
                "financial-performance",
                "cash-flow",
                "budget-planning",
                "scenario-analysis",
                "internal-control",
                "data-quality"
            ]
        });

        expect(plan.status).toBe("PARTIAL");
        expect(plan.requiresReview).toBe(true);
        expect(plan.requestedSignals).toContain("cfo-advisory");

        const selectedIds = plan.selected.map(item => item.domainId);
        expect(selectedIds).toContain("ai-cfo-skill-pack");
        expect(selectedIds).toContain("financial-management");
        expect(selectedIds).toContain("budget-management");
        expect(selectedIds).toContain("risk-uncertainty-analysis");
        expect(selectedIds).toContain("tax-accounting-audit");
        expect(selectedIds).toContain("internal-control");
        expect(selectedIds).toContain("data-analytics-management");

        const cfo = plan.selected.find(item => item.domainId === "ai-cfo-skill-pack");
        expect(cfo?.role).toBe("PRIMARY");
        expect(cfo?.matchingSignals).toContain("cfo-advisory");
        expect(cfo?.availableOperations).toContain("FinancialStatementAnalysisService.execute");
        expect(cfo?.limitations.length).toBeGreaterThan(0);
    });

    test("does not claim a complete CFO workflow merely because the skill pack is registered", () => {
        const plan = new KnowledgeEngine().planScienceSelection({ signals: ["cfo-advisory"] });
        expect(plan.status).toBe("PARTIAL");
        expect(plan.requiresReview).toBe(true);
        expect(plan.status).not.toBe("READY");
    });
});
