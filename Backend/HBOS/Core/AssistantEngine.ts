import { Project } from "./Project";
import { DecisionEngine } from "./DecisionEngine";
import { AssistantContext } from "./AssistantContext";
import { MemoryEvent } from "./MemoryEvent";


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


    createContext(
        project: Project,
        memories: MemoryEvent[]
    ): AssistantContext {

        return new AssistantContext(
            project,
            memories
        );

    }


    analyzeProject(
        context: AssistantContext
    ): string {


        const decision =
            this.decisionEngine.evaluateProject(
                context.project.status
            );


        return `
${context.summary()}

Assistant Suggestion:
${decision.message}
        `.trim();

    }

}