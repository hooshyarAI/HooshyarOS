import { MemoryEvent } from "../Entities/MemoryEvent";
import { ReactionEngine } from "./ReactionEngine";
import { EventListener } from "../Interfaces/EventListener";


export class MemoryEngine {

    name: string = "MemoryEngine";


    private memories: MemoryEvent[] = [];


    private reactionEngine?: ReactionEngine;


    private listeners: EventListener[] = [];



    initialize(): void {

        console.log(
            "Memory Engine Started"
        );

    }



    health(): boolean {

        return true;

    }



    subscribe(
        reactionEngine: ReactionEngine
    ): void {

        this.reactionEngine =
            reactionEngine;

    }



    addListener(
        listener: EventListener
    ): void {

        this.listeners.push(
            listener
        );

    }



    store(
        event: MemoryEvent
    ): void {


        this.memories.push(
            event
        );



        // Notify Reaction Engine

        if (this.reactionEngine) {

            this.reactionEngine.react(
                event
            );

        }



        // Broadcast Event To Listeners

        this.listeners.forEach(

            listener => {

                listener.onEvent(
                    event
                );

            }

        );


    }



    retrieve(): MemoryEvent[] {

        return this.memories;

    }

}