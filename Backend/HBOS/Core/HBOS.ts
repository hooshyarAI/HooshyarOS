import { EngineRegistry } from "./EngineRegistry";
import { MemoryEngine } from "./MemoryEngine";
import { DecisionEngine } from "./DecisionEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";
import { AssistantEngine } from "./AssistantEngine";


export class HBOS {

    private registry: EngineRegistry;


    constructor() {

        this.registry = new EngineRegistry();


        this.registry.register(
            new MemoryEngine()
        );


        this.registry.register(
            new DecisionEngine()
        );


        this.registry.register(
            new ProjectPilotEngine()
        );


        this.registry.register(
            new AssistantEngine()
        );

    }


    boot(): void {

        this.registry.initializeAll();

    }


    health() {

        return this.registry.healthReport();

    }

}