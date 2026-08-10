export interface PlatformContinuationMission {
    capabilityId: "platform.continuation";
    capability: string;
    instruction: string;
    source: "assistant.completion.gate";
}

/**
 * Canonical handoff from the completed autonomous Assistant to continued
 * HooshyarOS platform construction. The Assistant owns orchestration; the
 * platform backlog owns the next concrete capability.
 */
export class AutonomousPlatformContinuation {
    createMission(): PlatformContinuationMission {
        return {
            capabilityId: "platform.continuation",
            capability: "continue autonomous construction of HooshyarOS platform capabilities",
            instruction: "AUDIT → SELECT NEXT GENUINELY MISSING CAPABILITY → IMPLEMENT → TEST → INTEGRATE → VERIFY → COMMIT → PUSH → AUDIT AGAIN",
            source: "assistant.completion.gate"
        };
    }
}
