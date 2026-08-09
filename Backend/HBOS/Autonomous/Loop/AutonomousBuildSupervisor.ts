import { AutonomousBuilderLoop, AutonomousBuildRequest } from "./AutonomousBuilderLoop";
import { ConstructionTool } from "../../Builder/Autonomous/AutonomousConstructionEngine";

export interface BuildSupervisorCycle {
    cycle: number;
    status: "completed" | "blocked";
    result: ReturnType<AutonomousBuilderLoop["run"]>;
}

/**
 * Continuous autonomous supervisor: consumes the current architecture-driven
 * build contract and repeats bounded build/verify/repair cycles until success.
 * It never changes the architecture itself; architecture governance remains
 * the authority and the construction loop remains the executor.
 */
export class AutonomousBuildSupervisor {
    constructor(
        private readonly tools: ConstructionTool[],
        private readonly maxCycles = 100
    ) {}

    run(request: AutonomousBuildRequest): BuildSupervisorCycle[] {
        const cycles: BuildSupervisorCycle[] = [];
        for (let cycle = 1; cycle <= this.maxCycles; cycle += 1) {
            const result = new AutonomousBuilderLoop(this.tools).run(request);
            cycles.push({ cycle, status: result.status, result });
            if (result.status === "completed") return cycles;
        }
        return cycles;
    }

    static selfTest(): void {
        const tools: ConstructionTool[] = [
            { name: "architecture", execute: () => ({ ok: true }) },
            { name: "python", execute: () => ({ ok: true }) },
            { name: "git", execute: () => ({ ok: true }) }
        ];
        const cycles = new AutonomousBuildSupervisor(tools, 2).run({
            capabilityId: "supervisor-test",
            capability: "autonomous construction",
            targetEngine: "Autonomous Operations Engine",
            requestedBy: "self-test"
        });
        if (cycles.length !== 1 || cycles[0].status !== "completed") {
            throw new Error("AutonomousBuildSupervisor self-test failed");
        }
    }
}
