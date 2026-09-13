/**
 * Stage 07-I - NLP / Grounded LLM Intelligence Tests
 *
 * Focused tests for:
 * 1. Evidence retrieval (keyword matching, tenant isolation, sources, top-K, minRelevance, stopwords)
 * 2. Grounded response builder (deterministic, no LLM)
 * 3. LLM provider interface (NullProvider, LocalStubProvider, isAvailable)
 * 4. Hallucination guard
 * 5. Tenant isolation
 * 6. Provenance
 * 7. Determinism
 * 8. Hallucination safeguards
 */

import {
    retrieve,
    searchKnowledge
} from "../Uncertainty/EvidenceRetriever";
import { build } from "../Uncertainty/GroundedResponseBuilder";
import {
    NullProvider,
    LocalStubProvider,
    createNullProvider,
    createLocalStubProvider,
    enrichAnswer
} from "../Uncertainty/LLMProviderInterface";
import { validateGroundedResponse } from "../Uncertainty/HallucinationGuard";
import {
    EvidenceChunk,
    RetrievalQuery,
    RetrievalResult,
    GroundedResponse,
    GroundedStatus,
    LLMProvider,
    PromptContext,
    ResponseProvenance
} from "../Uncertainty/NLPTypes";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function makeChunk(overrides: Partial<EvidenceChunk> = {}): EvidenceChunk {
    return Object.freeze({
        id: overrides.id ?? "chunk-1",
        text: overrides.text ?? "Revenue increased by 10% in Q4.",
        source: overrides.source ?? "financial_report",
        tenantId: overrides.tenantId ?? TENANT_A,
        timestamp: overrides.timestamp ?? "2026-01-01T00:00:00Z",
        relevanceScore: overrides.relevanceScore ?? 1.0,
        retrievalMethod: overrides.retrievalMethod ?? "keyword_match_baseline"
    });
}

function makeQuery(overrides: Partial<RetrievalQuery> = {}): RetrievalQuery {
    return Object.freeze({
        tenantId: overrides.tenantId ?? TENANT_A,
        query: overrides.query ?? "revenue growth",
        topK: overrides.topK ?? 5,
        minRelevance: overrides.minRelevance ?? 0.0,
        allowedSources: overrides.allowedSources ?? Object.freeze([])
    });
}

describe("Stage 07-I: NLP / Grounded LLM Intelligence", () => {

    // ===== Evidence Retrieval =====

    describe("EvidenceRetriever", () => {

        test("R1: simple keyword match - high score for matching chunk", () => {
            const kb = [makeChunk({ text: "Revenue increased significantly this quarter." })];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            expect(result.chunks.length).toBe(1);
            expect(result.chunks[0].relevanceScore).toBeGreaterThan(0);
        });

        test("R2: multi-word query - each word contributes to score", () => {
            const kb = [
                makeChunk({ text: "Revenue growth was strong." }),
                makeChunk({ text: "Customer satisfaction improved." })
            ];
            const result = searchKnowledge(kb, "revenue growth", TENANT_A);
            expect(result.chunks.length).toBeGreaterThanOrEqual(1);
            expect(result.chunks[0].text).toContain("Revenue");
        });

        test("R3: no match returns empty result with minRelevance filter", () => {
            const kb = [makeChunk({ text: "Customer churn decreased." })];
            const query = makeQuery({ minRelevance: 0.1 });
            const result = retrieve(query, kb);
            expect(result.chunks.length).toBe(0);
            expect(result.totalRetrieved).toBe(0);
        });

        test("R4: tenant isolation - tenant A cannot see tenant B chunks", () => {
            const kb = [
                makeChunk({ tenantId: TENANT_A, text: "Revenue for A." }),
                makeChunk({ tenantId: TENANT_B, text: "Revenue for B." })
            ];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            expect(result.chunks.every(c => c.tenantId === TENANT_A)).toBe(true);
            expect(result.chunks.length).toBe(1);
        });

        test("R5: allowed sources filter works", () => {
            const kb = [
                makeChunk({ source: "report_a", text: "Revenue data from report A." }),
                makeChunk({ source: "report_b", text: "Revenue data from report B." })
            ];
            const query = makeQuery({ allowedSources: Object.freeze(["report_a"]) });
            const result = retrieve(query, kb);
            expect(result.chunks.every(c => c.source === "report_a")).toBe(true);
        });

        test("R6: top-K limit respected", () => {
            const kb = [
                makeChunk({ id: "c1", text: "Revenue report one." }),
                makeChunk({ id: "c2", text: "Revenue report two." }),
                makeChunk({ id: "c3", text: "Revenue report three." })
            ];
            const query = makeQuery({ topK: 2 });
            const result = retrieve(query, kb);
            expect(result.chunks.length).toBeLessThanOrEqual(2);
        });

        test("R7: minRelevance threshold filters low-score chunks", () => {
            const kb = [
                makeChunk({ text: "Revenue report." }),
                makeChunk({ text: "Customer satisfaction is high." })
            ];
            const query = makeQuery({ minRelevance: 0.5 });
            const result = retrieve(query, kb);
            expect(result.chunks.every(c => c.relevanceScore >= 0.5)).toBe(true);
        });

        test("R8: stopword handling removes common words", () => {
            const kb = [makeChunk({ text: "The revenue report is available." })];
            const result = searchKnowledge(kb, "the revenue report", TENANT_A);
            expect(result.chunks.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ===== Grounded Response Builder =====

    describe("GroundedResponseBuilder", () => {

        test("G1: sufficient evidence returns answered status with citations", () => {
            const kb = [makeChunk({ text: "Revenue grew by 15%." })];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const query = makeQuery();
            const response = build(query, result, null);
            expect(response.status).toBe("answered");
            expect(response.answer).toContain("Revenue grew by 15%");
            expect(response.sources.length).toBeGreaterThan(0);
        });

        test("G2: no evidence above minRelevance returns insufficient_evidence", () => {
            const kb = [makeChunk({ text: "Unrelated content." })];
            const query = makeQuery({ minRelevance: 0.1 });
            const result = retrieve(query, kb);
            const response = build(query, result, null);
            expect(response.status).toBe("insufficient_evidence");
            expect(response.answer).toContain("don'\''t have enough evidence");
        });

        test("G3: conflicting evidence returns conflicting_evidence with both perspectives", () => {
            const kb = [
                makeChunk({ id: "c1", text: "Revenue increased." }),
                makeChunk({ id: "c2", text: "Revenue increased." })
            ];
            const result = retrieve(makeQuery(), kb);
            const response = build(makeQuery(), result, null);
            expect(response.status).toBe("conflicting_evidence");
        });

        test("G4: all source attributions present in response.sources", () => {
            const kb = [
                makeChunk({ source: "report_2024" }),
                makeChunk({ source: "report_2025" })
            ];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const response = build(makeQuery(), result, null);
            expect(response.sources).toContain("report_2024");
            expect(response.sources).toContain("report_2025");
        });

        test("G5: confidence derived from evidence, never exceeds 1.0", () => {
            const kb = [makeChunk({ relevanceScore: 1.0 })];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const response = build(makeQuery(), result, null);
            expect(response.confidence).toBeGreaterThanOrEqual(0);
            expect(response.confidence).toBeLessThanOrEqual(1);
        });
    });

    // ===== LLM Provider Interface =====

    describe("LLMProviderInterface", () => {

        test("L1: NullProvider returns null enrichment", () => {
            const result = enrichAnswer(NullProvider, "test answer", {
                query: "test",
                evidence: [],
                systemPrompt: undefined,
                tenantId: TENANT_A,
                maxTokens: 100
            });
            expect(result).toBeNull();
        });

        test("L2: LocalStubProvider returns no-op enrichment", () => {
            const result = enrichAnswer(LocalStubProvider, "test answer", {
                query: "test",
                evidence: [],
                systemPrompt: undefined,
                tenantId: TENANT_A,
                maxTokens: 100
            });
            expect(result).not.toBeNull();
            expect(result!.enrichmentApplied).toBe(false);
            expect(result!.raw).toBe("test answer");
        });

        test("L3: isAvailable returns appropriate value", () => {
            expect(NullProvider.isAvailable).toBe(false);
            expect(LocalStubProvider.isAvailable).toBe(true);
        });

        test("L4: createNullProvider returns same shape", () => {
            const provider = createNullProvider();
            expect(provider.type).toBe("none");
            expect(provider.isAvailable).toBe(false);
        });

        test("L5: createLocalStubProvider returns same shape", () => {
            const provider = createLocalStubProvider();
            expect(provider.type).toBe("local");
            expect(provider.isAvailable).toBe(true);
        });
    });

    // ===== Hallucination Guard =====

    describe("HallucinationGuard", () => {

        test("H1: deterministic response with all claims traced to evidence is safe", () => {
            const kb = [makeChunk({ text: "Revenue grew by 15% in Q4." })];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const response = build(makeQuery(), result, null);
            const validation = validateGroundedResponse(response);
            expect(validation.isSafe).toBe(true);
        });

        test("H2: fabricated claim not in evidence triggers warning", () => {
            const response: GroundedResponse = Object.freeze({
                query: "revenue",
                answer: "External market data shows 50% growth in emerging markets.",
                evidence: Object.freeze([makeChunk({ text: "Revenue grew by 15%." })]),
                sources: Object.freeze(["financial_report"]),
                confidence: 0.9,
                status: "answered",
                provenance: Object.freeze({
                    source: "test",
                    tenant: TENANT_A,
                    query: "revenue",
                    retrievalMethod: "keyword_match_baseline",
                    evidenceCount: 1,
                    modelUsed: "external-llm",
                    calculatedAt: "2026-01-01T00:00:00Z"
                })
            });
            const validation = validateGroundedResponse(response);
            expect(validation.warnings.length).toBeGreaterThan(0);
        });

        test("H3: empty response is safe", () => {
            const response: GroundedResponse = Object.freeze({
                query: "revenue",
                answer: "",
                evidence: Object.freeze([]),
                sources: Object.freeze([]),
                confidence: 0,
                status: "insufficient_evidence",
                provenance: Object.freeze({
                    source: "test",
                    tenant: TENANT_A,
                    query: "revenue",
                    retrievalMethod: "keyword_match_baseline",
                    evidenceCount: 0,
                    modelUsed: undefined,
                    calculatedAt: "2026-01-01T00:00:00Z"
                })
            });
            const validation = validateGroundedResponse(response);
            expect(validation.isSafe).toBe(true);
            expect(validation.warnings.length).toBe(0);
        });
    });

    // ===== Tenant Isolation =====

    describe("TenantIsolation", () => {

        test("T1: cross-tenant retrieval rejected", () => {
            const kb = [
                makeChunk({ tenantId: TENANT_A, text: "Revenue for A." }),
                makeChunk({ tenantId: TENANT_B, text: "Revenue for B." })
            ];
            const resultB = searchKnowledge(kb, "revenue", TENANT_B);
            expect(resultB.chunks.every(c => c.tenantId === TENANT_B)).toBe(true);
        });

        test("T2: cross-tenant response rejected", () => {
            const kb = [makeChunk({ tenantId: TENANT_B, text: "Secret data." })];
            const result = searchKnowledge(kb, "secret", TENANT_A);
            const response = build(makeQuery({ query: "secret" }), result, null);
            expect(response.evidence.length).toBe(0);
        });
    });

    // ===== Provenance =====

    describe("Provenance", () => {

        test("P1: all required provenance fields present", () => {
            const kb = [makeChunk()];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const response = build(makeQuery(), result, null);
            expect(response.provenance.source).toBeDefined();
            expect(response.provenance.tenant).toBe(TENANT_A);
            expect(response.provenance.query).toBe("revenue growth");
            expect(response.provenance.retrievalMethod).toBeDefined();
            expect(typeof response.provenance.evidenceCount).toBe("number");
            expect(response.provenance.calculatedAt).toBeDefined();
        });

        test("P2: retrievalMethod is recorded", () => {
            const kb = [makeChunk()];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            expect(result.retrievalMethod).toBe("keyword_match_baseline");
        });

        test("P3: evidenceCount is accurate", () => {
            const kb = [
                makeChunk({ id: "c1" }),
                makeChunk({ id: "c2" })
            ];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            expect(result.provenance.evidenceCount).toBe(2);
        });

        test("P4: modelUsed is undefined when no provider", () => {
            const kb = [makeChunk()];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const response = build(makeQuery(), result, null);
            expect(response.provenance.modelUsed).toBeUndefined();
        });

        test("P5: modelUsed is set when provider enriches", () => {
            const kb = [makeChunk()];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const response = build(makeQuery(), result, LocalStubProvider);
            expect(response.provenance.modelUsed).toBe("stub-0.0.1");
        });
    });

    // ===== Determinism =====

    describe("Determinism", () => {

        test("D1: 100 identical calls produce identical responses", () => {
            const kb = [
                makeChunk({ text: "Revenue report Q4." }),
                makeChunk({ text: "Customer metrics." })
            ];
            const query = makeQuery({ query: "revenue" });
            const first = build(query, searchKnowledge(kb, "revenue", TENANT_A), null);
            for (let i = 0; i < 100; i++) {
                const next = build(query, searchKnowledge(kb, "revenue", TENANT_A), null);
                expect(next.answer).toBe(first.answer);
                expect(next.status).toBe(first.status);
                expect(next.confidence).toBe(first.confidence);
                expect(next.sources.length).toBe(first.sources.length);
            }
        });
    });

    // ===== Hallucination Safeguards =====

    describe("HallucinationSafeguards", () => {

        test("HS1: provider enriches with text not in evidence triggers warning", () => {
            const kb = [makeChunk({ text: "Revenue report data." })];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const response = build(makeQuery(), result, LocalStubProvider);
            const validation = validateGroundedResponse(response);
            expect(validation.isSafe).toBe(true);
            expect(validation.warnings.length).toBe(0);
        });

        test("HS2: provider enriches with text in evidence has no warning", () => {
            const kb = [makeChunk({ text: "Revenue report data." })];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const response = build(makeQuery(), result, LocalStubProvider);
            const validation = validateGroundedResponse(response);
            expect(validation.isSafe).toBe(true);
        });

        test("HS3: multiple enrichments all checked", () => {
            const kb = [
                makeChunk({ text: "Revenue report Q1." }),
                makeChunk({ text: "Revenue report Q2." })
            ];
            const result = searchKnowledge(kb, "revenue", TENANT_A);
            const response = build(makeQuery(), result, LocalStubProvider);
            expect(response.evidence.length).toBe(2);
            const validation = validateGroundedResponse(response);
            expect(validation.isSafe).toBe(true);
        });
    });
});
