import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export interface DiscoveredCapability {
    capabilityId: string;
    capability: string;
    targetEngine: string;
    dependencies: string[];
    requiredPaths: string[];
}

/**
 * Discovers repository-owned construction capabilities from both canonical
 * engine contracts and the durable product construction roadmap.
 */
export class AutonomousCapabilityDiscovery {
    discover(root: string): DiscoveredCapability[] {
        const discovered = this.discoverEngineCapabilities(root);
        discovered.push(...this.discoverProductCapabilities(root));
        return discovered;
    }

    private discoverEngineCapabilities(root: string): DiscoveredCapability[] {
        const docsRoot = join(root, "Docs", "Engines");
        let files: string[];
        try {
            files = readdirSync(docsRoot).filter(name => name.endsWith("Engine.md")).sort();
        } catch {
            return [];
        }

        const discovered: DiscoveredCapability[] = [];
        for (const file of files) {
            const source = readFileSync(join(docsRoot, file), "utf8");
            const capabilityMatch = source.match(/Canonical autonomous capability:\s*`([^`]+)`/i);
            if (!capabilityMatch) continue;
            const capabilityId = capabilityMatch[1].trim();
            const name = basename(file, ".md");
            const capability = (source.match(/^Capability:\s*(.+)$/mi)?.[1] || capabilityId).trim();
            const dependencies = (source.match(/^Dependencies:\s*(.+)$/mi)?.[1] || "")
                .split(",")
                .map(value => value.trim())
                .filter(Boolean);
            discovered.push({
                capabilityId,
                capability,
                targetEngine: name,
                dependencies,
                requiredPaths: [
                    join(root, "Backend", "HBOS", "Engines", `${name}.ts`),
                    join(root, "Backend", "HBOS", "test", `${name}.test.ts`),
                    join(root, "Docs", "Engines", file)
                ]
            });
        }
        return discovered;
    }

    private discoverProductCapabilities(root: string): DiscoveredCapability[] {
        const roadmapPath = join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json");
        if (!existsSync(roadmapPath)) return [];

        try {
            const roadmap = JSON.parse(readFileSync(roadmapPath, "utf8")) as {
                capabilities?: Array<{
                    capabilityId?: string;
                    capability?: string;
                    targetEngine?: string;
                    dependencies?: string[];
                    implementationPath?: string;
                    testPath?: string;
                    documentationPath?: string;
                }>;
            };

            return (roadmap.capabilities || []).flatMap(candidate => {
                if (!candidate.capabilityId || !candidate.capability || !candidate.targetEngine) return [];
                const paths = [candidate.implementationPath, candidate.testPath, candidate.documentationPath];
                if (paths.some(path => !path)) return [];
                return [{
                    capabilityId: candidate.capabilityId,
                    capability: candidate.capability,
                    targetEngine: candidate.targetEngine,
                    dependencies: candidate.dependencies || [],
                    requiredPaths: paths.filter((path): path is string => Boolean(path)).map(path => join(root, path))
                }];
            });
        } catch {
            return [];
        }
    }
}
