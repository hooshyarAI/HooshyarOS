import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

export interface ArchitectureTarget {
    engines: string[];
    requiredCapabilities: string[];
    architectureRules: string[];
}

export interface ProjectInventory {
    files: string[];
    directories: string[];
    capabilities: string[];
    builders: string[];
    agents: string[];
    planners: string[];
    repairers: string[];
    tools: string[];
}

export interface AutonomousGap {
    id: string;
    kind: "missing" | "incomplete" | "duplicate";
    description: string;
    evidence: string[];
    priority: number;
}

export interface AutonomousRoadmap {
    inventory: ProjectInventory;
    gaps: AutonomousGap[];
    nextAction: AutonomousGap | null;
    status: "READY" | "COMPLETE";
}

/** Project-level observer and gap planner for autonomous construction. */
export class AutonomousProjectConductor {
    constructor(private readonly root: string) {}

    inspect(target: ArchitectureTarget): AutonomousRoadmap {
        const inventory = this.inventory();
        const gaps = this.findGaps(inventory, target).sort((a, b) => b.priority - a.priority);
        return {
            inventory,
            gaps,
            nextAction: gaps[0] || null,
            status: gaps.length ? "READY" : "COMPLETE"
        };
    }

    private inventory(): ProjectInventory {
        const files: string[] = [];
        const directories: string[] = [];
        const buckets = {
            capabilities: [] as string[], builders: [] as string[], agents: [] as string[],
            planners: [] as string[], repairers: [] as string[], tools: [] as string[]
        };
        const walk = (directory: string) => {
            for (const entry of readdirSync(directory)) {
                const full = join(directory, entry);
                const rel = relative(this.root, full).replace(/\\/g, "/");
                const stat = statSync(full);
                if (stat.isDirectory()) {
                    directories.push(rel);
                    if (!entry.startsWith(".") && entry !== "node_modules") walk(full);
                    continue;
                }
                files.push(rel);
                const lower = rel.toLowerCase();
                if (/(engine|runtime|capability)/.test(lower)) buckets.capabilities.push(rel);
                if (/(builder|construction)/.test(lower)) buckets.builders.push(rel);
                if (/(agent)/.test(lower)) buckets.agents.push(rel);
                if (/(planner|planning)/.test(lower)) buckets.planners.push(rel);
                if (/(repair|self.?heal|recovery)/.test(lower)) buckets.repairers.push(rel);
                if (/(tool|registry|executor)/.test(lower)) buckets.tools.push(rel);
            }
        };
        walk(this.root);
        return { files, directories, ...buckets };
    }

    private findGaps(inventory: ProjectInventory, target: ArchitectureTarget): AutonomousGap[] {
        const gaps: AutonomousGap[] = [];
        const text = this.readProjectText(inventory.files);
        for (const engine of target.engines) {
            if (!text.includes(engine)) gaps.push({
                id: `engine:${engine}`, kind: "missing",
                description: "Target engine is not evidenced in the repository",
                evidence: [engine], priority: 100
            });
        }
        for (const capability of target.requiredCapabilities) {
            if (!text.toLowerCase().includes(capability.toLowerCase())) gaps.push({
                id: `capability:${capability}`, kind: "missing",
                description: "Required capability is not evidenced in the repository",
                evidence: [capability], priority: 90
            });
        }
        for (const name of this.duplicateNames(inventory.builders)) gaps.push({
            id: `duplicate-builder:${name}`, kind: "duplicate",
            description: "Multiple builder implementations may own the same responsibility",
            evidence: inventory.builders.filter(file => file.toLowerCase().includes(name)), priority: 70
        });
        if (!inventory.repairers.length) gaps.push({
            id: "self-healing:fabric", kind: "missing",
            description: "No repair/recovery implementation is discoverable", evidence: [], priority: 95
        });
        if (!inventory.tools.length) gaps.push({
            id: "tools:fabric", kind: "missing",
            description: "No construction tool fabric is discoverable", evidence: [], priority: 95
        });
        return gaps;
    }

    private duplicateNames(files: string[]): string[] {
        const names = new Map<string, number>();
        for (const file of files) {
            const name = file.split("/").pop()!.replace(/\.(ts|tsx|js|py)$/i, "").toLowerCase();
            names.set(name, (names.get(name) || 0) + 1);
        }
        return [...names.entries()].filter(([, count]) => count > 1).map(([name]) => name);
    }

    private readProjectText(files: string[]): string {
        return files.filter(file => /\.(ts|tsx|js|json|md|py)$/i.test(file)).slice(0, 5000)
            .map(file => { try { return readFileSync(join(this.root, file), "utf8"); } catch { return ""; } })
            .join("\n");
    }
}
