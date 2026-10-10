import { KnowledgeEngine } from "../Engines/KnowledgeEngine";
import { MemoryEvent } from "../Entities/MemoryEvent";

test("KnowledgeEngine learns from memory event", () => {

    const engine =
        new KnowledgeEngine();


    const event =
        new MemoryEvent(
            "PROJECT_CREATED",
            "ProjectPilot",
            "HBOS Core"
        );


    const knowledge =
        engine.learn(
            event
        );


    expect(knowledge.title)
        .toBe("PROJECT_CREATED");


    expect(engine.count())
        .toBe(1);

});

describe("KnowledgeEngine science registry", () => {
    test("registers requested science domains and differentiates real from unimplemented operations", () => {
        const engine = new KnowledgeEngine();
        const domains = engine.getScienceDomains();

        expect(domains.map(domain => domain.id)).toEqual(expect.arrayContaining([
            "statistics-probability",
            "financial-management",
            "financial-engineering",
            "data-analysis",
            "data-analytics-management",
            "decision-science",
            "strategic-management",
            "operations-research-optimization",
            "forecasting-scenario-analysis",
            "risk-uncertainty-analysis",
            "causal-reasoning",
            "organizational-process-design",
            "governance-compliance",
            "systems-engineering-reliability",
            "planning-methods",
            "budget-management",
            "general-management",
            "executive-management",
            "organizational-theory-design",
            "systems-thinking",
            "fundamental-analysis",
            "technical-analysis",
            "applied-analysis",
            "clear-thinking-critical-reasoning",
            "tax-accounting-audit",
            "internal-control",
            "quality-control",
            "business-management",
            "sales-management",
            "opportunity-cost-analysis"
        ]));

        expect(engine.getScienceDomain("financial-engineering")?.availableOperations)
            .toContain("FinancialIntelligenceEngine.npv");
        expect(engine.getScienceDomain("decision-science")?.availableOperations)
            .toContain("DecisionIntelligenceEngine.topsis");
        expect(engine.getScienceDomain("decision-science")?.availableOperations)
            .toContain("DecisionWorkbench.execute (Expert Choice)");
        expect(engine.getScienceDomain("strategic-management")?.readiness)
            .toBe("REGISTERED_ONLY");
        expect(engine.getScienceDomain("causal-reasoning")?.availableOperations)
            .toHaveLength(0);

        expect(engine.getScienceDomain("budget-management")?.availableOperations)
            .toContain("BudgetIntelligenceEngine.analyzeBudget");
        expect(engine.getScienceDomain("fundamental-analysis")?.availableOperations)
            .toContain("FinancialStatementAnalysisService.execute");
        expect(engine.getScienceDomain("tax-accounting-audit")?.availableOperations)
            .toContain("TaxIntelligenceEngine.estimate");
        expect(engine.getScienceDomain("quality-control")?.availableOperations)
            .toContain("DataQualityProfiler.isQualitySufficient");

        expect(engine.getScienceDomain("technical-analysis")?.readiness)
            .toBe("REGISTERED_ONLY");
        expect(engine.getScienceDomain("technical-analysis")?.availableOperations)
            .toHaveLength(0);
        expect(engine.getScienceDomain("sales-management")?.readiness)
            .toBe("REGISTERED_ONLY");
        expect(engine.getScienceDomain("sales-management")?.availableOperations)
            .toHaveLength(0);
        expect(engine.getScienceDomain("opportunity-cost-analysis")?.readiness)
            .toBe("REGISTERED_ONLY");
        expect(engine.getScienceDomain("opportunity-cost-analysis")?.availableOperations)
            .toHaveLength(0);
    });

    test("selects relevant sciences deterministically and adds cross-cutting guardrails", () => {
        const engine = new KnowledgeEngine();

        const first = engine.planScienceSelection({
            signals: ["capital-allocation", "risk-assessment", "forecasting"]
        });
        const second = engine.planScienceSelection({
            signals: ["capital-allocation", "risk-assessment", "forecasting"]
        });

        expect(first.status).toBe("PARTIAL");
        expect(first.selected.map(item => item.domainId))
            .toEqual(second.selected.map(item => item.domainId));
        expect(first.selected[0].role).toBe("PRIMARY");
        expect(first.selected.map(item => item.domainId)).toEqual(expect.arrayContaining([
            "financial-engineering",
            "decision-science",
            "risk-uncertainty-analysis",
            "forecasting-scenario-analysis",
            "data-analytics-management",
            "systems-engineering-reliability"
        ]));
        expect(first.requiresReview).toBe(true);
    });

    test("fails closed when no supported problem signal is supplied", () => {
        const engine = new KnowledgeEngine();

        expect(engine.planScienceSelection({ signals: [] }).status).toBe("BLOCKED");
        expect(engine.planScienceSelection({
            signals: ["unknown-signal" as never]
        }).status).toBe("BLOCKED");
        expect(engine.planScienceSelection({
            signals: ["data-analysis", "unknown-signal" as never]
        }).unresolvedSignals).toContain("unknown-signal");
    });


    test("recognizes requested science signals without promoting registered-only areas", () => {
        const engine = new KnowledgeEngine();
        const plan = engine.planScienceSelection({
            signals: [
                "technical-analysis",
                "budgeting",
                "sales-management",
                "opportunity-cost",
                "clear-thinking",
                "systems-thinking",
                "tax-accounting",
                "internal-control",
                "quality-control",
                "organizational-design",
                "executive-management",
                "general-management",
                "planning",
                "fundamental-analysis",
                "applied-analysis"
            ]
        });

        expect(plan.requestedSignals).toHaveLength(15);
        expect(plan.unresolvedSignals).toEqual([]);
        expect(plan.status).toBe("PARTIAL");
        expect(plan.requiresReview).toBe(true);
        expect(plan.selected.map(item => item.domainId)).toEqual(expect.arrayContaining([
            "technical-analysis",
            "budget-management",
            "sales-management",
            "opportunity-cost-analysis",
            "clear-thinking-critical-reasoning",
            "systems-thinking",
            "tax-accounting-audit",
            "internal-control",
            "quality-control",
            "organizational-theory-design",
            "executive-management",
            "general-management",
            "planning-methods",
            "fundamental-analysis",
            "applied-analysis"
        ]));
        expect(plan.selected.find(item => item.domainId === "technical-analysis")?.availableOperations)
            .toEqual([]);
        expect(plan.selected.find(item => item.domainId === "technical-analysis")?.readiness)
            .toBe("REGISTERED_ONLY");
    });

    test("catalog reads are isolated from caller mutation", () => {
        const engine = new KnowledgeEngine();
        const firstRead = engine.getScienceDomains();
        const target = firstRead.find(domain => domain.id === "decision-science");

        if (!target) throw new Error("decision-science registration missing");
        (target.availableOperations as string[]).push("fake.operation");

        expect(engine.getScienceDomain("decision-science")?.availableOperations)
            .not.toContain("fake.operation");
    });
});
