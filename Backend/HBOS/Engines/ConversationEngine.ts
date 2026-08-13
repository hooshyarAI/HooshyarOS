import { Conversation } from "../Core/Conversation";

export class ConversationEngine {
    private conversations: Conversation[] = [];

    initialize(): void {
        console.log("Conversation Engine Started");
    }

    add(conversation: Conversation): void {
        this.conversations.push(conversation);
    }

    getAll(): Conversation[] {
        return this.conversations;
    }

    getProjectConversations(projectId: string): Conversation[] {
        return this.conversations.filter(conversation => conversation.projectId === projectId);
    }

    getLastConversation(): Conversation | undefined {
        return this.conversations.at(-1);
    }

    clear(): void {
        this.conversations = [];
    }

    count(): number {
        return this.conversations.length;
    }
}
