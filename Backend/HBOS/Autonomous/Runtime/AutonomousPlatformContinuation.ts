import { AutonomousProjectMission, Mission } from "./AutonomousProjectMission";

export interface PlatformContinuationMission {
    capabilityId: "platform.continuation";
    capability: string;
    instruction: string;
    source: "assistant.completion.gate";
}

export type PlatformCapabilityMission = Omit<Mission, "evidence" | "architectureRules" | "directives">;

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

    /**
     * Converts the completion handoff into a real backlog mission. A
     * continuation must never be treated as a build capability itself.
     */
    selectNextCapability(projectMission: AutonomousProjectMission): PlatformCapabilityMission | null {
        return projectMission.nextPlatformMission();
    }
}
