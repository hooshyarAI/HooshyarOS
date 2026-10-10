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
            "systems-engineering-reliability"
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
