import { EngineRegistry } from "./EngineRegistry";

import { MemoryEngine } from "../Engines/MemoryEngine";
import { DecisionEngine } from "../Engines/DecisionEngine";
import { ProjectPilotEngine } from "../Engines/ProjectPilotEngine";
import { AssistantEngine } from "../Engines/AssistantEngine";
import { KnowledgeEngine } from "../Engines/KnowledgeEngine";
import { ReactionEngine } from "../Engines/ReactionEngine";


export class HBOS {


    private registry: EngineRegistry;


    constructor() {


        this.registry = new EngineRegistry();


        const memoryEngine =
            new MemoryEngine();


        const reactionEngine =
            new ReactionEngine();


        const decisionEngine =
            new DecisionEngine();


        const projectPilotEngine =
            new ProjectPilotEngine();


        const knowledgeEngine =
            new KnowledgeEngine();


        const assistantEngine =
            new AssistantEngine();



        memoryEngine.subscribe(
            reactionEngine
        );


        this.registry.register(
            memoryEngine
        );


        this.registry.register(
            reactionEngine
        );


        this.registry.register(
            decisionEngine
        );


        this.registry.register(
            projectPilotEngine
        );


        this.registry.register(
            knowledgeEngine
        );


        this.registry.register(
            assistantEngine
        );


    }



    boot(): void {

        this.registry.initializeAll();

    }



    health() {

        return this.registry.healthReport();

    }

}