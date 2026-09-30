import { MemoryEngine, MEMORY_INTERNAL_SCOPE } from "./MemoryEngine";
import { MemoryEvent } from "./MemoryEvent";


export class AssistantMemory {

    private memoryEngine: MemoryEngine;


    constructor(memoryEngine: MemoryEngine) {

        this.memoryEngine = memoryEngine;

    }


    getRecentEvents(): MemoryEvent[] {

        return this.memoryEngine.retrieve(MEMORY_INTERNAL_SCOPE);

    }


    countEvents(): number {

        return this.getRecentEvents().length;

    }

}