import { Knowledge } from "../Entities/Knowledge";
import { KnowledgeRule } from "../Entities/KnowledgeRule";
import { MemoryEvent } from "../Entities/MemoryEvent";

export class KnowledgeEngine {

    private knowledge: Knowledge[] = [];

    private rules: KnowledgeRule[] = [];


    initialize(): void {

        console.log(
            "Knowledge Engine Started"
        );

    }


    addRule(
        rule: KnowledgeRule
    ): void {

        this.rules.push(rule);

    }


    getRules(): KnowledgeRule[] {

        return this.rules;

    }


    learn(
        event: MemoryEvent
    ): Knowledge {

        const knowledge =
            new Knowledge(

                event.type,

                `${event.source}: ${event.data}`,

                0.8

            );

        this.knowledge.push(
            knowledge
        );

        return knowledge;

    }


    getKnowledge(): Knowledge[] {

        return this.knowledge;

    }


    count(): number {

        return this.knowledge.length;

    }

}