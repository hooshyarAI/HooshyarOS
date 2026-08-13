import { MemoryEngine } from "../Core/MemoryEngine";
import { MemoryEvent } from "../Core/MemoryEvent";

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
