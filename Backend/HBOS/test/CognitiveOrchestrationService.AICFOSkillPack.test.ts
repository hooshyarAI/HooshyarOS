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
