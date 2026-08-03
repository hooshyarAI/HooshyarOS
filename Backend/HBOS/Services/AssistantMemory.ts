import { MemoryEngine } from "./MemoryEngine";
import { MemoryEvent } from "./MemoryEvent";


export class AssistantMemory {

    private memoryEngine: MemoryEngine;


    constructor(memoryEngine: MemoryEngine) {

        this.memoryEngine = memoryEngine;

    }


    getRecentEvents(): MemoryEvent[] {

        return this.memoryEngine.retrieve();

    }


    countEvents(): number {

        return this.getRecentEvents().length;

    }

}