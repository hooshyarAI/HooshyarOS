import { Engine } from "../Core/Engine";
import { DecisionIntelligenceEngine } from "../Engines/DecisionIntelligenceEngine";

/**
 * Canonical product-layer owner for `product.decision-workbench`.
 *
 * Scope: explainable Expert Choice / multi-criteria decision evaluation. The
 * workbench composes the canonical DecisionIntelligenceEngine (AHP + TOPSIS)
 * and produces recommendation evidence (weights, consistency, ranking,
 * rationale, assumptions, limitations). It does NOT re-implement the engine
 * math and it does NOT execute a consequential decision: execution/approval is
 * the organizational-execution layer's responsibility.
 *
 * Roadmap owner: Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json
 *   capabilityId = product.decision-workbench
 *   targetEngine = Decision Intelligence Engine
 */

export interface DecisionCriterion {
    readonly name: string;
    /** Relative importance (> 0). Used when no AHP pairwise matrix is supplied. */
    readonly weight: number;
    /** "benefit" = higher is better; "cost" = lower is better. */
    readonly direction: "benefit" | "cost";
}

export interface DecisionWorkbenchInput {
    readonly tenantId: string;
    readonly problem: string;
    readonly alternatives: readonly string[];
    /** Raw scores: alternatives (rows) x criteria (columns). */
    readonly scores: readonly (readonly number[])[];
    readonly criteria: readonly DecisionCriterion[];
    /**
     * Optional AHP pairwise comparison matrix over the criteria (n x n).
     * When supplied it is the authoritative weights source and its consistency
     * is reported; criterion.weight values are ignored for weighting.
     */
    readonly pairwiseMatrix?: readonly (readonly number[])[];
}

export interface DecisionAlternativeEvaluation {
    readonly alternative: string;
    readonly rank: number;
    readonly closeness: number;
    readonly rawScores: readonly number[];
}

export interface DecisionRecommendation {
    readonly alternative: string;
    readonly alternativeIndex: number;
    readonly closeness: number;
    readonly rationale: string;
}

export interface DecisionWorkbenchResult {
    readonly capabilityId: "product.decision-workbench";
    readonly targetEngine: "Decision Intelligence Engine";
    readonly tenantId: string;
    readonly problem: string;
    readonly status: "READY" | "BLOCKED";
    readonly method: "EXPERT_CHOICE";
    readonly weightsSource: "AHP" | "DECLARED";
    readonly weights: readonly number[];
    readonly consistency: { readonly ratio: number; readonly consistent: boolean } | null;
    readonly evaluations: readonly DecisionAlternativeEvaluation[];
    readonly recommendation: DecisionRecommendation | null;
    readonly assumptions: readonly string[];
    readonly limitations: readonly string[];
}

const LIMITATIONS: readonly string[] = Object.freeze([
    "Multi-criteria ranking only; the workbench does not execute the decision.",
    "Human approval/governance is required before any consequential execution.",
    "Declared criterion weights are operator-provided and not pairwise-validated.",
]);

export class DecisionWorkbench implements Engine {
    name = "DecisionWorkbench";

    constructor(private readonly engine: DecisionIntelligenceEngine = new DecisionIntelligenceEngine()) {}

    initialize(): void {}

    health(): boolean {
        return true;
    }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return {
            id: "repair-product.decision-workbench",
            capability: "repair and re-verify knot product.decision-workbench from checkpoint 4c9aeefb",
            targetEngine: "Decision Intelligence Engine"
        };
    }

    execute(input: DecisionWorkbenchInput): DecisionWorkbenchResult {
        const tenantId = typeof input?.tenantId === "string" ? input.tenantId.trim() : "";
        if (!tenantId) return this.blocked(input, "decision-workbench-tenant-required");

        const problem = typeof input?.problem === "string" ? input.problem.trim() : "";
        if (!problem) return this.blocked(input, "decision-workbench-problem-required");

        const alternatives = Array.isArray(input?.alternatives) ? input.alternatives.map((a) => String(a).trim()) : [];
        if (alternatives.length < 2 || alternatives.some((a) => !a)) {
            return this.blocked(input, "decision-workbench-alternatives-invalid");
        }

        const rawCriteria = Array.isArray(input?.criteria) ? input.criteria : [];
        if (rawCriteria.length < 1) return this.blocked(input, "decision-workbench-criteria-required");
        if (rawCriteria.some((c) => !c || !String(c.name ?? "").trim() || !Number.isFinite(Number(c.weight)) || Number(c.weight) <= 0 || (c.direction !== "benefit" && c.direction !== "cost"))) {
            return this.blocked(input, "decision-workbench-criteria-invalid");
        }
        const criteria: readonly DecisionCriterion[] = rawCriteria.map((c) => ({
            name: String(c.name).trim(),
            weight: Number(c.weight),
            direction: c.direction,
        }));
        if (new Set(criteria.map((c) => c.name)).size !== criteria.length) {
            return this.blocked(input, "decision-workbench-criteria-duplicate");
        }

        const scores = Array.isArray(input?.scores) ? input.scores : [];
        if (scores.length !== alternatives.length || scores.some((row) => !Array.isArray(row) || row.length !== criteria.length || row.some((v) => !Number.isFinite(v)))) {
            return this.blocked(input, "decision-workbench-scores-invalid");
        }

        let weights: number[];
        let weightsSource: "AHP" | "DECLARED";
        let consistency: DecisionWorkbenchResult["consistency"] = null;

        if (input.pairwiseMatrix !== undefined) {
            const ahp = this.engine.ahp({ matrix: input.pairwiseMatrix });
            if (ahp.status !== "READY") return this.blocked(input, "decision-workbench-ahp-invalid");
            weights = ahp.weights;
            weightsSource = "AHP";
            consistency = { ratio: ahp.consistencyRatio, consistent: ahp.consistent };
        } else {
            const total = criteria.reduce((sum, c) => sum + c.weight, 0);
            if (!Number.isFinite(total) || total <= 0) return this.blocked(input, "decision-workbench-weights-invalid");
            weights = criteria.map((c) => c.weight / total);
            weightsSource = "DECLARED";
        }

        const topsis = this.engine.topsis({
            matrix: scores,
            weights,
            criteria: criteria.map((c) => c.direction),
        });
        if (topsis.status !== "READY" || topsis.bestIndex < 0) {
            return this.blocked(input, "decision-workbench-topsis-invalid");
        }

        const order = topsis.scores.map((closeness, index) => ({ index, closeness }))
            .sort((a, b) => (b.closeness - a.closeness) || (a.index - b.index));
        const rankByIndex = new Map<number, number>();
        order.forEach((entry, position) => rankByIndex.set(entry.index, position + 1));

        const evaluations: DecisionAlternativeEvaluation[] = alternatives.map((alternative, index) => ({
            alternative,
            rank: rankByIndex.get(index) ?? 0,
            closeness: topsis.scores[index],
            rawScores: [...scores[index]],
        }));

        const bestIndex = topsis.bestIndex;
        const consistencyText = consistency
            ? `AHP consistency ratio ${consistency.ratio.toFixed(4)} (${consistency.consistent ? "consistent" : "inconsistent"})`
            : "declared weights (no pairwise consistency check)";
        const rationalParts = [
            `Recommended "${alternatives[bestIndex]}" with TOPSIS closeness ${topsis.scores[bestIndex].toFixed(4)}`,
            `weights source: ${weightsSource}`,
            consistencyText,
            `criteria: ${criteria.map((c, i) => `${c.name}=${weights[i].toFixed(4)}(${c.direction})`).join(", ")}`,
        ];

        return {
            capabilityId: "product.decision-workbench",
            targetEngine: "Decision Intelligence Engine",
            tenantId,
            problem,
            status: "READY",
            method: "EXPERT_CHOICE",
            weightsSource,
            weights: [...weights],
            consistency,
            evaluations,
            recommendation: {
                alternative: alternatives[bestIndex],
                alternativeIndex: bestIndex,
                closeness: topsis.scores[bestIndex],
                rationale: rationalParts.join("; "),
            },
            assumptions: Object.freeze([
                "All alternative scores are measured on comparable numeric scales.",
                "Criterion directions are correctly declared as benefit or cost.",
                weightsSource === "AHP"
                    ? "Pairwise comparisons follow Saaty's reciprocal scale."
                    : "Declared criterion weights express relative importance.",
            ]),
            limitations: LIMITATIONS,
        };
    }

    private blocked(input: DecisionWorkbenchInput | undefined, _reason: string): DecisionWorkbenchResult {
        return {
            capabilityId: "product.decision-workbench",
            targetEngine: "Decision Intelligence Engine",
            tenantId: typeof input?.tenantId === "string" ? input.tenantId.trim() : "",
            problem: typeof input?.problem === "string" ? input.problem.trim() : "",
            status: "BLOCKED",
            method: "EXPERT_CHOICE",
            weightsSource: input?.pairwiseMatrix !== undefined ? "AHP" : "DECLARED",
            weights: [],
            consistency: null,
            evaluations: [],
            recommendation: null,
            assumptions: [],
            limitations: LIMITATIONS,
        };
    }
}
