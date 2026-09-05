import { randomUUID } from 'crypto';

export class Knowledge {

    id: string;

    title: string;

    description: string;

    confidence: number | undefined;

    source: string;

    createdAt: Date;

    tenantId: string | undefined;


    constructor(
        title: string,
        description: string,
        confidence: number | undefined,
        source: string,
        tenantId?: string
    ) {

        this.id = randomUUID();

        this.title = title;

        this.description = description;

        this.confidence = confidence;

        this.source = source;

        this.createdAt = new Date();

        this.tenantId = tenantId;

    }

}
