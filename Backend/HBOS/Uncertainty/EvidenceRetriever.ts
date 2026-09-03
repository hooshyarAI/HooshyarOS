/**
 * Stage 07-I - Evidence Retriever
 *
 * Deterministic keyword-based evidence retrieval from a knowledge base.
 *
 * METHOD:
 *  1. Tokenize query: lowercase, split on whitespace, remove stopwords.
 *  2. For each chunk, compute score = count of matching tokens / total query tokens.
 *  3. Sort by score descending, return top K.
 *  4. Filter by minRelevance threshold.
 *
 * IMPORTANT:
 * - This is a DELIBERATE, DETERMINISTIC BASELINE. No semantic embeddings.
 * - Tenant isolation is enforced at the retrieval boundary.
 * - Allowed sources filter is applied before scoring.
 * - Provenance is preserved for every retrieval.
 */

import {
    EvidenceChunk,
    RetrievalQuery,
    RetrievalResult,
    ResponseProvenance
} from "./NLPTypes";

const STOPWORDS: ReadonlySet<string> = new Set([
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "be", "was", "are", "were",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "shall", "should", "may", "might", "must", "can", "could",
    "i", "you", "he", "she", "we", "they", "me", "him", "her", "us",
    "them", "my", "your", "his", "its", "our", "their", "this", "that",
    "these", "those", "am", "not"
]);

const DEFAULT_RETRIEVAL_METHOD = "keyword_match_baseline";
const DEFAULT_SOURCE = "evidence_retriever";

/**
 * Tokenize a query string: lowercase, split on whitespace, remove stopwords.
 */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/\s+/)
        .filter(token => token.length > 0 && !STOPWORDS.has(token));
}

/**
 * Compute relevance score for a chunk against tokenized query tokens.
 * Score = count of matching tokens / total query tokens.
 */
function computeScore(chunkText: string, queryTokens: ReadonlyArray<string>): number {
    if (queryTokens.length === 0) return 0;
    const chunkLower = chunkText.toLowerCase();
    const chunkTokens = new Set(chunkText.toLowerCase().split(/\s+/));
    let matchCount = 0;
    for (const token of queryTokens) {
        if (chunkTokens.has(token)) {
            matchCount++;
        }
    }
    return matchCount / queryTokens.length;
}

/**
 * Retrieve evidence chunks matching a query.
 */
export function retrieve(
    query: RetrievalQuery,
    knowledgeBase: ReadonlyArray<EvidenceChunk>
): RetrievalResult {
    const queryTokens = tokenize(query.query);
    const now = new Date().toISOString();

    let filtered = knowledgeBase;

    // Tenant isolation: filter by tenantId
    filtered = filtered.filter(chunk => chunk.tenantId === query.tenantId);

    // Allowed sources filter
    if (query.allowedSources.length > 0) {
        filtered = filtered.filter(chunk => query.allowedSources.includes(chunk.source));
    }

    // Score and filter by minRelevance
    let scored = filtered.map(chunk => {
        const score = computeScore(chunk.text, queryTokens);
        return Object.freeze({
            ...chunk,
            relevanceScore: score
        });
    });

    scored = scored.filter(chunk => chunk.relevanceScore >= query.minRelevance);

    // Sort by score descending
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Top-K limit
    const topK = Math.max(0, query.topK);
    const chunks = scored.slice(0, topK);

    const provenance: ResponseProvenance = Object.freeze({
        source: DEFAULT_SOURCE,
        tenant: query.tenantId,
        query: query.query,
        retrievalMethod: DEFAULT_RETRIEVAL_METHOD,
        evidenceCount: chunks.length,
        modelUsed: undefined,
        calculatedAt: now
    });

    return Object.freeze({
        query: query.query,
        chunks: Object.freeze(chunks),
        totalRetrieved: chunks.length,
        retrievalMethod: DEFAULT_RETRIEVAL_METHOD,
        provenance
    });
}

/**
 * Convenience method for searching the knowledge base.
 */
export function searchKnowledge(
    knowledgeBase: ReadonlyArray<EvidenceChunk>,
    queryText: string,
    tenantId: string,
    topK: number = 5,
    minRelevance: number = 0.0
): RetrievalResult {
    const query: RetrievalQuery = Object.freeze({
        tenantId,
        query: queryText,
        topK,
        minRelevance,
        allowedSources: Object.freeze([])
    });
    return retrieve(query, knowledgeBase);
}
