/**
 * Stage 07-I - NLP / Grounded LLM Intelligence Types
 *
 * Contract types for evidence retrieval, grounded response building,
 * and optional LLM enrichment.
 *
 * CRITICAL PRINCIPLES:
 * - Evidence is authoritative; LLM is optional and never a source of truth.
 * - All responses are evidence-linked with explicit citations.
 * - Tenant isolation is enforced at the retrieval boundary.
 * - Hallucination safeguards are heuristic, not formal guarantees.
 */

/**
 * Status of a grounded response.
 */
export type GroundedStatus = "answered" | "insufficient_evidence" | "conflicting_evidence" | "unavailable" | "invalid_request";

/**
 * Type of LLM provider.
 */
export type LLMProviderType = "local" | "remote" | "none";

/**
 * A single chunk of evidence retrieved from the knowledge base.
 */
export interface EvidenceChunk {
    readonly id: string;
    readonly text: string;
    readonly source: string;
    readonly tenantId: string;
    readonly timestamp: string;
    readonly relevanceScore: number;
    readonly retrievalMethod: string;
}

/**
 * Query for evidence retrieval.
 */
export interface RetrievalQuery {
    readonly tenantId: string;
    readonly query: string;
    readonly topK: number;
    readonly minRelevance: number;
    readonly allowedSources: ReadonlyArray<string>;
}

/**
 * Result of evidence retrieval.
 */
export interface RetrievalResult {
    readonly query: string;
    readonly chunks: ReadonlyArray<EvidenceChunk>;
    readonly totalRetrieved: number;
    readonly retrievalMethod: string;
    readonly provenance: ResponseProvenance;
}

/**
 * LLM provider configuration.
 */
export interface LLMProvider {
    readonly name: string;
    readonly type: LLMProviderType;
    readonly modelVersion: string | undefined;
    readonly isAvailable: boolean;
}

/**
 * Context for LLM enrichment.
 */
export interface PromptContext {
    readonly query: string;
    readonly evidence: ReadonlyArray<EvidenceChunk>;
    readonly systemPrompt: string | undefined;
    readonly tenantId: string;
    readonly maxTokens: number;
}

/**
 * Enrichment result from an LLM provider.
 */
export interface LLMEnrichment {
    readonly raw: string;
    readonly modelUsed: string;
    readonly enrichmentApplied: boolean;
}

/**
 * Provenance for a grounded response.
 */
export interface ResponseProvenance {
    readonly source: string;
    readonly tenant: string;
    readonly query: string;
    readonly retrievalMethod: string;
    readonly evidenceCount: number;
    readonly modelUsed: string | undefined;
    readonly calculatedAt: string;
}

/**
 * A grounded response with evidence-linked answer.
 */
export interface GroundedResponse {
    readonly query: string;
    readonly answer: string;
    readonly evidence: ReadonlyArray<EvidenceChunk>;
    readonly sources: ReadonlyArray<string>;
    readonly confidence: number;
    readonly status: GroundedStatus;
    readonly provenance: ResponseProvenance;
}
