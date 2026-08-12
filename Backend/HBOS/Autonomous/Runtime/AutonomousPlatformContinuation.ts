import { AutonomousProjectMission, Mission } from "./AutonomousProjectMission";
import { existsSync } from "node:fs";
import { join } from "node:path";

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
 * platform backlog and approved production extension registry own the next
 * concrete capability.
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
        const canonical = projectMission.nextPlatformMission();
        if (canonical) return canonical;

        const root = projectMission.snapshot().root;
        const p = (path: string) => join(root, path);
        const productionExtension = {
            capabilityId: "platform.performance-testing",
            capability: "implement repository-native Performance Testing capability",
            targetEngine: "Performance Testing Engine",
            dependencies: ["Production Readiness Engine", "Security Audit Engine"],
            requiredPaths: [
                p("Backend/HBOS/Engines/PerformanceTestingEngine.ts"),
                p("Backend/HBOS/test/PerformanceTestingEngine.test.ts"),
                p("Docs/Engines/PerformanceTestingEngine.md")
            ]
        };
        const complete = productionExtension.requiredPaths.every(existsSync);
        return complete ? null : productionExtension;
    }
}
