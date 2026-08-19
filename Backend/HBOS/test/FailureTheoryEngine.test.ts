import { FailureTheoryEngine } from "../Engines/FailureTheoryEngine";

describe("FailureTheoryEngine", () => {
    const engine = new FailureTheoryEngine();

    const base = {
        id: "decision-1",
        bounds: {
            probabilityMin: 0.1,
            probabilityMax: 0.1,
            impactMin: 10,
            impactMax: 10,
            exposureMin: 1,
            exposureMax: 1,
        },
        confidence: 0.95,
        riskBudget: 2,
        reversible: true,
        detectable: true,
        evidenceObserved: true,
    } as const;

    it("accepts a stable observed result inside the owning risk budget", () => {
        const result = engine.assess(base);

        expect(result.status).toBe("SAFE");
        expect(result.expectedLoss).toBe(1);
        expect(result.worstCaseLoss).toBe(1);
        expect(result.uncertaintyPremium).toBe(0);
        expect(result.stable).toBe(true);
    });

    it("blocks missing or contradictory evidence instead of inventing a conclusion", () => {
        expect(engine.assess({ ...base, evidenceObserved: false }).status).toBe("BLOCKED");
        expect(engine.assess({ ...base, evidenceContradictory: true }).status).toBe("BLOCKED");
    });

    it("uses the worst-case bound and requests mitigation when expected loss looks safe but the plausible downside does not", () => {
        const result = engine.assess({
            ...base,
            bounds: {
                probabilityMin: 0.01,
                probabilityMax: 0.2,
                impactMin: 10,
                impactMax: 20,
                exposureMin: 1,
                exposureMax: 1,
            },
            riskBudget: 2,
        });

        expect(result.expectedLoss).toBe(0.1);
        expect(result.worstCaseLoss).toBe(4);
        expect(result.status).toBe("MITIGATE");
        expect(result.uncertaintyPremium).toBe(3.9);
    });

    it("marks a conclusion unstable when plausible uncertainty can change the result", () => {
        const result = engine.assess({
            ...base,
            bounds: {
                probabilityMin: 0.05,
                probabilityMax: 0.1,
                impactMin: 10,
                impactMax: 10,
                exposureMin: 1,
                exposureMax: 1,
            },
            riskBudget: 10,
        });

        expect(result.status).toBe("UNSTABLE");
        expect(result.stable).toBe(false);
        expect(result.dominantFactors).toContain("probability");
    });

    it("rejects a non-negotiable constraint independently of expected value", () => {
        const result = engine.assess({ ...base, hardConstraintViolation: true });
        expect(result.status).toBe("REJECTED");
    });
});
