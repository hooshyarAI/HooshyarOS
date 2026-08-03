import { MemoryEvent } from "./MemoryEvent";
import { ReactionEngine } from "./ReactionEngine";


export class MemoryEngine {

    name: string = "MemoryEngine";

    private memories: MemoryEvent[] = [];

    private reactionEngine?: ReactionEngine;


    initialize(): void {

        console.log("Memory Engine Started");

    }


    health(): boolean {

        return true;

    }


    subscribe(reactionEngine: ReactionEngine): void {

        this.reactionEngine = reactionEngine;

    }


    store(event: MemoryEvent): void {

        this.memories.push(event);


        if (this.reactionEngine) {

            this.reactionEngine.react(event);

        }

    }


    retrieve(): MemoryEvent[] {

        return this.memories;

    }

}