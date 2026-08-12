import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Engine } from "../Core/Engine";

export interface ProductionReadinessResult {
    ready: boolean;
    missingArtifacts: string[];
    invalidArtifacts: string[];
    externalValidationRequired: boolean;
}

/** Repository-native production-readiness boundary. */
export class ProductionReadinessEngine implements Engine {
    name = "ProductionReadinessEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    audit(root = process.cwd()): ProductionReadinessResult {
        const required = [
            "package.json",
            "tsconfig.json",
            "jest.config.js",
            "Docs/ARCHITECTURE.md",
            "Docs/ROADMAP.md",
            "AGENTS.md",
            "Assistant/SYSTEM_PROMPT.md",
            "Backend/AI_Runtime/autonomous_builder.py",
            "Backend/AI_Runtime/reasoning/reasoning_engine.py",
            "Backend/HBOS/Assistant/Autonomous/HooshyarAutonomousAssistant.ts",
            "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts",
            "Backend/HBOS/Engines/ProductionReadinessEngine.ts",
            "Backend/HBOS/Engines/SecurityAuditEngine.ts",
            "Backend/HBOS/Engines/PerformanceTestingEngine.ts",
            "Backend/HBOS/Engines/CustomerTestingEngine.ts",
            "Backend/HBOS/Engines/DeploymentReadinessEngine.ts",
            "Backend/HBOS/Engines/DeploymentContractEngine.ts",
            "Backend/HBOS/Engines/CloudDeploymentEngine.ts",
            "Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts",
            "Backend/AI_Runtime/cloud_deployment.py"
        ];
        const missingArtifacts = required.filter(path => !existsSync(join(root, path)));
        const invalidArtifacts: string[] = [];

        const packageJson = join(root, "package.json");
        if (existsSync(packageJson)) {
            try {
                const pkg = JSON.parse(readFileSync(packageJson, "utf8")) as { scripts?: Record<string, string> };
                if (!pkg.scripts?.["autonomous:build"]) invalidArtifacts.push("package.json: autonomous:build script");
            } catch {
                invalidArtifacts.push("package.json: invalid JSON");
            }
        }

        const daemon = join(root, "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts");
        if (existsSync(daemon)) {
            const source = readFileSync(daemon, "utf8");
            if (!/AUTONOMOUS_PLATFORM_CONSTRUCTION_COMPLETE/.test(source)) {
                invalidArtifacts.push("AutonomousBuildDaemon.ts: completion gate");
            }
        }

        const deploymentController = join(root, "Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts");
        if (existsSync(deploymentController)) {
            const source = readFileSync(deploymentController, "utf8");
            if (!/export class DeploymentController/.test(source) || !/deploy\s*\(/.test(source)) {
                invalidArtifacts.push("DeploymentController.ts: deploy contract");
            }
        }

        return {
            ready: missingArtifacts.length === 0 && invalidArtifacts.length === 0,
            missingArtifacts,
            invalidArtifacts,
            // Repository evidence cannot prove real external infrastructure,
            // credentials, customer acceptance, or cloud execution.
            externalValidationRequired: true
        };
    }
}
