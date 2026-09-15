/**
 * Stage 07-H - Causal Type Definitions
 *
 * Type contracts for the causal analysis capability. Every causal result
 * exposes its identification assumptions; no causal claim is ever made
 * from correlation alone.
 *
 * IMPORTANT:
 *  - Correlation != Causation. All types here force the consumer to
 *    inspect `assumptions` and `assumptionsViolated` before treating
 *    any effect as a causal effect.
 *  - No double-ML, no IV, no RDD, no DiD, no synthetic control.
 *  - Tenant isolation is enforced at the engine boundary.
 *  - Deterministic.
 */

export type TreatmentType = "binary" | "continuous";
export type VariableType = "binary" | "continuous" | "categorical";

export interface TreatmentVariable {
    readonly name: string;
    readonly type: TreatmentType;
    readonly values: ReadonlyArray<number>;
}

export interface OutcomeVariable {
    readonly name: string;
    readonly type: VariableType;
    readonly values: ReadonlyArray<number>;
}

export interface Covariate {
    readonly name: string;
    readonly type: VariableType;
    readonly values: ReadonlyArray<number>;
}

export interface CausalAssumptions {
    readonly unconfoundedness: boolean;
    readonly positivity: boolean;
    readonly consistency: boolean;
    readonly noInterference: boolean;
    readonly model: string;
}

export interface CausalEstimand {
    readonly ate: number;
    readonly att: number;
    readonly atc?: number;
    readonly description: string;
}

export interface CausalEffect {
    readonly pointEstimate: number;
    readonly standardError: number;
    readonly confidenceInterval: { readonly lower: number; readonly upper: number };
    readonly pValue: number;
    readonly method: string;
    readonly assumptionsViolated: boolean;
}

export type CausalStatus =
    | "identified"
    | "insufficient_data"
    | "invalid_request"
    | "unavailable"
    | "assumptions_violated";

export interface CausalProvenance {
    readonly source: string;
    readonly tenant: string;
    readonly method: string;
    readonly calculatedAt: string;
}

export interface CausalResult {
    readonly tenantId: string;
    readonly metricName: string;
    readonly treatment: TreatmentVariable;
    readonly outcome: OutcomeVariable;
    readonly effect: CausalEffect;
    readonly assumptions: CausalAssumptions;
    readonly status: CausalStatus;
    readonly provenance: CausalProvenance;
}

export type CounterfactualStatus =
    | "simulated"
    | "identification_failed"
    | "insufficient_data";

export interface CounterfactualScenario {
    readonly description: string;
    readonly treatmentValue: number;
    readonly covariates: ReadonlyArray<Covariate>;
    readonly expectedOutcome: number;
    readonly status: CounterfactualStatus;
}
