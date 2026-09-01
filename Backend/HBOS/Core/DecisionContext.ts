/**
 * DecisionContext - Evidence/Reasoning Transport Contract
 *
 * Carries reasoning evidence into the DecisionEngine boundary without
 * coupling DecisionEngine to ReasoningEngine.
 *
 * Design principles:
 * - Read-only: evidence cannot be mutated after creation
 * - Optional fields: explicitly unavailable when no evidence exists
 * - No fabrication: only carries what is actually provided
 */

/**
 * Evidence context that can be supplied to DecisionEngine.
 * When a field is undefined, the evidence is explicitly unavailable.
 */
export interface DecisionContext {
    /** Unique trace identifier for the reasoning operation */
    readonly traceId?: string;
    /** Hash of the input that was processed */
    readonly inputHash?: string;
    /** Reference to the reasoning result/operation */
    readonly reasoningRef?: string;
    /** Human-readable explanation of the reasoning */
    readonly explanation?: string;
    /** Confidence score [0, 1] when actually known, undefined otherwise */
    readonly confidence?: number;
    /** Known limitations of the reasoning */
    readonly limitations?: readonly string[];
}

/**
 * Factory for creating DecisionContext instances.
 */
export const DecisionContext = {
    /**
     * Create a DecisionContext with explicit unavailable fields.
     * Used when no reasoning evidence is available.
     */
    unavailable(): DecisionContext {
        return Object.freeze({});
    },

    /**
     * Create a DecisionContext from available evidence.
     * Only includes fields that are actually provided.
     */
    fromEvidence(params: {
        traceId?: string;
        inputHash?: string;
        reasoningRef?: string;
        explanation?: string;
        confidence?: number;
        limitations?: readonly string[];
    }): DecisionContext {
        const context: Record<string, unknown> = {};
        if (params.traceId) context.traceId = params.traceId;
        if (params.inputHash) context.inputHash = params.inputHash;
        if (params.reasoningRef) context.reasoningRef = params.reasoningRef;
        if (params.explanation) context.explanation = params.explanation;
        if (typeof params.confidence === "number" && params.confidence >= 0 && params.confidence <= 1) {
            context.confidence = params.confidence;
        }
        if (params.limitations?.length) {
            context.limitations = Object.freeze([...params.limitations]);
        }
        return Object.freeze(context) as DecisionContext;
    }
};
