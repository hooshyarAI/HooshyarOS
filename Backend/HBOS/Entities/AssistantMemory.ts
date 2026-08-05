export class AssistantMemory {


    private items: string[] = [];


    store(
        item: string
    ): void {

        this.items.push(item);

    }



    retrieve(): string[] {

        return this.items;

    }

}