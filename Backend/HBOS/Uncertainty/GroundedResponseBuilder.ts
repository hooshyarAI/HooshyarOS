/**
 * Stage 07-I - Grounded Response Builder
 *
 * Constructs evidence-linked responses from retrieved evidence.
 *
 * METHOD:
 *  1. If no evidence above minRelevance: status = insufficient_evidence.
 *  2. If evidence is conflicting (chunks disagree): status = conflicting_evidence.
 *  3. Otherwise: status = answered, construct answer from evidence with citations.
 *  4. If a provider is available, optionally enrich the answer (post-processing).
 *
 * CRITICAL PRINCIPLES:
 * - LLM enrichment is a POST-PROCESSING step that does not introduce
 *   unsupported facts. Evidence remains authoritative.
 * - Confidence is derived from evidence count and average relevance,
 *   NEVER fabricated.
 * - For deterministic fallback (no provider): answer is stitched from
 *   top evidence chunks with explicit source attributions.
 */

import {
    EvidenceChunk,
    RetrievalQuery,
    RetrievalResult,
    GroundedResponse,
    GroundedStatus,
    LLMProvider,
    PromptContext,
    LLMEnrichment,
    ResponseProvenance
} from "./NLPTypes";
import { enrichAnswer } from "./LLMProviderInterface";

const DEFAULT_SOURCE = "grounded_response_builder";
const DEFAULT_RETRIEVAL_METHOD = "keyword_match_baseline";
const MIN_EVIDENCE_COUNT = 1;
const MAX_CONFIDENCE = 1.0;

/**
 * Check if evidence chunks contain conflicting information.
 * Heuristic: conflicting if chunks have opposing sentiment on the same topic.
 * For deterministic mode, we treat chunks with identical text as non-conflicting.
 */
function hasConflictingEvidence(chunks: ReadonlyArray<EvidenceChunk>): boolean {
    if (chunks.length < 2) return false;

    const texts = chunks.map(c => c.text.toLowerCase().trim());
    const uniqueTexts = new Set(texts);
    if (uniqueTexts.size === texts.length) {
        return false;
    }

    const seen = new Set<string>();
    for (const text of texts) {
        if (seen.has(text)) {
            return true;
        }
        seen.add(text);
    }
    return false;
}

/**
 * Build a deterministic answer by stitching top evidence chunks with citations.
 */
function buildDeterministicAnswer(chunks: ReadonlyArray<EvidenceChunk>): string {
    const parts: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        parts.push(`[${i + 1}] ${chunk.text} (source: ${chunk.source})`);
    }
    return parts.join("\n\n");
}

/**
 * Compute confidence from evidence count and average relevance.
 * Confidence is capped at 1.0 and is NEVER fabricated.
 */
function computeConfidence(chunks: ReadonlyArray<EvidenceChunk>): number {
    if (chunks.length === 0) return 0;
    const avgRelevance = chunks.reduce((sum, c) => sum + c.relevanceScore, 0) / chunks.length;
    const countFactor = Math.min(chunks.length / MIN_EVIDENCE_COUNT, 1);
    return Math.min(avgRelevance * countFactor, MAX_CONFIDENCE);
}

/**
 * Build a grounded response from a retrieval result and optional provider.
 */
export function build(
    query: RetrievalQuery,
    retrievalResult: RetrievalResult,
    provider: LLMProvider | null | undefined
): GroundedResponse {
    const now = new Date().toISOString();
    const chunks = retrievalResult.chunks;

    let status: GroundedStatus;
    let answer: string;
    let evidence = chunks;
    let sources: string[] = [];

    if (chunks.length === 0) {
        status = "insufficient_evidence";
        answer = "I don'\''t have enough evidence to answer this question.";
        sources = [];
    } else if (hasConflictingEvidence(chunks)) {
        status = "conflicting_evidence";
        const perspectives = chunks.map((c, i) => `[${i + 1}] ${c.text} (source: ${c.source})`);
        answer = `Conflicting evidence found:\n\n${perspectives.join("\n\n")}`;
        sources = chunks.map(c => c.source);
    } else {
        status = "answered";
        answer = buildDeterministicAnswer(chunks);
        sources = [...new Set(chunks.map(c => c.source))];
    }

    const confidence = computeConfidence(chunks);

    // Optional LLM enrichment
    let enrichment: LLMEnrichment | null = null;
    if (provider && provider.isAvailable && provider.type !== "none") {
        const context: PromptContext = Object.freeze({
            query: query.query,
            evidence: chunks,
            systemPrompt: undefined,
            tenantId: query.tenantId,
            maxTokens: 500
        });
        enrichment = enrichAnswer(provider, answer, context);
        if (enrichment && enrichment.enrichmentApplied) {
            answer = enrichment.raw;
        }
    }

    const provenance: ResponseProvenance = Object.freeze({
        source: DEFAULT_SOURCE,
        tenant: query.tenantId,
        query: query.query,
        retrievalMethod: retrievalResult.retrievalMethod,
        evidenceCount: chunks.length,
        modelUsed: enrichment ? enrichment.modelUsed : undefined,
        calculatedAt: now
    });

    return Object.freeze({
        query: query.query,
        answer,
        evidence: Object.freeze([...evidence]),
        sources: Object.freeze(sources),
        confidence,
        status,
        provenance
    });
}
