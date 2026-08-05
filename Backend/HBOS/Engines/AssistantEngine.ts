import { Project } from "../Entities/Project";
import { DecisionEngine } from "./DecisionEngine";
import { AssistantMemory } from "../Entities/AssistantMemory";
import { AssistantResponse } from "../Entities/AssistantResponse";


export class AssistantEngine {

    name: string = "AssistantEngine";


    private decisionEngine: DecisionEngine;

    private memory: AssistantMemory;


    constructor() {

        this.decisionEngine = new DecisionEngine();

        this.memory = new AssistantMemory();

    }


    initialize(): void {

        console.log(
            "Assistant Engine Started"
        );

    }


    health(): boolean {

        return true;

    }


    analyzeProject(
        project: Project
    ): AssistantResponse {


        const decision =
            this.decisionEngine.decide(
                project
            );


        this.memory.store(
            project.name
        );


        return new AssistantResponse(

            project,

            "HBOS Core",

            0.85

        );

    }


}