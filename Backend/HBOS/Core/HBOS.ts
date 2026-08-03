import { EngineRegistry } from "./EngineRegistry";
import { MemoryEngine } from "./MemoryEngine";
import { DecisionEngine } from "./DecisionEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";


export class HBOS {

    private registry: EngineRegistry;


    constructor() {

        this.registry = new EngineRegistry();

        this.registry.register(new MemoryEngine());

        this.registry.register(new DecisionEngine());

        this.registry.register(new ProjectPilotEngine());

    }


    boot(): void {

        this.registry.initializeAll();

    }

}