import { MemoryEvent } from "../Entities/MemoryEvent";

export class ReactionEngine {

    name: string = "ReactionEngine";

    initialize(): void {

        console.log("Reaction Engine Started");

    }

    health(): boolean {

        return true;

    }

    react(event: MemoryEvent): void {

        console.log(
            `[Reaction] ${event.type} | ${event.data} | ${event.source}`
        );

    }

}