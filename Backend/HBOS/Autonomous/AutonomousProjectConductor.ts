import { AutonomousBuildSupervisor, BuildSupervisorCycle } from "./Loop/AutonomousBuildSupervisor";
import { ConstructionTool } from "../Builder/Autonomous/AutonomousConstructionEngine";

export interface ProjectInventory { files: string[]; capabilities: string[]; }
export interface ProjectGap { capabilityId: string; capability: string; targetEngine: string; }

/** Turns the repository state into the next governed construction action. */
export class AutonomousProjectConductor {
    constructor(private readonly tools: ConstructionTool[]) {}

    inspect(inventory: ProjectInventory): ProjectGap[] {
        const known = new Set(inventory.capabilities);
        const gaps: ProjectGap[] = [];
        if (!known.has("autonomous-self-healing")) {
            gaps.push({ capabilityId: "autonomous-self-healing", capability: "platform self-healing", targetEngine: "Autonomous Operations Engine" });
        }
        return gaps;
    }

    execute(inventory: ProjectInventory): BuildSupervisorCycle[][] {
        return this.inspect(inventory).map(gap =>
            new AutonomousBuildSupervisor(this.tools).run(gap)
        );
    }

    static selfTest(): void {
        const conductor = new AutonomousProjectConductor([
            { name: "architecture", execute: () => ({ ok: true }) },
            { name: "codex", execute: () => ({ ok: true }) },
            { name: "python", execute: () => ({ ok: true }) },
            { name: "git", execute: () => ({ ok: true }) }
        ]);
        const result = conductor.execute({ files: [], capabilities: [] });
        if (result.length !== 1 || result[0][0]?.status !== "completed") {
            throw new Error("AutonomousProjectConductor self-test failed");
        }
    }
}
