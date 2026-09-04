import { EngineRegistry } from "./EngineRegistry";

import { MemoryEngine } from "../Engines/MemoryEngine";
import { DecisionEngine } from "../Engines/DecisionEngine";
import { ProjectPilotEngine } from "../Engines/ProjectPilotEngine";
import { AssistantEngine } from "../Engines/AssistantEngine";
import { KnowledgeEngine } from "../Engines/KnowledgeEngine";
import { ReactionEngine } from "../Engines/ReactionEngine";
import { ReasoningEngine } from "../Engines/ReasoningEngine";
import { GovernanceEngine } from "../Engines/GovernanceEngine";
import { ExecutiveIntelligenceEngine } from "../Engines/ExecutiveIntelligenceEngine";
import { OrganizationalIntelligenceEngine } from "../Engines/OrganizationalIntelligenceEngine";
import { AutonomousOperationsEngine } from "../Engines/AutonomousOperationsEngine";
import { IntelligenceEngine } from "../Engines/IntelligenceEngine";
import { OrchestratedDecisionIntelligenceService } from "../Product/OrchestratedDecisionIntelligenceService";
import { MemoryEvent } from "./MemoryEvent";

import { EngineDependencyManager } from "./Dependency/EngineDependencyManager";
import { BootDependencyValidator } from "./Dependency/BootDependencyValidator";



export class HBOS {



    private registry: EngineRegistry;

    private dependencyManager:
        EngineDependencyManager;



    private bootValidator:
        BootDependencyValidator;

    private memoryEngine: MemoryEngine;

    private knowledgeEngine: KnowledgeEngine;



    constructor() {



        this.registry =
            new EngineRegistry();



        this.dependencyManager =
            new EngineDependencyManager();



        this.bootValidator =
            new BootDependencyValidator(
                this.dependencyManager
            );



        this.memoryEngine =
            new MemoryEngine();



        const reactionEngine =
            new ReactionEngine();



        const decisionEngine =
            new DecisionEngine();



        const projectPilotEngine =
            new ProjectPilotEngine();



        this.knowledgeEngine =
            new KnowledgeEngine();



        const orchestratedDecisionIntelligenceService =
            new OrchestratedDecisionIntelligenceService();



        const assistantEngine =
            new AssistantEngine({
                orchestrated: orchestratedDecisionIntelligenceService
            });

        const intelligenceEngine =
            new IntelligenceEngine();



        const reasoningEngine =
            new ReasoningEngine();



        const governanceEngine =
            new GovernanceEngine();



        const executiveIntelligenceEngine =
            new ExecutiveIntelligenceEngine();



        const organizationalIntelligenceEngine =
            new OrganizationalIntelligenceEngine();



        const autonomousOperationsEngine =
            new AutonomousOperationsEngine();



        this.memoryEngine.subscribe(
            reactionEngine
        );



        this.memoryEngine.addListener(
            this.knowledgeEngine
        );



        this.registry.register(
            this.memoryEngine
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
            this.knowledgeEngine
        );



        this.registry.register(
            assistantEngine
        );



        this.registry.register(
            intelligenceEngine
        );



        this.registry.register(
            reasoningEngine
        );



        this.registry.register(
            governanceEngine
        );



        this.registry.register(
            executiveIntelligenceEngine
        );



        this.registry.register(
            organizationalIntelligenceEngine
        );



        this.registry.register(
            autonomousOperationsEngine
        );



        this.setupDependencies();



    }



    getMemoryEngine(): MemoryEngine {
        return this.memoryEngine;
    }

    getKnowledgeEngine(): KnowledgeEngine {
        return this.knowledgeEngine;
    }



    private setupDependencies(){



        this.dependencyManager.registerDependency(
            "Assistant Engine",
            [
                "Memory Engine",
                "Knowledge Engine"
            ]
        );



        this.dependencyManager.registerDependency(
            "Intelligence Engine",
            [
                "Knowledge Engine",
                "Memory Engine"
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
            "Assistant Engine",
            "Intelligence Engine"

        ];




        const assistantReady =
            this.bootValidator.canBoot(
                "Assistant Engine",
                availableEngines
            );



        if(!assistantReady){

            return false;

        }



        const intelligenceReady =
            this.bootValidator.canBoot(
                "Intelligence Engine",
                availableEngines
            );



        if(!intelligenceReady){

            return false;

        }



        this.registry.initializeAll();



        const bootEvent = new MemoryEvent(
            "HBOS_BOOT",
            "HBOS platform initialized",
            "HBOS"
        );

        this.memoryEngine.store(bootEvent);

        return true;



    }



    health() {

        return this.registry.healthReport();

    }



}
