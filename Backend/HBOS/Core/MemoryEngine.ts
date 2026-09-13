import { MemoryEvent } from './MemoryEvent';
import { ReactionEngine } from './ReactionEngine';
import { EventListener } from '../Interfaces/EventListener';


export class MemoryEngine {


    name: string = 'MemoryEngine';


    private memories: MemoryEvent[] = [];


    private reactionEngine?: ReactionEngine;


    private listeners: EventListener[] = [];


    initialize(): void {


        console.log('Memory Engine Started');



    }





    health(): boolean {


        return true;



    }





    subscribe(reactionEngine: ReactionEngine): void {


        this.reactionEngine = reactionEngine;



    }





    addListener(listener: EventListener): void {


        this.listeners.push(listener);



    }





    store(event: MemoryEvent, tenantId?: string): void {


        if (tenantId !== undefined && event.tenantId === undefined) {


            event.tenantId = tenantId;


        }


        this.memories.push(event);



        if (this.reactionEngine) {


            this.reactionEngine.react(event);



        }


        for (const listener of this.listeners) {


            listener.onEvent(event);



        }



    }





    retrieve(tenantId?: string): MemoryEvent[] {


        if (tenantId === undefined) {


            return this.memories;


        }


        return this.memories.filter(event => event.tenantId === tenantId);



    }


}
