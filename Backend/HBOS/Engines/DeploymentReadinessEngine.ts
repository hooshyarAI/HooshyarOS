import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Engine } from "../Core/Engine";

export interface DeploymentReadinessResult {
    ready: boolean;
    missingArtifacts: string[];
    invalidArtifacts: string[];
}

/** Repository-native evidence boundary for deployment readiness. */
export class DeploymentReadinessEngine implements Engine {
    name = "DeploymentReadinessEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    audit(root = process.cwd()): DeploymentReadinessResult {
        const required = [
            "package.json",
            "tsconfig.json",
            "jest.config.js",
            "Docs/ROADMAP.md",
            "Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts"
        ];
        const missingArtifacts = required.filter(path => !existsSync(join(root, path)));
        const invalidArtifacts: string[] = [];

        const deploymentController = join(root, "Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts");
        if (existsSync(deploymentController)) {
            const source = readFileSync(deploymentController, "utf8");
            if (!/export class DeploymentController/.test(source) || !/deploy\s*\(/.test(source)) {
                invalidArtifacts.push("Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts");
            }
        }

        return {
            ready: missingArtifacts.length === 0 && invalidArtifacts.length === 0,
            missingArtifacts,
            invalidArtifacts
        };
    }
}
