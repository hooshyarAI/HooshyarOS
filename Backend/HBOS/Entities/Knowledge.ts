import { randomUUID } from "crypto";

export class Knowledge {

    id: string;

    title: string;

    description: string;

    confidence: number;

    createdAt: Date;


    constructor(
        title: string,
        description: string,
        confidence: number
    ) {

        this.id = randomUUID();

        this.title = title;

        this.description = description;

        this.confidence = confidence;

        this.createdAt = new Date();

    }

}