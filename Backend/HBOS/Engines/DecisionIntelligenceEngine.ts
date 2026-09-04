import { Engine } from "../Core/Engine";

export interface AhpInput {
    /** Pairwise comparison matrix (n x n). Diagonal must be 1; reciprocals must hold. */
    matrix: readonly (readonly number[])[];
}

export interface AhpResult {
    method: "ahp";
    criteriaCount: number;
    /** Priority weights, length = n. */
    weights: number[];
    /** Maximum eigenvalue of the comparison matrix. */
    lambdaMax: number;
    /** Consistency Index = (lambdaMax - n) / (n - 1). */
    consistencyIndex: number;
    /** Consistency Ratio = CI / RI. RI is the random index for n criteria. */
    consistencyRatio: number;
    /** Whether CR <= 0.10. */
    consistent: boolean;
    status: "READY" | "BLOCKED";
}

/**
 * Random Index table (Saaty 1980) for n = 1..15.
 * CI of a randomly generated reciprocal matrix approximates these values.
 */
const RANDOM_INDEX: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0.58,
    4: 0.90,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
    11: 1.51,
    12: 1.48,
    13: 1.56,
    14: 1.57,
    15: 1.59
};

export interface TopsisInput {
    /** Decision matrix: m alternatives x n criteria. */
    matrix: readonly (readonly number[])[];
    /** Weight per criterion (length n). Sum need not be 1; will be normalized. */
    weights: readonly number[];
    /** Per-criterion direction: "benefit" (higher is better) or "cost" (lower is better). */
    criteria: ReadonlyArray<"benefit" | "cost">;
}

export interface TopsisResult {
    method: "topsis";
    alternativeCount: number;
    criteriaCount: number;
    /** Closeness coefficient per alternative, length m. Sum NOT required to be 1. */
    scores: number[];
    /** Index of the best alternative (highest closeness coefficient). */
    bestIndex: number;
    status: "READY" | "BLOCKED";
}

export interface DecisionTreeNode {
    /** Decision/branch label. */
    name: string;
    /** Probability of reaching this node (default 1 for the root). */
    probability?: number;
    /** Monetary outcome at this leaf (or at this node if no children). */
    value?: number;
    /** Children. */
    children?: DecisionTreeNode[];
}

export interface DecisionTreeResult {
    method: "decisionTree";
    /** Expected monetary value at the root. */
    expectedValue: number;
    status: "READY" | "BLOCKED";
}

export class DecisionIntelligenceEngine implements Engine {
    name = "DecisionIntelligenceEngine";

    initialize() {
        console.log("DecisionIntelligenceEngine Started");
        return {
            name: "DecisionIntelligenceEngine",
            status: "READY",
            health: "HEALTHY"
        };
    }

    health(): boolean {
        return true;
    }

    /**
     * 09-1.10 Analytic Hierarchy Process (AHP).
     * Computes the principal eigenvector (priority vector) of a pairwise
     * comparison matrix using the column-normalization approximation, then
     * reports lambdaMax, CI, CR and a consistency verdict.
     */
    ahp(input: AhpInput): AhpResult {
        const n = input?.matrix?.length;
        if (!input || !Array.isArray(input.matrix) || n === 0) {
            return { method: "ahp", criteriaCount: 0, weights: [], lambdaMax: 0, consistencyIndex: 0, consistencyRatio: 0, consistent: false, status: "BLOCKED" };
        }
        for (let i = 0; i < n; i += 1) {
            if (!Array.isArray(input.matrix[i]) || input.matrix[i].length !== n) {
                return { method: "ahp", criteriaCount: n, weights: [], lambdaMax: 0, consistencyIndex: 0, consistencyRatio: 0, consistent: false, status: "BLOCKED" };
            }
        }
        // Column sums
        const colSums = new Array<number>(n).fill(0);
        for (let j = 0; j < n; j += 1) {
            for (let i = 0; i < n; i += 1) {
                const v = input.matrix[i][j];
                if (!Number.isFinite(v) || v <= 0) {
                    return { method: "ahp", criteriaCount: n, weights: [], lambdaMax: 0, consistencyIndex: 0, consistencyRatio: 0, consistent: false, status: "BLOCKED" };
                }
                colSums[j] += v;
            }
        }
        for (let j = 0; j < n; j += 1) {
            if (colSums[j] === 0) {
                return { method: "ahp", criteriaCount: n, weights: [], lambdaMax: 0, consistencyIndex: 0, consistencyRatio: 0, consistent: false, status: "BLOCKED" };
            }
        }
        // Normalize columns and average rows
        const weights = new Array<number>(n).fill(0);
        for (let i = 0; i < n; i += 1) {
            let s = 0;
            for (let j = 0; j < n; j += 1) {
                s += input.matrix[i][j] / colSums[j];
            }
            weights[i] = s / n;
        }
        // Compute lambdaMax = avg((A * w) / w)
        let lambdaMax = 0;
        for (let i = 0; i < n; i += 1) {
            let row = 0;
            for (let j = 0; j < n; j += 1) {
                row += input.matrix[i][j] * weights[j];
            }
            lambdaMax += weights[i] === 0 ? 0 : row / weights[i];
        }
        lambdaMax /= n;
        const ci = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
        const ri = RANDOM_INDEX[n] ?? 1.59;
        const cr = ri === 0 ? 0 : ci / ri;
        return {
            method: "ahp",
            criteriaCount: n,
            weights,
            lambdaMax,
            consistencyIndex: ci,
            consistencyRatio: cr,
            consistent: cr <= 0.10,
            status: "READY"
        };
    }

    /**
     * 09-1.11 TOPSIS (Technique for Order of Preference by Similarity to Ideal Solution).
     * Vector-normalize the decision matrix, apply weights, compute positive/negative
     * ideal solutions, compute separation distances, and rank by closeness
     * coefficient C* = d- / (d+ + d-).
     */
    topsis(input: TopsisInput): TopsisResult {
        const m = input?.matrix?.length;
        const n = input?.weights?.length;
        if (!input || !Array.isArray(input.matrix) || !Array.isArray(input.weights) || m === 0 || n === 0) {
            return { method: "topsis", alternativeCount: 0, criteriaCount: 0, scores: [], bestIndex: -1, status: "BLOCKED" };
        }
        if (!Array.isArray(input.criteria) || input.criteria.length !== n) {
            return { method: "topsis", alternativeCount: m, criteriaCount: n, scores: [], bestIndex: -1, status: "BLOCKED" };
        }
        // Validate input matrix
        for (let i = 0; i < m; i += 1) {
            if (!Array.isArray(input.matrix[i]) || input.matrix[i].length !== n) {
                return { method: "topsis", alternativeCount: m, criteriaCount: n, scores: [], bestIndex: -1, status: "BLOCKED" };
            }
            for (let j = 0; j < n; j += 1) {
                if (!Number.isFinite(input.matrix[i][j])) {
                    return { method: "topsis", alternativeCount: m, criteriaCount: n, scores: [], bestIndex: -1, status: "BLOCKED" };
                }
            }
        }
        for (const w of input.weights) {
            if (!Number.isFinite(w) || w < 0) {
                return { method: "topsis", alternativeCount: m, criteriaCount: n, scores: [], bestIndex: -1, status: "BLOCKED" };
            }
        }
        // Vector normalization: r_ij = x_ij / sqrt(sum_i x_ij^2)
        const norm = new Array<number>(n).fill(0);
        for (let j = 0; j < n; j += 1) {
            for (let i = 0; i < m; i += 1) {
                norm[j] += input.matrix[i][j] * input.matrix[i][j];
            }
            norm[j] = Math.sqrt(norm[j]);
        }
        if (norm.some(v => v === 0 || !Number.isFinite(v))) {
            return { method: "topsis", alternativeCount: m, criteriaCount: n, scores: [], bestIndex: -1, status: "BLOCKED" };
        }
        // Normalize weights
        const wsum = input.weights.reduce((a, b) => a + b, 0);
        if (wsum === 0) {
            return { method: "topsis", alternativeCount: m, criteriaCount: n, scores: [], bestIndex: -1, status: "BLOCKED" };
        }
        const w = input.weights.map(x => x / wsum);
        // Weighted normalized matrix
        const v: number[][] = [];
        for (let i = 0; i < m; i += 1) {
            const row: number[] = [];
            for (let j = 0; j < n; j += 1) {
                row.push((input.matrix[i][j] / norm[j]) * w[j]);
            }
            v.push(row);
        }
        // Positive/negative ideal
        const aPlus: number[] = new Array(n).fill(0);
        const aMinus: number[] = new Array(n).fill(0);
        for (let j = 0; j < n; j += 1) {
            const col = v.map(r => r[j]);
            if (input.criteria[j] === "benefit") {
                aPlus[j] = Math.max(...col);
                aMinus[j] = Math.min(...col);
            } else {
                aPlus[j] = Math.min(...col);
                aMinus[j] = Math.max(...col);
            }
        }
        // Separation distances
        const dPlus: number[] = [];
        const dMinus: number[] = [];
        for (let i = 0; i < m; i += 1) {
            let sp = 0, sm = 0;
            for (let j = 0; j < n; j += 1) {
                sp += Math.pow(v[i][j] - aPlus[j], 2);
                sm += Math.pow(v[i][j] - aMinus[j], 2);
            }
            dPlus.push(Math.sqrt(sp));
            dMinus.push(Math.sqrt(sm));
        }
        const scores = dPlus.map((d, i) => {
            const denom = d + dMinus[i];
            return denom === 0 ? 0 : dMinus[i] / denom;
        });
        let bestIndex = 0;
        for (let i = 1; i < scores.length; i += 1) {
            if (scores[i] > scores[bestIndex]) bestIndex = i;
        }
        return { method: "topsis", alternativeCount: m, criteriaCount: n, scores, bestIndex, status: "READY" };
    }

    /**
     * 09-1.12 Decision tree expected monetary value (EMV).
     * Recursively computes E[value] at the root as
     *   EMV(node) = value if leaf; otherwise probability-weighted sum of EMV(children).
     * Multiplicative probabilities along the path are applied; a node with no
     * explicit probability is treated as 1 (the caller is responsible for
     * emitting a single parent with explicit probability for each branch).
     */
    decisionTree(root: DecisionTreeNode): DecisionTreeResult {
        if (!root || typeof root !== "object") {
            return { method: "decisionTree", expectedValue: 0, status: "BLOCKED" };
        }
        const visit = (node: DecisionTreeNode): number => {
            if (typeof node.value === "number" && (!Array.isArray(node.children) || node.children.length === 0)) {
                if (!Number.isFinite(node.value)) return Number.NaN;
                return node.value;
            }
            if (!Array.isArray(node.children) || node.children.length === 0) {
                return Number.NaN;
            }
            let acc = 0;
            for (const child of node.children) {
                const p = typeof child.probability === "number" ? child.probability : 1;
                if (!Number.isFinite(p) || p < 0) return Number.NaN;
                const childEv = visit(child);
                if (!Number.isFinite(childEv)) return Number.NaN;
                acc += p * childEv;
            }
            return acc;
        };
        const ev = visit(root);
        if (!Number.isFinite(ev)) {
            return { method: "decisionTree", expectedValue: 0, status: "BLOCKED" };
        }
        return { method: "decisionTree", expectedValue: ev, status: "READY" };
    }
}
