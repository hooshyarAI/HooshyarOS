/**
 * Phase 06-E - Truthful Confidence
 *
 * FIX: AssistantConfidence was fabricating confidence using arbitrary additive heuristics.
 * This violated the truthful confidence principle.
 *
 * CORRECTED: AssistantConfidence now returns unavailable confidence because:
 * - The additive heuristic (base 0.5 + 0.2 + 0.2 + 0.1) has no legitimate basis
 * - The weights were arbitrary, not derived from actual model or evidence
 * - There is no defined formula or evidence linkage
 *
 * If actual confidence is needed, it must come from:
 * - A legitimate model/runtime source
 * - A documented calculation from actual inputs
 */

import { AssistantContext } from "./AssistantContext";

export class AssistantConfidence {

    /**
     * Calculate confidence for assistant context.
     *
     * CORRECTED (06-E): Returns unavailable because the previous additive heuristic
     * was a fabricated confidence with no legitimate basis.
     *
     * The previous implementation:
     * - base 0.5 + 0.2 (project name) + 0.2 (memories) + 0.1 (status)
     * This was arbitrary and not traceable to any model or formula.
     *
     * If actual confidence is needed, it must be derived from:
     * - ProvenanceTrace for evidence linkage
     * - IntelligenceEngine for formal reasoning
     * - Actual model confidence from AI runtime
     */
    calculate(context: AssistantContext): { source: "unavailable" } {
        // Previous fabricated calculation removed:
        // let score = 0.5;
        // score += 0.2 (project name)
        // score += 0.2 (memories)
        // score += 0.1 (status)
        //
        // This was violating the truthful confidence principle.

        return { source: "unavailable" };
    }

}
