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
        const extensions = [
            {
                capabilityId: "platform.performance-testing",
                capability: "implement repository-native Performance Testing capability",
                targetEngine: "Performance Testing Engine",
                dependencies: ["Production Readiness Engine", "Security Audit Engine"],
                requiredPaths: [
                    p("Backend/HBOS/Engines/PerformanceTestingEngine.ts"),
                    p("Backend/HBOS/test/PerformanceTestingEngine.test.ts"),
                    p("Docs/Engines/PerformanceTestingEngine.md")
                ]
            },
            {
                capabilityId: "platform.customer-testing",
                capability: "implement repository-native Customer Testing capability",
                targetEngine: "Customer Testing Engine",
                dependencies: ["Performance Testing Engine", "Production Readiness Engine"],
                requiredPaths: [
                    p("Backend/HBOS/Engines/CustomerTestingEngine.ts"),
                    p("Backend/HBOS/test/CustomerTestingEngine.test.ts"),
                    p("Docs/Engines/CustomerTestingEngine.md")
                ]
            },
            {
                capabilityId: "platform.deployment-readiness",
                capability: "implement repository-native Deployment Readiness capability",
                targetEngine: "Deployment Readiness Engine",
                dependencies: ["Production Readiness Engine", "Customer Testing Engine"],
                requiredPaths: [
                    p("Backend/HBOS/Engines/DeploymentReadinessEngine.ts"),
                    p("Backend/HBOS/test/DeploymentReadinessEngine.test.ts"),
                    p("Docs/Engines/DeploymentReadinessEngine.md")
                ]
            },
            {
                capabilityId: "platform.deployment-contract",
                capability: "implement repository-native Deployment Contract capability",
                targetEngine: "Deployment Contract Engine",
                dependencies: ["Deployment Readiness Engine", "Customer Testing Engine"],
                requiredPaths: [
                    p("Backend/HBOS/Engines/DeploymentContractEngine.ts"),
                    p("Backend/HBOS/test/DeploymentContractEngine.test.ts"),
                    p("Docs/Engines/DeploymentContractEngine.md")
                ]
            }
        ];

        for (const extension of extensions) {
            if (!extension.requiredPaths.every(existsSync)) return extension;
        }
        return null;
    }
}
