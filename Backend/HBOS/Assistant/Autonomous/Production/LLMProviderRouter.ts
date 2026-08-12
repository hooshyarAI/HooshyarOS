export type AssistantConstructionProvider = "python";

/**
 * Provider policy for the production construction Assistant.
 *
 * The construction path is intentionally provider-locked: Python is the only
 * approved repository-native worker. External/cloud coding providers are not
 * selectable runtime providers.
 */
export class LLMProviderRouter {
    route(_mode?: string): { provider: AssistantConstructionProvider } {
        return { provider: "python" };
    }
}
