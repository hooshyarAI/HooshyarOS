import { IntelligenceEngine } from "../Engines/IntelligenceEngine";
import { IntelligenceContext } from "../Core/IntelligenceContract";

describe("IntelligenceEngine science-selection confidence boundary", () => {
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
