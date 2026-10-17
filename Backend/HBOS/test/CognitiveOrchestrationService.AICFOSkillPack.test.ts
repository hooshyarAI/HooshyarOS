import { CognitiveOrchestrationService } from "../Product/CognitiveOrchestrationService";

describe("AI CFO skill integration with cognitive orchestration", () => {
    test("maps a structured financial intent to the CFO pack and exposes its limits", () => {
        const result = new CognitiveOrchestrationService().orchestrate({
            tenantId: "tenant-cfo-skill-test",
            question: "Analyze financial statement",
            insight: null
        });

        expect(result.intent.primaryIntent).toBe("ANALYZE");
        expect(result.scienceSelection).not.toBeNull();
        expect(result.scienceSelection?.selected[0].domainId).toBe("ai-cfo-skill-pack");
        expect(result.scienceSelection?.status).toBe("PARTIAL");
        expect(result.limitations.some(value => value.includes("AI CFO"))).toBe(true);
        // Skill selection must not fabricate a financial result when no statement evidence exists.
        expect(result.executed.some(item => item.capability === "FINANCIAL_INTELLIGENCE" && item.status === "EXECUTED")).toBe(false);
    });

    test("does not route non-financial organizational intent to the CFO pack", () => {
        const result = new CognitiveOrchestrationService().orchestrate({
            tenantId: "tenant-org-skill-test",
            question: "organizational workflow",
            insight: null
        });

        expect(result.scienceSelection).toBeNull();
    });
});

import { IntelligenceEngine } from "../Engines/IntelligenceEngine";
import { IntelligenceContext } from "../Core/IntelligenceContract";

describe("AI CFO selection metadata confidence boundary", () => {
    const engine = new IntelligenceEngine();
    const context = (knowledgeItems: IntelligenceContext["knowledgeItems"]): IntelligenceContext => ({
        knowledgeItems,
        evidenceItems: []
    });

    test("science-selection metadata alone cannot establish reasoning confidence", () => {
        const result = engine.reason(
            { problem: "general strategic question" },
            context([{
                id: "science-selection:ai-cfo-skill-pack",
                title: "AI CFO skill selection",
                description: "Planning metadata only",
                confidence: 0.8,
                source: "KnowledgeEngine.planScienceSelection",
                createdAt: new Date().toISOString()
            }])
        );

        expect(result.confidence).toEqual({ source: "unavailable" });
        expect(result.status).toBe("insufficient_context");
    });

    test("confidence from substantive knowledge remains available", () => {
        const result = engine.reason(
            { problem: "general strategic question" },
            context([{
                id: "knowledge:financial-basics",
                title: "Financial basics",
                description: "Substantive knowledge item",
                confidence: 0.8,
                source: "KnowledgeEngine",
                createdAt: new Date().toISOString()
            }])
        );

        expect(result.confidence.source).toBe("calculated");
        if (result.confidence.source === "calculated") {
            expect(result.confidence.value).toBe(0.8);
            expect(result.confidence.formula).toBe("average_knowledge_confidence");
        }
    });
});
