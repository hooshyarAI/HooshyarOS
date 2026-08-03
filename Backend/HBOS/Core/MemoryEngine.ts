import { MemoryEvent } from "./MemoryEvent";


export class MemoryEngine {

    name: string = "MemoryEngine";

    private memories: MemoryEvent[] = [];


    initialize(): void {

        console.log("Memory Engine Started");

    }


    health(): boolean {

        return true;

    }


    store(event: MemoryEvent): void {

        this.memories.push(event);

    }


    retrieve(): MemoryEvent[] {

        return this.memories;

    }

}