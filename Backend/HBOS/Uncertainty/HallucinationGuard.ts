/**
 * Stage 07-I - Hallucination Guard
 *
 * Heuristic anti-hallucination safeguards for grounded responses.
 *
 * METHOD:
 *  1. For deterministic responses (no LLM enrichment applied), claims are
 *     trivially traceable to evidence chunks.
 *  2. For LLM-enriched responses where enrichment was actually applied,
 *     check if the enrichment text appears in the evidence chunks.
 *  3. Flag any ungrounded claims as warnings.
 *
 * CRITICAL PRINCIPLES:
 * - This is a HEURISTIC CHECK, not a formal guarantee.
 * - Evidence remains authoritative; the guard only flags potential issues.
 * - Empty responses are trivially safe (nothing to hallucinate).
 */

import {
    GroundedResponse,
    EvidenceChunk
} from "./NLPTypes";

const DEFAULT_SOURCE = "hallucination_guard";

/**
 * Strip citation markers from text for heuristic checking.
 */
function stripCitations(text: string): string {
    return text
        .replace(/\(\s*source:[^)]*\)/gi, "")
        .replace(/\[\d+\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Validate a grounded response for potential hallucinations.
 */
export function validateGroundedResponse(
    response: GroundedResponse
): { isSafe: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let isSafe = true;

    // Empty answer is trivially safe
    if (!response.answer || response.answer.trim().length === 0) {
        return { isSafe: true, warnings: [] };
    }

    // If no model was used, or enrichment was not applied, claims are traceable
    // because the answer is constructed directly from evidence chunks.
    const provenance = response.provenance;
    if (!provenance.modelUsed) {
        return { isSafe: true, warnings: [] };
    }

    // For LLM-enriched responses where enrichment was actually applied,
    // check if the answer text (excluding citations) appears in evidence.
    const evidenceTexts = response.evidence.map(e => e.text.toLowerCase());
    const cleanedAnswer = stripCitations(response.answer).toLowerCase();

    // If the cleaned answer is empty after stripping citations, safe
    if (cleanedAnswer.length === 0) {
        return { isSafe: true, warnings: [] };
    }

    // Tokenize answer into sentences
    const sentences = cleanedAnswer.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);

    for (const sentence of sentences) {
        const tokens = sentence.split(/\s+/).filter(t => t.length > 4);
        if (tokens.length === 0) continue;

        let foundInEvidence = false;
        for (const token of tokens) {
            for (const evText of evidenceTexts) {
                if (evText.includes(token)) {
                    foundInEvidence = true;
                    break;
                }
            }
            if (foundInEvidence) break;
        }
        if (!foundInEvidence) {
            warnings.push(`Potential ungrounded claim: "${sentence.substring(0, 100)}..."`);
            isSafe = false;
        }
    }

    return { isSafe, warnings };
}
