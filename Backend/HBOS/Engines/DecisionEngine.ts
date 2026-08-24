import { ProjectDecision } from "../Entities/ProjectDecision";
import { Project } from "../Entities/Project";
import { ProjectStatus } from "../Entities/ProjectStatus";

export class DecisionEngine {
    name: string = "DecisionEngine";

    initialize(): void {
        console.log("Decision Engine Started");
    }

    health(): boolean {
        return true;
    }

    decide(project: Project): ProjectDecision {
        switch (project.status) {
            case ProjectStatus.Planning:
                return new ProjectDecision(project.status, "Start project planning");
            case ProjectStatus.Active:
                return new ProjectDecision(project.status, "Monitor project progress");
            case ProjectStatus.Completed:
                return new ProjectDecision(project.status, "Review project results");
            case ProjectStatus.Archived:
                return new ProjectDecision(project.status, "Archive project records");
            default:
                return new ProjectDecision(project.status, "Unknown status");
        }
    }

    evaluateProject(status: ProjectStatus): ProjectDecision {
        return this.decide({ status } as Project);
    }
}
