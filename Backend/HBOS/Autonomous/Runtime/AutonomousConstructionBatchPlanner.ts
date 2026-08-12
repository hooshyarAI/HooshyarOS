export interface ConstructionBatchCapability {
    capabilityId: string;
    owner: string;
    dependencies: string[];
}

export interface ConstructionBatch {
    batchId: number;
    capabilityIds: string[];
}

/**
 * Produces deterministic parallel-safe batches from a capability dependency graph.
 * Capabilities in the same batch have no dependency on one another and may be
 * delegated to isolated workers. Ownership is unique within a batch so two
 * workers never race on the same architectural owner.
 */
export class AutonomousConstructionBatchPlanner {
    plan(capabilities: ConstructionBatchCapability[]): ConstructionBatch[] {
        const byId = new Map(capabilities.map(capability => [capability.capabilityId, capability]));
        const remaining = new Map(byId);
        const completed = new Set<string>();
        const batches: ConstructionBatch[] = [];

        for (let batchId = 1; remaining.size > 0; batchId += 1) {
            const selectedOwners = new Set<string>();
            const ready: string[] = [];

            for (const [id, capability] of remaining) {
                const dependenciesReady = capability.dependencies.every(
                    dependency => completed.has(dependency) || !byId.has(dependency)
                );
                if (dependenciesReady && !selectedOwners.has(capability.owner)) {
                    ready.push(id);
                    selectedOwners.add(capability.owner);
                }
            }

            if (ready.length === 0) {
                const unresolved = [...remaining.keys()].sort();
                throw new Error(`AUTONOMOUS_BATCH_CYCLE_OR_UNRESOLVED_DEPENDENCY: ${unresolved.join(", ")}`);
            }

            ready.sort();
            batches.push({ batchId, capabilityIds: ready });
            for (const id of ready) {
                remaining.delete(id);
                completed.add(id);
            }
        }

        return batches;
    }
}
