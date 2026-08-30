import { AutonomousProjectMission, Mission } from "./AutonomousProjectMission";
import { existsSync, join } from "node:fs";
import { join as pathJoin } from "node:path";
import { AutonomousCapabilityDiscovery } from "./AutonomousCapabilityDiscovery";
import { CommercialCapabilityDiscovery } from "./CommercialCapabilityDiscovery";

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
 * platform backlog and repository-owned capability contracts own the next
 * concrete capability.
 */
export class AutonomousPlatformContinuation {
    constructor(
        private readonly discovery = new AutonomousCapabilityDiscovery(),
        private readonly commercialDiscovery = new CommercialCapabilityDiscovery()
    ) {}

    createMission(): PlatformContinuationMission {
        return {
            capabilityId: "platform.continuation",
            capability: "continue autonomous construction of HooshyarOS platform capabilities",
            instruction: "AUDIT → DISCOVER → SELECT NEXT GENUINELY MISSING CAPABILITY → IMPLEMENT → TEST → INTEGRATE → VERIFY → COMMIT → PUSH → AUDIT AGAIN",
            source: "assistant.completion.gate"
        };
    }

    /** Converts the completion handoff into a real backlog mission. */
    selectNextCapability(projectMission: AutonomousProjectMission): PlatformCapabilityMission | null {
        const canonical = projectMission.nextPlatformMission();
        if (canonical) return canonical;

        const root = projectMission.snapshot().root;
        const p = (path: string) => pathJoin(root, path);
        const extensions = [
            {
                capabilityId: "platform.performance-testing",
                capability: "implement repository-native Performance Testing capability",
                targetEngine: "Performance Testing Engine",
                dependencies: ["Production Readiness Engine", "Security Audit Engine"],
                requiredPaths: [p("Backend/HBOS/Engines/PerformanceTestingEngine.ts"), p("Backend/HBOS/test/PerformanceTestingEngine.test.ts"), p("Docs/Engines/PerformanceTestingEngine.md")]
            },
            {
                capabilityId: "platform.customer-testing",
                capability: "implement repository-native Customer Testing capability",
                targetEngine: "Customer Testing Engine",
                dependencies: ["Performance Testing Engine", "Production Readiness Engine"],
                requiredPaths: [p("Backend/HBOS/Engines/CustomerTestingEngine.ts"), p("Backend/HBOS/test/CustomerTestingEngine.test.ts"), p("Docs/Engines/CustomerTestingEngine.md")]
            },
            {
                capabilityId: "platform.deployment-readiness",
                capability: "implement repository-native Deployment Readiness capability",
                targetEngine: "Deployment Readiness Engine",
                dependencies: ["Production Readiness Engine", "Customer Testing Engine"],
                requiredPaths: [p("Backend/HBOS/Engines/DeploymentReadinessEngine.ts"), p("Backend/HBOS/test/DeploymentReadinessEngine.test.ts"), p("Docs/Engines/DeploymentReadinessEngine.md")]
            },
            {
                capabilityId: "platform.deployment-contract",
                capability: "implement repository-native Deployment Contract capability",
                targetEngine: "Deployment Contract Engine",
                dependencies: ["Deployment Readiness Engine", "Customer Testing Engine"],
                requiredPaths: [p("Backend/HBOS/Engines/DeploymentContractEngine.ts"), p("Backend/HBOS/test/DeploymentContractEngine.test.ts"), p("Docs/Engines/DeploymentContractEngine.md")]
            },
            {
                capabilityId: "platform.cloud-deployment",
                capability: "implement repository-native Cloud Deployment execution capability",
                targetEngine: "Cloud Deployment Engine",
                dependencies: ["Deployment Contract Engine", "Deployment Readiness Engine"],
                requiredPaths: [p("Backend/HBOS/Engines/CloudDeploymentEngine.ts"), p("Backend/HBOS/test/CloudDeploymentEngine.test.ts"), p("Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts"), p("Backend/AI_Runtime/cloud_deployment.py")]
            },
            {
                capabilityId: "platform.production-acceptance",
                capability: "implement repository-native Production Acceptance capability and complete the internal acceptance gate before external deployment validation",
                targetEngine: "Production Acceptance Engine",
                dependencies: ["Cloud Deployment Engine", "Production Readiness Engine", "Deployment Readiness Engine"],
                requiredPaths: [p("Backend/HBOS/Engines/ProductionAcceptanceEngine.ts"), p("Backend/HBOS/test/ProductionAcceptanceEngine.test.ts"), p("Docs/Engines/ProductionAcceptanceEngine.md")]
            }
        ];

        for (const extension of extensions) {
            if (!extension.requiredPaths.every(existsSync)) return extension;
        }

        const commercialGap = this.commercialDiscovery.discover(root);
        if (commercialGap) {
            const canonicalProductCapabilityId = commercialGap.capabilityId === "commercial.ingestion.multiformat"
                ? "product.financial-data-ingestion"
                : commercialGap.capabilityId;
            return {
                capabilityId: canonicalProductCapabilityId,
                capability: commercialGap.capability,
                targetEngine: commercialGap.targetEngine,
                dependencies: commercialGap.dependencies
            };
        }

        const discovered = this.discovery.discover(root);
        const missingDiscovered = discovered.find(candidate => !candidate.requiredPaths.every(existsSync));
        if (missingDiscovered) {
            return {
                capabilityId: missingDiscovered.capabilityId,
                capability: missingDiscovered.capability,
                targetEngine: missingDiscovered.targetEngine,
                dependencies: missingDiscovered.dependencies
            };
        }
        return null;
    }
}
