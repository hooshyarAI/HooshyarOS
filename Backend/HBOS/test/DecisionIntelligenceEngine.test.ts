import { DecisionIntelligenceEngine } from "../Engines/DecisionIntelligenceEngine";

const safeAssessment = {
    failureModes: ["incorrect-input"],
    evidence: ["verified-runtime-observation"],
    evidenceConfidence: 0.9,
    independentVerification: true,
    contradiction: false,
    expectedLoss: 10,
    worstCaseLoss: 20,
    riskBudget: 25,
    sensitivityStable: true,
    reversible: true,
    detectable: true
};

describe("DecisionIntelligenceEngine", () => {
    test("engine should initialize", () => {
        const engine = new DecisionIntelligenceEngine();

        expect(engine.initialize().status).toBe("READY");
    });

    test("material decisions must pass the Failure Theory gate", () => {
        const engine = new DecisionIntelligenceEngine();

        const safe = engine.evaluate({
            material: true,
            failureTheory: safeAssessment
        });

        expect(safe.approved).toBe(true);
        expect(safe.status).toBe("SAFE");
        expect(safe.failureTheory.uncertaintyPremium).toBe(10);

        const blocked = engine.evaluate({
            material: true,
            failureTheory: {
                ...safeAssessment,
                independentVerification: false
            }
        });

        expect(blocked.approved).toBe(false);
        expect(blocked.status).toBe("BLOCKED");
        expect(blocked.failureTheory.reasons).toContain("independent-verification-unavailable");

        const rejected = engine.evaluate({
            material: true,
            failureTheory: {
                ...safeAssessment,
                worstCaseLoss: 40,
                riskBudget: 25
            }
        });

        expect(rejected.approved).toBe(false);
        expect(rejected.status).toBe("REJECTED");
    });
});
