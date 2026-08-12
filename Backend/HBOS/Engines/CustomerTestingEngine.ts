import { existsSync } from "node:fs";
import { join } from "node:path";
import { Engine } from "../Core/Engine";

export interface CustomerTestingResult {
    ready: boolean;
    missingArtifacts: string[];
}

/** Repository-native customer-testing evidence boundary. */
export class CustomerTestingEngine implements Engine {
    name = "CustomerTestingEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    audit(root = process.cwd()): CustomerTestingResult {
        const required = [
            "package.json",
            "tsconfig.json",
            "jest.config.js",
            "Backend/HBOS/Engines/PerformanceTestingEngine.ts",
            "Backend/HBOS/test/PerformanceTestingEngine.test.ts",
            "Backend/HBOS/Engines/CustomerTestingEngine.ts",
            "Backend/HBOS/test/CustomerTestingEngine.test.ts",
            "Docs/Engines/CustomerTestingEngine.md"
        ];
        const missingArtifacts = required.filter(path => !existsSync(join(root, path)));
        return {
            ready: missingArtifacts.length === 0,
            missingArtifacts
        };
    }
}
