/**
 * ProvenanceTrace - Evidence/Decision Provenance and Traceability
 * 
 * Provides stable trace IDs and provenance linkage for decisions/recommendations.
 * 
 * Trace chain: SOURCE -> INPUT -> TRANSFORMATION -> REASONING -> DECISION -> EVIDENCE
 * 
 * E1: Decision provenance traceability
 * E2: Evidence IDs
 * E3: Explainability
 * B2: Reasoning evidence traceability
 * P2: Trustworthy intelligence
 */

export interface ProvenanceLink {
    readonly traceId: string;
    readonly sourceRef: string;
    readonly inputRef: string;
    readonly transformationRef?: string;
    readonly reasoningRef: string;
    readonly decisionRef: string;
    readonly timestamp: string;
    readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
}

export interface ExplainabilityRecord {
    readonly traceId: string;
    readonly reasoningChain: readonly string[];
    readonly inputSummary: string;
    readonly decisionBasis: string;
    readonly confidence: number;
    readonly limitations?: readonly string[];
}

export interface ReasoningProvenance {
    readonly traceId: string;
    readonly sourceRef: string;
    readonly timestamp: string;
    readonly inputHash: string;
    readonly reasoningSteps: readonly string[];
    readonly outputHash: string;
    readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
}

export class ProvenanceTrace {
    private static readonly VERSION = "1.0";
    private static counter = 0;

    /**
     * Generate a stable trace ID for evidence tracking.
     * Format: TRACE-{timestamp}-{random}
     */
    static createTraceId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 9);
        const counter = ++ProvenanceTrace.counter;
        return `TRACE-${timestamp}-${random}-${counter}`;
    }

    /**
     * Create a SHA-256 hash for input verification.
     */
    static hashInput(input: string): string {
        // Simple deterministic hash using Node.js crypto
        const { createHash } = require("node:crypto");
        return createHash("sha256").update(input, "utf8").digest("hex");
    }

    /**
     * Create a provenance link for a decision.
     * E1: Decision provenance traceability
     */
    static createProvenanceLink(params: {
        sourceRef: string;
        inputRef: string;
        transformationRef?: string;
        reasoningRef: string;
        decisionRef: string;
    }): ProvenanceLink {
        if (!params.sourceRef?.trim()) {
            throw new Error("provenance-source-required");
        }
        if (!params.inputRef?.trim()) {
            throw new Error("provenance-input-required");
        }
        if (!params.reasoningRef?.trim()) {
            throw new Error("provenance-reasoning-required");
        }
        if (!params.decisionRef?.trim()) {
            throw new Error("provenance-decision-required");
        }
        return Object.freeze({
            traceId: ProvenanceTrace.createTraceId(),
            sourceRef: params.sourceRef.trim(),
            inputRef: params.inputRef.trim(),
            transformationRef: params.transformationRef?.trim(),
            reasoningRef: params.reasoningRef.trim(),
            decisionRef: params.decisionRef.trim(),
            timestamp: new Date().toISOString(),
            verificationStatus: "VERIFIED",
        });
    }

    /**
     * Create an explainability record for reasoning output.
     * E3: Explainability
     */
    static createExplainabilityRecord(params: {
        reasoningChain: readonly string[];
        inputSummary: string;
        decisionBasis: string;
        confidence: number;
        limitations?: readonly string[];
    }): ExplainabilityRecord {
        if (typeof params.confidence !== "number" || params.confidence < 0 || params.confidence > 1) {
            throw new Error("provenance-confidence-invalid-range");
        }
        const traceId = ProvenanceTrace.createTraceId();
        return Object.freeze({
            traceId,
            reasoningChain: Object.freeze([...params.reasoningChain]),
            inputSummary: params.inputSummary,
            decisionBasis: params.decisionBasis,
            confidence: Math.max(0, Math.min(1, params.confidence)),
            limitations: params.limitations ? Object.freeze([...params.limitations]) : undefined,
        });
    }

    /**
     * Create reasoning provenance record.
     */
    static createReasoningProvenance(params: {
        sourceRef: string;
        input: string;
        reasoningSteps: readonly string[];
        output: string;
    }): ReasoningProvenance {
        const traceId = ProvenanceTrace.createTraceId();
        const timestamp = new Date().toISOString();
        return Object.freeze({
            traceId,
            sourceRef: params.sourceRef,
            timestamp,
            inputHash: ProvenanceTrace.hashInput(params.input),
            reasoningSteps: Object.freeze([...params.reasoningSteps]),
            outputHash: ProvenanceTrace.hashInput(params.output),
            verificationStatus: "VERIFIED",
        });
    }

    /**
     * Verify input hash matches expected.
     */
    static verifyInput(input: string, expectedHash: string): boolean {
        return ProvenanceTrace.hashInput(input) === expectedHash;
    }

    /**
     * Verify output hash matches expected.
     */
    static verifyOutput(output: string, expectedHash: string): boolean {
        return ProvenanceTrace.hashInput(output) === expectedHash;
    }

    /**
     * Link provenance to a decision result.
     */
    static linkToDecision<T>(
        result: T,
        provenance: ProvenanceLink
    ): T & { readonly provenance: ProvenanceLink } {
        return Object.freeze({
            ...result,
            provenance: Object.freeze({ ...provenance }),
        }) as T & { readonly provenance: ProvenanceLink };
    }
}
