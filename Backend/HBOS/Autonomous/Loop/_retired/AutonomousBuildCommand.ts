import { AutonomousBuildSupervisor } from "./AutonomousBuildSupervisor";
import { ConstructionTool } from "../../Builder/Autonomous/AutonomousConstructionEngine";

export class AutonomousBuildCommand {
    constructor(private readonly tools: ConstructionTool[]) {}

    execute() {
        const supervisor = new AutonomousBuildSupervisor(this.tools);
        return supervisor.run({
            capabilityId: "hooshyar-next-capability",
            capability: "continue construction from current architecture and repository state",
            targetEngine: "Autonomous Operations Engine",
            requestedBy: "HBOS"
        });
    }
}
