import { Project } from "./Project";
import { DecisionEngine } from "./DecisionEngine";


export class AssistantEngine {

    name: string = "AssistantEngine";

    private decisionEngine: DecisionEngine;


    constructor() {

        this.decisionEngine = new DecisionEngine();

    }


    initialize(): void {

        console.log("Assistant Engine Started");

    }


    health(): boolean {

        return true;

    }


    analyzeProject(project: Project): string {

        const decision =
            this.decisionEngine.evaluateProject(
                project.status
            );


        return `
Project: ${project.name}

Status: ${project.status}

Assistant Suggestion:
${decision.message}
        `.trim();

    }

}