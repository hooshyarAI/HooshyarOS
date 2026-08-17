import { CapabilityGateEvaluator } from "./CapabilityGateEvaluator";

describe("CapabilityGateEvaluator", () => {
    const evaluator = new CapabilityGateEvaluator();

    it("requires evidence before any advancement", () => {
        const result = evaluator.evaluate({
            capability: "financial-ingestion",
            stage: "IMPLEMENTED",
            evidence: [],
        });
        expect(result.nextStage).toBe("BEHAVIORALLY_VERIFIED");
        expect(result.blockers).toEqual(["No evidence supplied"]);
        expect(evaluator.canAdvance({ capability: "financial-ingestion", stage: "IMPLEMENTED", evidence: [] }, "BEHAVIORALLY_VERIFIED")).toBe(false);
    });

    it("allows only evidence-backed stages and never skips backwards", () => {
        const input = {
            capability: "financial-ingestion",
            stage: "INTEGRATION_VERIFIED" as const,
            evidence: ["e2e-test", "restart-recovery"],
        };
        expect(evaluator.evaluate(input).nextStage).toBe("PRODUCTION_VERIFIED");
        expect(evaluator.canAdvance(input, "BEHAVIORALLY_VERIFIED")).toBe(true);
        expect(evaluator.canAdvance(input, "PRODUCTION_VERIFIED")).toBe(false);
        expect(evaluator.canAdvance(input, "INTEGRATION_VERIFIED")).toBe(true);
    });
});
