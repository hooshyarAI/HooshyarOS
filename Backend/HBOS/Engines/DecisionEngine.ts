import { ProjectDecision } from "../Entities/ProjectDecision";
import { Project } from "../Entities/Project";
import { DecisionContext } from "../Core/DecisionContext";


export class DecisionEngine {

    name: string = "DecisionEngine";

    initialize(): void {
        console.log("Decision Engine Started");
    }

    health(): boolean {
        return true;
    }

    /**
     * Make a decision based on project status and optional reasoning evidence.
     *
     * @param project - The project to decide on
     * @param evidence - Optional reasoning evidence from DecisionContext
     * @returns ProjectDecision with additive evidence fields
     */
    decide(
        project: Project,
        evidence?: DecisionContext
    ): ProjectDecision {
        let decision = "Maintain current project direction";

        if (project.status) {
            decision = `Analyze project status: ${project.status}`;
        }

        return new ProjectDecision(
            project.status,
            decision,
            evidence
        );
    }

}
