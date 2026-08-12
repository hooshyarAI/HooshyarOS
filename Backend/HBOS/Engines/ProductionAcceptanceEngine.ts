import { Engine } from "../Core/Engine";
import { ProductionReadinessEngine } from "./ProductionReadinessEngine";
import { DeploymentReadinessEngine } from "./DeploymentReadinessEngine";
import { DeploymentContractEngine } from "./DeploymentContractEngine";
import { PerformanceTestingEngine } from "./PerformanceTestingEngine";
import { CustomerTestingEngine } from "./CustomerTestingEngine";
import { SecurityAuditEngine } from "./SecurityAuditEngine";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface ProductionAcceptanceResult {
    accepted: boolean;
    internalReady: boolean;
    evidence: {
        productionReadiness: boolean;
        deploymentReadiness: boolean;
        deploymentContract: boolean;
        performanceEvidence: boolean;
        customerEvidence: boolean;
        securityEvidence: boolean;
        coreArtifacts: boolean;
    };
    externalValidationRequired: boolean;
    blockers: string[];
}

/** Aggregates repository-native readiness evidence into one deterministic internal gate. */
export class ProductionAcceptanceEngine implements Engine {
    name = "ProductionAcceptanceEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    audit(root = process.cwd()): ProductionAcceptanceResult {
        const production = new ProductionReadinessEngine().audit(root);
        const deployment = new DeploymentReadinessEngine().audit(root);
        const performance = new PerformanceTestingEngine().audit(root);
        const customer = new CustomerTestingEngine().audit(root);
        const security = new SecurityAuditEngine().audit(root);
        const contract = new DeploymentContractEngine().validate({
            target: "production",
            artifact: "HooshyarOS",
            healthCheck: "/health",
            rollback: "previous-verified-commit"
        });
        const coreArtifacts = [
            "package.json",
            "tsconfig.json",
            "jest.config.js",
            "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts",
            "Backend/HBOS/Assistant/Autonomous/HooshyarAutonomousAssistant.ts",
            "Backend/AI_Runtime/autonomous_builder.py"
        ].every(path => existsSync(join(root, path)));
        const blockers: string[] = [];
        if (!production.ready) blockers.push(`production-readiness:${[...production.missingArtifacts, ...production.invalidArtifacts].join(",")}`);
        if (!deployment.ready) blockers.push(`deployment-readiness:${[...deployment.missingArtifacts, ...deployment.invalidArtifacts].join(",")}`);
        if (!contract.valid) blockers.push(`deployment-contract:${contract.missing.join(",")}`);
        if (!performance.ready) blockers.push(`performance:${performance.missingArtifacts.join(",")}`);
        if (!customer.ready) blockers.push(`customer-testing:${customer.missingArtifacts.join(",")}`);
        if (!security.ready) blockers.push(`security:${security.missingArtifacts.join(",")}`);
        if (!coreArtifacts) blockers.push("core-artifacts:missing");

        const internalReady = blockers.length === 0;
        return {
            accepted: internalReady,
            internalReady,
            evidence: {
                productionReadiness: production.ready,
                deploymentReadiness: deployment.ready,
                deploymentContract: contract.valid,
                performanceEvidence: performance.ready,
                customerEvidence: customer.ready,
                securityEvidence: security.ready,
                coreArtifacts
            },
            // External infrastructure, credentials, live traffic and customer sign-off remain outside repository evidence.
            externalValidationRequired: true,
            blockers
        };
    }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return {
            id: "platform.production-acceptance",
            capability: "implement repository-native Production Acceptance capability and complete the internal acceptance gate before external deployment validation",
            targetEngine: "Production Acceptance Engine"
        };
    }
}
