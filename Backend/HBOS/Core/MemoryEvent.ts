export class MemoryEvent {

    id: string;

    type: string;

    data: string;

    source: string;

    createdAt: Date;

    tenantId: string | undefined;


    constructor(
        type: string,
        data: string,
        source: string,
        tenantId?: string
    ) {

        this.id = crypto.randomUUID();

        this.type = type;

        this.data = data;

        this.source = source;

        this.createdAt = new Date();

        this.tenantId = tenantId;

    }

}
