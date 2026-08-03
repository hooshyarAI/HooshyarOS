export class MemoryEngine {

    name: string = "MemoryEngine";

    private memories: string[] = [];


    initialize(): void {

        console.log("Memory Engine Started");

    }


    health(): boolean {

        return true;

    }


    store(memory: string): void {

        this.memories.push(memory);

    }


    retrieve(): string[] {

        return this.memories;

    }

}