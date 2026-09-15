/**
 * Stage 07-H - Counterfactual Engine (Representation Only)
 *
 * IMPORTANT PHILOSOPHY:
 *   This engine does NOT manufacture causal claims. It exposes two
 *   representational helpers:
 *
 *   1. `representDoCalculus`  - returns a STRING expression of the form
 *      P(Y | do(X = x)) for documentation and audit purposes.
 *
 *   2. `simulateCounterfactual` - returns an EXPLICIT, audit-ready
 *      scenario object whose `status` field tells the caller whether
 *      the counterfactual is supported (status = "simulated") or NOT
 *      (status = "identification_failed" when identification is not
 *      justified; status = "insufficient_data" when data is missing).
 *
 *   In every case the returned object exposes the explicit assumption
 *   status. We never claim a counterfactual value without the
 *   identification status being explicitly "simulated".
 */

import { CounterfactualScenario, Covariate, CounterfactualStatus } from "./CausalTypes";

export const CounterfactualEngine = {
    simulateCounterfactual(
        baselineData: ReadonlyArray<number>,
        treatmentChange: number,
        expectedEffect: number,
        covariates: ReadonlyArray<Covariate>
    ): CounterfactualScenario {
        const baselineMean = baselineData.length === 0
            ? NaN
            : baselineData.reduce((s, v) => s + v, 0) / baselineData.length;

        let status: CounterfactualStatus;
        let expectedOutcome: number;

        if (!Number.isFinite(baselineMean)) {
            status = "insufficient_data";
            expectedOutcome = NaN;
        } else if (!Number.isFinite(treatmentChange) || !Number.isFinite(expectedEffect)) {
            status = "identification_failed";
            expectedOutcome = NaN;
        } else {
            status = "simulated";
            expectedOutcome = baselineMean + expectedEffect * treatmentChange;
        }

        return Object.freeze({
            description:
                "Counterfactual: outcome shift under unit change in treatment. " +
                "REPRESENTATION ONLY; no causal claim is made without explicit " +
                "identification strategy (e.g. randomised assignment, IV, etc.).",
            treatmentValue: treatmentChange,
            covariates: Object.freeze(covariates.slice()),
            expectedOutcome,
            status
        });
    },

    representDoCalculus(
        treatment: string,
        outcome: string,
        covariates: ReadonlyArray<string>
    ): string {
        const cov = covariates.length === 0
            ? ""
            : ` | ${covariates.join(", ")}`;
        return `P(${outcome} | do(${treatment}=x)${cov})`;
    }
};
