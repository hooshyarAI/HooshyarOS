import { AutonomousRepairEngine } from "../RepairEngine/AutonomousRepairEngine";
import { ConstructionRepairExecutor } from "../RepairEngine/ConstructionRepairExecutor";

export interface RepairFailureContext {
    capabilityId?: string;
}

export class AutonomousRepairIntegrator {
    private readonly repair: AutonomousRepairEngine;

    constructor(root = process.cwd()) {
        this.repair = new AutonomousRepairEngine(new ConstructionRepairExecutor(root));
    }

    repairFailure(issue: string, output: string, context: RepairFailureContext = {}) {
        const plan = this.repair.createPlan(issue, output, context.capabilityId);
        return this.repair.execute(plan);
    }
}
