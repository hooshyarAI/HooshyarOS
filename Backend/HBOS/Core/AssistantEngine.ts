import { Project } from "./Project";
import { DecisionEngine } from "./DecisionEngine";
import { AssistantContext } from "./AssistantContext";
import { MemoryEvent } from "./MemoryEvent";
import { AssistantMemory } from "./AssistantMemory";
import { MemoryEngine } from "./MemoryEngine";


export class AssistantEngine {

    name: string = "AssistantEngine";

    private decisionEngine: DecisionEngine;
    private assistantMemory: AssistantMemory;


    constructor() {

        this.decisionEngine = new DecisionEngine();

        this.assistantMemory =
            new AssistantMemory(
                new MemoryEngine()
            );

    }


    initialize(): void {

        console.log("Assistant Engine Started");

    }


    health(): boolean {

        return true;

    }


    createContext(
        project: Project
    ): AssistantContext {


        const memories =
            this.assistantMemory
                .getRecentEvents();


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