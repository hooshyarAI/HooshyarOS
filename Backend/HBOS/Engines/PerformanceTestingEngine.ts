import { existsSync } from "node:fs";
import { join } from "node:path";
import { Engine } from "../Core/Engine";

export interface PerformanceTestingResult {
    ready: boolean;
    missingArtifacts: string[];
}

/** Repository-native performance-test evidence boundary. */
export class PerformanceTestingEngine implements Engine {
    name = "PerformanceTestingEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    audit(root = process.cwd()): PerformanceTestingResult {
        const required = [
            "package.json",
            "tsconfig.json",
            "jest.config.js",
            "Backend/AI_Runtime/performance/performance_engine.py",
            "Backend/AI_Runtime/performance_engine/performance_engine.py",
            "Backend/HBOS/Engines/PerformanceTestingEngine.ts",
            "Backend/HBOS/test/PerformanceTestingEngine.test.ts",
            "Docs/Engines/PerformanceTestingEngine.md"
        ];
        const missingArtifacts = required.filter(path => !existsSync(join(root, path)));
        return {
            ready: missingArtifacts.length === 0,
            missingArtifacts
        };
    }
}
