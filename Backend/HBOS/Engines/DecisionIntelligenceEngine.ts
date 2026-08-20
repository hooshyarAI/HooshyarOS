import {
    FailureTheoryAssessment,
    FailureTheoryEngine,
    FailureTheoryResult
} from "./FailureTheoryEngine";

export interface DecisionIntelligenceInput {
    material: boolean;
    failureTheory: FailureTheoryAssessment;
}

export interface DecisionIntelligenceResult {
    approved: boolean;
    status: FailureTheoryResult["status"];
    failureTheory: FailureTheoryResult;
}

export class DecisionIntelligenceEngine {
    private readonly failureTheoryEngine = new FailureTheoryEngine();

    initialize() {
        console.log("DecisionIntelligenceEngine Started");

        return {
            name: "DecisionIntelligenceEngine",
            status: "READY",
            health: "HEALTHY"
        };
    }

    evaluate(input: DecisionIntelligenceInput): DecisionIntelligenceResult {
        if (!input || !input.material) {
            const failureTheory = this.failureTheoryEngine.evaluate(input?.failureTheory);
            return {
                approved: failureTheory.status === "SAFE",
                status: failureTheory.status,
                failureTheory
            };
        }

        const failureTheory = this.failureTheoryEngine.evaluate(input.failureTheory);

        return {
            approved: failureTheory.status === "SAFE",
            status: failureTheory.status,
            failureTheory
        };
    }
}
