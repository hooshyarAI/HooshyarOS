import { Project } from "./Project";
import { DecisionEngine } from "./DecisionEngine";
import { AssistantContext } from "./AssistantContext";
import { AssistantMemory } from "./AssistantMemory";
import { MemoryEngine } from "./MemoryEngine";
import { AssistantReasoning } from "./AssistantReasoning";


export class AssistantEngine {

    name: string = "AssistantEngine";


    private decisionEngine: DecisionEngine;
    private assistantMemory: AssistantMemory;
    private reasoning: AssistantReasoning;


    constructor() {

        this.decisionEngine =
            new DecisionEngine();


        this.assistantMemory =
            new AssistantMemory(
                new MemoryEngine()
            );


        this.reasoning =
            new AssistantReasoning();

    }


    initialize(): void {

        console.log(
            "Assistant Engine Started"
        );

    }


    health(): boolean {

        return true;

    }


    createContext(
        project: Project
    ): AssistantContext {


        return new AssistantContext(
            project,
            this.assistantMemory
                .getRecentEvents()
        );

    }


    analyzeProject(
        context: AssistantContext
    ): string {


        const reasoning =
            this.reasoning
                .analyze(context);


        const decision =
            this.decisionEngine
                .evaluateProject(
                    context.project.status
                );


        return `
${context.summary()}

Reasoning:
${reasoning}

Decision:
${decision.message}
        `.trim();

    }

}