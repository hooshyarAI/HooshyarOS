import { randomUUID } from "crypto";

export type ConversationRole =
    | "USER"
    | "ASSISTANT"
    | "SYSTEM";


export class Conversation {

    id: string;

    projectId: string;

    role: ConversationRole;

    message: string;

    createdAt: Date;


    constructor(
        projectId: string,
        role: ConversationRole,
        message: string
    ) {

        this.id = randomUUID();

        this.projectId = projectId;

        this.role = role;

        this.message = message;

        this.createdAt = new Date();

    }


    isUser(): boolean {

        return this.role === "USER";

    }


    isAssistant(): boolean {

        return this.role === "ASSISTANT";

    }


    isSystem(): boolean {

        return this.role === "SYSTEM";

    }

}