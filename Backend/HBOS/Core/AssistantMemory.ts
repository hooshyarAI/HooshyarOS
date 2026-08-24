import { MemoryEngine } from "../Engines/MemoryEngine";
import { MemoryEvent } from "../Entities/MemoryEvent";

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
