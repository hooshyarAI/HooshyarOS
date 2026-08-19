export type FailureTheoryStatus = "SAFE" | "MITIGATE" | "UNSTABLE" | "REJECTED" | "BLOCKED";

export interface FailureTheoryBounds {
    readonly probabilityMin: number;
    readonly probabilityMax: number;
    readonly impactMin: number;
    readonly impactMax: number;
    readonly exposureMin: number;
    readonly exposureMax: number;
}

export interface FailureTheoryAssessment {
    readonly status: FailureTheoryStatus;
    readonly expectedLoss: number;
    readonly worstCaseLoss: number;
    readonly uncertaintyPremium: number;
    readonly confidence: number;
    readonly stable: boolean;
    readonly dominantFactors: readonly string[];
    readonly reason: string;
}

export interface FailureTheoryInput {
    readonly id: string;
    readonly bounds: FailureTheoryBounds;
    readonly confidence: number;
    readonly riskBudget: number;
    readonly reversible: boolean;
    readonly detectable: boolean;
    readonly evidenceObserved: boolean;
    readonly evidenceContradictory?: boolean;
    readonly hardConstraintViolation?: boolean;
}

/**
 * Canonical failure-theory control layer for material computation, analysis and decisions.
 * It does not invent business thresholds; the owning capability supplies its risk budget.
 */
export class FailureTheoryEngine {
    assess(input: FailureTheoryInput): FailureTheoryAssessment {
        this.validate(input);

        if (!input.evidenceObserved || input.evidenceContradictory) {
            return this.blocked("Required evidence is missing or contradictory.");
        }

        if (input.hardConstraintViolation) {
            return this.assessment("REJECTED", input, 0, 0, false, ["hard-constraint"], "A non-negotiable constraint is violated.");
        }

        const { bounds } = input;
        const expectedLoss = bounds.probabilityMin * bounds.impactMin * bounds.exposureMin;
        const worstCaseLoss = bounds.probabilityMax * bounds.impactMax * bounds.exposureMax;
        const uncertaintyPremium = Math.max(0, worstCaseLoss - expectedLoss);
        const stable = this.isStable(input, expectedLoss, worstCaseLoss);
        const dominantFactors = this.dominantFactors(input);

        if (worstCaseLoss > input.riskBudget) {
            return this.assessment(
                input.reversible && input.detectable ? "MITIGATE" : "BLOCKED",
                input,
                expectedLoss,
                worstCaseLoss,
                stable,
                dominantFactors,
                input.reversible && input.detectable
                    ? "Worst-case loss exceeds the owning risk budget; mitigation is required before acceptance."
                    : "Worst-case loss exceeds the owning risk budget and the failure is not sufficiently reversible/detectable.",
            );
        }

        if (!stable) {
            return this.assessment("UNSTABLE", input, expectedLoss, worstCaseLoss, false, dominantFactors, "Declared uncertainty can change the conclusion.");
        }

        if (uncertaintyPremium > 0 || input.confidence < 0.8 || !input.reversible || !input.detectable) {
            return this.assessment("MITIGATE", input, expectedLoss, worstCaseLoss, true, dominantFactors, "Material residual uncertainty, confidence or recovery exposure requires mitigation.");
        }

        return this.assessment("SAFE", input, expectedLoss, worstCaseLoss, true, dominantFactors, "Observed evidence and declared bounds remain within the owning risk budget.");
    }

    private isStable(input: FailureTheoryInput, expectedLoss: number, worstCaseLoss: number): boolean {
        if (worstCaseLoss === expectedLoss) return true;
        if (input.riskBudget <= 0) return false;
        return worstCaseLoss <= input.riskBudget && worstCaseLoss <= expectedLoss * 1.25;
    }

    private dominantFactors(input: FailureTheoryInput): readonly string[] {
        const { bounds } = input;
        const factors = [
            { name: "probability", spread: bounds.probabilityMax - bounds.probabilityMin },
            { name: "impact", spread: bounds.impactMax - bounds.impactMin },
            { name: "exposure", spread: bounds.exposureMax - bounds.exposureMin },
            { name: "confidence", spread: 1 - input.confidence },
            { name: "reversibility", spread: input.reversible ? 0 : 1 },
            { name: "detectability", spread: input.detectable ? 0 : 1 },
        ];
        return factors
            .sort((a, b) => b.spread - a.spread || a.name.localeCompare(b.name))
            .filter(factor => factor.spread > 0)
            .slice(0, 3)
            .map(factor => factor.name);
    }

    private assessment(
        status: FailureTheoryStatus,
        input: FailureTheoryInput,
        expectedLoss: number,
        worstCaseLoss: number,
        stable: boolean,
        dominantFactors: readonly string[],
        reason: string,
    ): FailureTheoryAssessment {
        return {
            status,
            expectedLoss,
            worstCaseLoss,
            uncertaintyPremium: Math.max(0, worstCaseLoss - expectedLoss),
            confidence: input.confidence,
            stable,
            dominantFactors,
            reason,
        };
    }

    private blocked(reason: string): FailureTheoryAssessment {
        return {
            status: "BLOCKED",
            expectedLoss: 0,
            worstCaseLoss: 0,
            uncertaintyPremium: 0,
            confidence: 0,
            stable: false,
            dominantFactors: [],
            reason,
        };
    }

    private validate(input: FailureTheoryInput): void {
        if (!input?.id?.trim()) throw new Error("failure-theory-id-required");
        const { bounds } = input;
        const values = [
            bounds?.probabilityMin,
            bounds?.probabilityMax,
            bounds?.impactMin,
            bounds?.impactMax,
            bounds?.exposureMin,
            bounds?.exposureMax,
            input.confidence,
            input.riskBudget,
        ];
        if (values.some(value => !Number.isFinite(value))) throw new Error("failure-theory-numeric-input-invalid");
        if (bounds.probabilityMin < 0 || bounds.probabilityMax > 1 || bounds.probabilityMin > bounds.probabilityMax) {
            throw new Error("failure-theory-probability-bounds-invalid");
        }
        if (bounds.impactMin < 0 || bounds.impactMin > bounds.impactMax || bounds.exposureMin < 0 || bounds.exposureMin > bounds.exposureMax) {
            throw new Error("failure-theory-bounds-invalid");
        }
        if (input.confidence < 0 || input.confidence > 1 || input.riskBudget < 0) {
            throw new Error("failure-theory-confidence-or-budget-invalid");
        }
    }
}
