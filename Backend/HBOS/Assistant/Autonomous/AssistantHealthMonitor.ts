import {
    CustomerRuntimeRepairContext,
    CustomerRuntimeRepairResult,
    CustomerRuntimeRepairSupervisor
} from "./CustomerRuntimeRepairSupervisor";

export class AssistantHealthMonitor {
    private readonly repairSupervisor = new CustomerRuntimeRepairSupervisor();

    check() {
        return {
            healthy: true,
            status: "HEALTHY",
            timestamp: new Date().toISOString()
        };
    }

    /** Entry point for governed automatic customer/runtime repair. */
    repairRuntimeFailure(context: CustomerRuntimeRepairContext): CustomerRuntimeRepairResult {
        return this.repairSupervisor.repair(context);
    }
}
