import { EngineRegistry } from "./EngineRegistry";

import { MemoryEngine } from "../Engines/MemoryEngine";
import { DecisionEngine } from "../Engines/DecisionEngine";
import { ProjectPilotEngine } from "../Engines/ProjectPilotEngine";
import { AssistantEngine } from "../Engines/AssistantEngine";
import { KnowledgeEngine } from "../Engines/KnowledgeEngine";
import { ReactionEngine } from "../Engines/ReactionEngine";

import { EngineLifecycleManager } from "./Lifecycle/EngineLifecycleManager";
import { EngineLifecycleStatus } from "./Lifecycle/EngineLifecycleStatus";


export class HBOS {


    private registry: EngineRegistry;

    private lifecycle: EngineLifecycleManager;


    constructor() {


        this.registry = new EngineRegistry();

        this.lifecycle = new EngineLifecycleManager();



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

        this.lifecycle.registerEngine(
            "Memory Engine"
        );



        this.registry.register(
            reactionEngine
        );

        this.lifecycle.registerEngine(
            "Reaction Engine"
        );



        this.registry.register(
            decisionEngine
        );

        this.lifecycle.registerEngine(
            "Decision Engine"
        );



        this.registry.register(
            projectPilotEngine
        );

        this.lifecycle.registerEngine(
            "Project Pilot Engine"
        );



        this.registry.register(
            knowledgeEngine
        );

        this.lifecycle.registerEngine(
            "Knowledge Engine"
        );



        this.registry.register(
            assistantEngine
        );

        this.lifecycle.registerEngine(
            "Assistant Engine"
        );

    }



    boot(): void {


        this.registry.initializeAll();



        this.lifecycle.updateStatus(
            "Memory Engine",
            EngineLifecycleStatus.RUNNING
        );


        this.lifecycle.updateStatus(
            "Reaction Engine",
            EngineLifecycleStatus.RUNNING
        );


        this.lifecycle.updateStatus(
            "Decision Engine",
            EngineLifecycleStatus.RUNNING
        );


        this.lifecycle.updateStatus(
            "Project Pilot Engine",
            EngineLifecycleStatus.RUNNING
        );


        this.lifecycle.updateStatus(
            "Knowledge Engine",
            EngineLifecycleStatus.RUNNING
        );


        this.lifecycle.updateStatus(
            "Assistant Engine",
            EngineLifecycleStatus.RUNNING
        );


    }



    health() {

        return this.registry.healthReport();

    }



    lifecycleStatus() {

        return this.lifecycle;

    }


}