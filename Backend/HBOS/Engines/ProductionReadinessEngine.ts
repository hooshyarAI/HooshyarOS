import { existsSync } from "node:fs";
import { join } from "node:path";
import { Engine } from "../Core/Engine";

export interface ProductionReadinessResult {
    ready: boolean;
    missingArtifacts: string[];
}

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
            "Assistant/SYSTEM_PROMPT.md"
        ];
        const missingArtifacts = required.filter(path => !existsSync(join(root, path)));
        return {
            ready: missingArtifacts.length === 0,
            missingArtifacts
        };
    }
}
