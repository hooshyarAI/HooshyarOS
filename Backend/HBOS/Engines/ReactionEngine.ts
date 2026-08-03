import { MemoryEvent } from "./MemoryEvent";


export class ReactionEngine {

    name: string = "ReactionEngine";


    initialize(): void {

        console.log("Reaction Engine Started");

    }


    health(): boolean {

        return true;

    }


    react(event: MemoryEvent): string {

        if (event.type === "PROJECT_CREATED") {

            return "PROJECT_INSIGHT_REQUIRED";

        }


        return "NO_ACTION";

    }

}