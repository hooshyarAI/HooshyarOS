// MemoryEngine - Event Storage and Reaction Notification System
// Supporting Component: Manages system memory events and notifies reaction engines

/**
 * Memory Engine
 * 
 * Role:
 * - Store information events in system memory
 * - Retrieve context from stored events
 * - Maintain system memory persistence
 * 
 * Functions:
 * - store(event): Add event to memory and notify reaction engine
 * - retrieve(): Get all stored memory events
 * - subscribe(reactionEngine): Link reaction engine for event notification
 * - addListener(listener): Add event listener for broadcasting
 * - react(event): Internal reaction processing (delegated to ReactionEngine)
 * 
 * Status: Implemented
 * 
 * Note: This engine does NOT implement the Engine interface.
 * It is a supporting service that provides memory storage functionality
 * for the broader HBOS ecosystem, particularly for the Organizational
 * Intelligence Engine which composes this engine.
 */

export class MemoryEngine {
    name: string = "MemoryEngine";
    private memories: MemoryEvent[] = [];
    private reactionEngine?: ReactionEngine;
    private listeners: EventListener[] = [];

    initialize(): void {
        console.log("Memory Engine Started");
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

    store(event: MemoryEvent): void {
        this.memories.push(event);
        // Notify Reaction Engine
        if (this.reactionEngine) {
            this.reactionEngine.react(event);
        }
        // Broadcast Event To Listeners
        this.listeners.forEach(listener => {
            listener.onEvent(event);
        });
    }

    retrieve(): MemoryEvent[] {
        return this.memories;
    }
}