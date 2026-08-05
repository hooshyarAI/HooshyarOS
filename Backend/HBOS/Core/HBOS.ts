import { EngineRegistry } from "./EngineRegistry";

import { MemoryEngine } from "../Engines/MemoryEngine";
import { DecisionEngine } from "../Engines/DecisionEngine";
import { ProjectPilotEngine } from "../Engines/ProjectPilotEngine";
import { AssistantEngine } from "../Engines/AssistantEngine";
import { KnowledgeEngine } from "../Engines/KnowledgeEngine";
import { ReactionEngine } from "../Engines/ReactionEngine";

import { EngineDependencyManager } from "./Dependency/EngineDependencyManager";
import { BootDependencyValidator } from "./Dependency/BootDependencyValidator";


export class HBOS {


    private registry: EngineRegistry;

    private dependencyManager:
        EngineDependencyManager;


    private bootValidator:
        BootDependencyValidator;



    constructor() {


        this.registry =
            new EngineRegistry();



        this.dependencyManager =
            new EngineDependencyManager();



        this.bootValidator =
            new BootDependencyValidator(
                this.dependencyManager
            );



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


        this.setupDependencies();


    }



    private setupDependencies(){


        this.dependencyManager.registerDependency(
            "Assistant Engine",
            [
                "Memory Engine",
                "Knowledge Engine"
            ]
        );


    }




    boot(): boolean {


        const availableEngines = [

            "Memory Engine",
            "Reaction Engine",
            "Decision Engine",
            "Project Pilot Engine",
            "Knowledge Engine",
            "Assistant Engine"

        ];



        const assistantReady =
            this.bootValidator.canBoot(
                "Assistant Engine",
                availableEngines
            );



        if(!assistantReady){

            return false;

        }



        this.registry.initializeAll();


        return true;


    }




    health() {

        return this.registry.healthReport();

    }


}