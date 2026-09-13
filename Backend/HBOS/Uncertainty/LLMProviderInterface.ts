/**
 * Stage 07-I - LLM Provider Interface
 *
 * Optional LLM provider abstraction for post-hoc answer enrichment.
 *
 * CRITICAL PRINCIPLES:
 * - The LLM is OPTIONAL and never a source of truth.
 * - Evidence remains authoritative; LLM enrichment is a post-processing step.
 * - Real LLM integration is OUT OF SCOPE for Stage 07-I and is gated behind
 *   a feature flag. Local models may be plugged in later without changing
 *   the grounded response contract.
 * - All providers expose `isAvailable()` and `enrich()`.
 */

import {
    LLMProvider,
    PromptContext,
    LLMEnrichment
} from "./NLPTypes";

const NULL_PROVIDER_NAME = "null_provider";
const STUB_PROVIDER_NAME = "local_stub_provider";

/**
 * NullProvider forces the deterministic fallback path.
 * It returns null enrichment regardless of input.
 */
export const NullProvider: LLMProvider = Object.freeze({
    name: NULL_PROVIDER_NAME,
    type: "none",
    modelVersion: undefined,
    isAvailable: false
});

/**
 * Create a NullProvider instance.
 */
export function createNullProvider(): LLMProvider {
    return NullProvider;
}

/**
 * LocalStubProvider returns the input answer unchanged, marked as a no-op.
 */
export const LocalStubProvider: LLMProvider = Object.freeze({
    name: STUB_PROVIDER_NAME,
    type: "local",
    modelVersion: "stub-0.0.1",
    isAvailable: true
});

/**
 * Create a LocalStubProvider instance.
 */
export function createLocalStubProvider(): LLMProvider {
    return LocalStubProvider;
}

/**
 * Enrich an answer using a provider.
 * Returns null if the provider is unavailable or enrichment fails.
 */
export function enrichAnswer(
    provider: LLMProvider | null | undefined,
    answer: string,
    context: PromptContext
): LLMEnrichment | null {
    if (!provider || !provider.isAvailable) {
        return null;
    }

    if (provider.type === "none") {
        return null;
    }

    if (provider.name === STUB_PROVIDER_NAME) {
        return Object.freeze({
            raw: answer,
            modelUsed: provider.modelVersion ?? "unknown",
            enrichmentApplied: false
        });
    }

    // Real LLM integration is out of scope.
    // Feature-flagged providers would be plugged in here.
    return Object.freeze({
        raw: answer,
        modelUsed: provider.modelVersion ?? "unknown",
        enrichmentApplied: false
    });
}
