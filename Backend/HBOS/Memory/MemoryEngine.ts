export interface MemoryRecord {

    id: string;

    category: string;

    title: string;

    content: string;

    createdAt: Date;

}

export class MemoryEngine {

    private memory: MemoryRecord[] = [];

    initialize(): void {

        console.log("Memory Engine Ready.");

    }

    add(record: MemoryRecord): void {

        this.memory.push(record);

    }

    getAll(): MemoryRecord[] {

        return this.memory;

    }

    search(category: string): MemoryRecord[] {

        return this.memory.filter(

            m => m.category === category

        );

    }

    health(): boolean {

        return true;

    }

}