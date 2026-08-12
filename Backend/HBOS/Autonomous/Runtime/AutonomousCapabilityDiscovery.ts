import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export interface DiscoveredCapability {
    capabilityId: string;
    capability: string;
    targetEngine: string;
    dependencies: string[];
    requiredPaths: string[];
}

/** Discovers future engine capabilities from repository-owned engine contracts. */
export class AutonomousCapabilityDiscovery {
    discover(root: string): DiscoveredCapability[] {
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
}
