import { Engine } from "../Core/Engine";
import { DecisionEngine } from "./DecisionEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";
import { GovernanceEngine } from "./GovernanceEngine";

export interface OperationResult {
    operation: string;
    status: "READY" | "BLOCKED";
    projectCount: number;
}

/** Canonical autonomous-operations owner; coordinates existing decision, project and governance owners. */
export class AutonomousOperationsEngine implements Engine {
    name = "AutonomousOperationsEngine";
    private readonly decisions = new DecisionEngine();
    private readonly projects = new ProjectPilotEngine();
    private readonly governance = new GovernanceEngine();

    initialize(): void {
        this.decisions.initialize();
        this.projects.initialize();
        this.governance.initialize();
        console.log("AutonomousOperationsEngine Started");
    }

    health(): boolean {
        return true;
    }

    execute(operation: string): OperationResult {
        if (!operation || !operation.trim()) {
            return { operation, status: "BLOCKED", projectCount: this.projects.getProjects().length };
        }

        return {
            operation,
            status: this.health() ? "READY" : "BLOCKED",
            projectCount: this.projects.getProjects().length
        };
    }
}
