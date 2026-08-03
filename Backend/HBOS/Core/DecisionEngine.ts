import { ProjectStatus } from "./ProjectStatus";
import { ProjectDecision } from "./ProjectDecision";


export class DecisionEngine {

    name: string = "DecisionEngine";


    initialize(): void {

        console.log("Decision Engine Started");

    }


    health(): boolean {

        return true;

    }


    evaluateProject(status: ProjectStatus): ProjectDecision {

        switch(status) {

            case ProjectStatus.Planning:

                return new ProjectDecision(
                    status,
                    "Start project planning"
                );


            case ProjectStatus.Active:

                return new ProjectDecision(
                    status,
                    "Monitor project progress"
                );


            case ProjectStatus.Completed:

                return new ProjectDecision(
                    status,
                    "Review project results"
                );


            case ProjectStatus.Archived:

                return new ProjectDecision(
                    status,
                    "Archive project records"
                );


            default:

                return new ProjectDecision(
                    status,
                    "Unknown status"
                );

        }

    }

}