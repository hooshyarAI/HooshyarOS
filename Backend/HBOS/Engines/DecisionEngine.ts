import { ProjectDecision } from "../Entities/ProjectDecision";
import { Project } from "../Entities/Project";


export class DecisionEngine {


    name: string = "DecisionEngine";



    initialize(): void {

        console.log(
            "Decision Engine Started"
        );

    }



    health(): boolean {

        return true;

    }



    decide(
        project: Project
    ): ProjectDecision {


        let decision =
            "Maintain current project direction";



        if (project.status) {

            decision =
                `Analyze project status: ${project.status}`;

        }



        return new ProjectDecision(

            project.status,

            decision

        );


    }



}