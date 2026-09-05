/**
 * Phase 06-A - Intelligence Capability Contract
 *
 * Defines explicit contracts for the intelligence pipeline:
 * - IntelligenceInput: What reasoning receives
 * - IntelligenceContext: Knowledge/context provided to reasoning
 * - ReasoningResult: What reasoning produces
 * - DecisionResult: What decisions produce
 * - TruthfulConfidence: How confidence must be represented
 * - Evidence: What must be preserved through the pipeline
 *
 * Design principles:
 * - No fabrication: Confidence must be model/runtime-provided or explicitly calculated
 * - Evidence preservation: All reasoning must carry provenance
 * - Context binding: Reasoning must consume retrieved knowledge
 * - Decision authority: Decisions must transform input, not echo status
 */

import { DecisionContext } from "../Core/DecisionContext";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";

/**
 * Intelligence operation input
 */
export interface IntelligenceInput {
    /** The problem/question to reason about */
    readonly problem: string;
    /** Optional structured data (e.g., financial metrics, project status) */
    readonly data?: Record<string, unknown>;
    /** Tenant context for tenant-scoped reasoning */
    readonly tenantId?: string;
    /** Trace ID for correlation */
    readonly traceId?: string;
}

/**
 * Retrieved knowledge/context provided to reasoning
 */
export interface IntelligenceContext {
    /** Knowledge items relevant to the problem */
    readonly knowledgeItems: readonly KnowledgeItem[];
    /** Evidence items (e.g., financial transactions) */
    readonly evidenceItems: readonly EvidenceItem[];
    /** Temporal context (relevant time range) */
    readonly timeRange?: { start: string; end: string };
}

/**
 * A knowledge item from KnowledgeEngine
 */
export interface KnowledgeItem {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    /** Confidence in this knowledge item [0, 1] or undefined if unavailable */
    readonly confidence: number | undefined;
    readonly source: string;
    readonly createdAt: string;
    readonly tenantId?: string;
}

/**
 * An evidence item (e.g., ingested financial data)
 */
export interface EvidenceItem {
    readonly id: string;
    readonly type: string;
    readonly summary: string;
    readonly sourceRef: string;
    readonly tenantId?: string;
}

/**
 * Truthful confidence representation
 *
 * Allowed:
 * - Model/runtime-provided confidence (direct from inference)
 * - Calculated confidence with documented formula and evidence basis
 * - undefined (when unavailable)
 *
 * Forbidden:
 * - Hard-coded constants presented as model confidence
 * - Confidence inferred from successful execution alone
 */
export type TruthfulConfidence =
    | { source: "model"; value: number; modelId?: string }
    | { source: "calculated"; value: number; formula: string; evidence: string }
    | { source: "unavailable" };

/**
 * Reasoning result from IntelligenceEngine
 */
export interface IntelligenceResult {
    /** Trace ID for this reasoning operation */
    readonly traceId: string;
    /** The reasoning output */
    readonly conclusion: string;
    /** Truthful confidence */
    readonly confidence: TruthfulConfidence;
    /** Known limitations of this reasoning */
    readonly limitations: readonly string[];
    /** Reasoning steps (if available) */
    readonly reasoningSteps: readonly string[];
    /** Whether reasoning succeeded */
    readonly success: boolean;
    /** Status message */
    readonly status: string;
    /** Input hash for integrity */
    readonly inputHash: string;
    /** Output hash for integrity */
    readonly outputHash?: string;
}

/**
 * Decision result with full evidence
 */
export interface DecisionResult {
    /** Decision outcome message */
    readonly decision: string;
    /** Recommendation or action to take */
    readonly recommendation?: string;
    /** Confidence in the decision */
    readonly confidence: TruthfulConfidence;
    /** Reasoning result that led to this decision (if any) */
    readonly reasoning?: IntelligenceResult;
    /** Applicable rules/policies that were applied */
    readonly appliedRules: readonly string[];
    /** Known limitations of this decision */
    readonly limitations: readonly string[];
    /** Tenant context */
    readonly tenantId?: string;
    /** Whether decision was authorized */
    readonly authorized: boolean;
    /** Authorization reason (if denied) */
    readonly authorizationReason?: string;
}

/**
 * Intelligence pipeline factory
 */
export const IntelligencePipeline = {
    /**
     * Create a trace ID for the pipeline
     */
    createTraceId(): string {
        return ProvenanceTrace.createTraceId();
    },

    /**
     * Create a truthful confidence from a model value
     */
    fromModelConfidence(value: number, modelId?: string): TruthfulConfidence {
        if (typeof value !== "number" || value < 0 || value > 1) {
            return { source: "unavailable" };
        }
        return { source: "model", value, modelId };
    },

    /**
     * Create a truthful confidence from calculation
     */
    fromCalculatedConfidence(value: number, formula: string, evidence: string): TruthfulConfidence {
        if (typeof value !== "number" || value < 0 || value > 1) {
            return { source: "unavailable" };
        }
        return { source: "calculated", value, formula, evidence };
    },

    /**
     * Create an unavailable confidence
     */
    unavailable(): TruthfulConfidence {
        return { source: "unavailable" };
    },

    /**
     * Get numeric value from truthful confidence
     */
    getConfidenceValue(confidence: TruthfulConfidence): number | undefined {
        if (confidence.source === "unavailable") {
            return undefined;
        }
        return confidence.value;
    },

    /**
     * Build limitations list for reasoning
     */
    buildLimitations(reason: string, confidenceUnavailable?: boolean): readonly string[] {
        const limitations: string[] = [reason];
        if (confidenceUnavailable) {
            limitations.push("Confidence score not available from reasoning runtime");
        }
        return Object.freeze(limitations);
    }
};

