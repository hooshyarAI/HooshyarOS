/**
 * Stage 07-J - Evaluation / Explainability Types
 *
 * Canonical type contracts for model evaluation records, drift detection,
 * feature contribution explanations, assumption validation, and evaluation
 * provenance.
 *
 * IMPORTANT:
 * - All interfaces are readonly; objects are frozen at construction.
 * - Tenant isolation enforced at every boundary.
 * - No fabricated confidence; confidence must be explicitly set.
 * - Deterministic: identical inputs produce identical outputs.
 */

export interface MethodIdentifier {
    readonly name: string;
    readonly version: string;
    readonly category: "statistical" | "ml" | "optimization" | "causal" | "nlp" | "monte_carlo";
    readonly description: string;
}

export interface EvaluationMetric {
    readonly name: string;
    readonly value: number;
    readonly direction: "higher_is_better" | "lower_is_better";
    readonly baselineValue?: number;
}

export interface BaselineComparison {
    readonly baselineMethod: string;
    readonly baselineMetrics: ReadonlyArray<EvaluationMetric>;
    readonly improvement: number;
    readonly isImprovement: boolean;
}

export interface CalibrationSummary {
    readonly applicable: boolean;
    readonly empiricalCoverage?: number;
    readonly coverageError?: number;
    readonly status?: "calibrated" | "under-covered" | "over-covered" | "insufficient_data" | "not_applicable";
}

export interface DriftIndicator {
    readonly metric: string;
    readonly baselineValue: number;
    readonly currentValue: number;
    readonly driftScore: number;
    readonly threshold: number;
    readonly isDrift: boolean;
}

export interface FeatureContribution {
    readonly feature: string;
    readonly contribution: number;
    readonly direction: "positive" | "negative";
    readonly magnitude: number;
}

export interface ExplanationEvidence {
    readonly method: "coefficients" | "permutation" | "ablation" | "analytical";
    readonly contributions: ReadonlyArray<FeatureContribution>;
    readonly confidence: number;
}

export interface MethodAssumption {
    readonly description: string;
    readonly isValid: boolean;
    readonly validationNote: string;
}

export interface MethodLimitation {
    readonly description: string;
    readonly severity: "info" | "warning" | "critical";
}

export interface EvaluationProvenance {
    readonly source: string;
    readonly tenant: string;
    readonly method: string;
    readonly evaluationWindow: {
        readonly start: string;
        readonly end: string;
    };
    readonly calculatedAt: string;
}

export interface EvaluationRecord {
    readonly methodId: MethodIdentifier;
    readonly dataset: string;
    readonly metrics: ReadonlyArray<EvaluationMetric>;
    readonly baselineComparison?: BaselineComparison;
    readonly calibration?: CalibrationSummary;
    readonly drift: ReadonlyArray<DriftIndicator>;
    readonly assumptions: ReadonlyArray<MethodAssumption>;
    readonly limitations: ReadonlyArray<MethodLimitation>;
    readonly timestamp: string;
    readonly provenance: EvaluationProvenance;
}
