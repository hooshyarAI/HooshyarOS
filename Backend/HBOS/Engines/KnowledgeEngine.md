// KnowledgeEngine - Domain Knowledge Management System
// Supporting Component: Manages organizational knowledge and rules

/**
 * Knowledge Engine
 * 
 * Role:
 * - Store rules in domain knowledge base
 * - Manage standards and regulations
 * - Provide expertise and knowledge access
 * 
 * Functions:
 * - initialize(): Start knowledge engine
 * - health(): Report engine health status
 * - onEvent(event): Learn from memory events
 * - addRule(rule): Add knowledge rules to engine
 * - getRules(): Retrieve all knowledge rules
 * - learn(event): Process events to generate knowledge
 * - getKnowledge(): Access stored knowledge
 * - count(): Get total knowledge items count
 * 
 * Status: Implemented
 * 
 * Note: This engine implements the EventListener interface to receive
 * memory events and learn from them, but does NOT implement the Engine
 * interface. It serves as a supporting component for the Organizational
 * Intelligence Engine's knowledge management capabilities.
 */

export class KnowledgeEngine implements EventListener {
    name: string = "KnowledgeEngine";
    private knowledge: Knowledge[] = [];
    private rules: KnowledgeRule[] = [];

    initialize(): void {
        console.log("Knowledge Engine Started");
    }

    health(): boolean {
        return true;
    }

    onEvent(event: MemoryEvent): void {
        this.learn(event);
    }

    addRule(rule: KnowledgeRule): void {
        this.rules.push(rule);
    }

    getRules(): KnowledgeRule[] {
        return this.rules;
    }

    learn(event: MemoryEvent): Knowledge {
        const knowledge = new Knowledge(
            event.type,
            `${event.source}: ${event.data}`, 
            0.8
        );
        this.knowledge.push(knowledge);
        return knowledge;
    }

    getKnowledge(): Knowledge[] {
        return this.knowledge;
    }

    count(): number {
        return this.knowledge.length;
    }
}