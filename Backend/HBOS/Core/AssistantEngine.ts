import { Project } from "../Entities/Project";
import { DecisionEngine } from "../Engines/DecisionEngine";
import { AssistantContext } from "./AssistantContext";
import { AssistantMemory } from "./AssistantMemory";
import { MemoryEngine } from "../Engines/MemoryEngine";
import { AssistantReasoning } from "./AssistantReasoning";
import { AssistantResponse } from "./AssistantResponse";
import { AssistantConfidence } from "./AssistantConfidence";


export class AssistantEngine {

    name: string = "AssistantEngine";


    private decisionEngine: DecisionEngine;
    private assistantMemory: AssistantMemory;
    private reasoning: AssistantReasoning;
    private confidence: AssistantConfidence;


    constructor() {

        this.decisionEngine =
            new DecisionEngine();


        this.assistantMemory =
            new AssistantMemory(
                new MemoryEngine()
            );


        this.reasoning =
            new AssistantReasoning();


        this.confidence =
            new AssistantConfidence();

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
    ): AssistantResponse {


        const reasoning =
            this.reasoning
                .analyze(context);


        const decision =
            this.decisionEngine
                .evaluateProject(
                    context.project.status
                );


        const confidence =
            this.confidence
                .calculate(context);


        return new AssistantResponse(

            context.summary(),


            `${reasoning}

Decision:
${decision.message}`,


            confidence

        );

    }

}