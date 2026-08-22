import { CapabilityDefinition, CapabilityDiscovery } from "./CapabilityDiscovery";
import { CapabilityEvidenceAdapter } from "./CapabilityEvidenceAdapter";
import { CapabilityMatrix } from "./CapabilityMatrix";
import { ActionPriority, AutonomousActionPlan, AutonomousActionPlanner } from "./AutonomousActionPlanner";

export class AutonomousPlanningPipeline {
    constructor(
        private readonly discovery: CapabilityDiscovery,
        private readonly adapter = new CapabilityEvidenceAdapter(),
        private readonly matrix = new CapabilityMatrix(),
        private readonly planner = new AutonomousActionPlanner(),
    ) {}

    plan(
        definitions: CapabilityDefinition[],
        priorities: Record<string, ActionPriority>,
    ): AutonomousActionPlan[] {
        const discovered = this.discovery.discover(definitions);
        const gateEvidence = discovered.map((capability) => this.adapter.toGateEvidence(capability));
        const snapshots = this.matrix.evaluate(
            discovered.map((capability, index) => ({
                name: capability.name,
                evidence: gateEvidence[index],
            })),
        );

        return this.planner.plan(
            discovered.map((capability, index) => {
                const snapshot = snapshots[index];
                const priority = priorities[capability.name];
                if (!priority) {
                    throw new Error(`No priority definition supplied for capability: ${capability.name}`);
                }
                return {
                    name: capability.name,
                    stage: snapshot.stage,
                    blockers: snapshot.blockers,
                    missingPaths: capability.missingPaths,
                    priority,
                };
            }),
        );
    }
}
