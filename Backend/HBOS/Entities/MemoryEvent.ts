export type MemoryValidity = "ACTIVE" | "SUPERSEDED" | "EXPIRED";

export interface MemoryEventProvenance {
    observedAt?: Date;
    traceId?: string;
    evidenceRef?: string;
    validity?: MemoryValidity;
}

export class MemoryEvent {

    id: string;

    type: string;

    data: string;

    source: string;

    createdAt: Date;

    tenantId: string | undefined;

    /** When the fact was observed at its source (may differ from createdAt). */
    observedAt: Date | undefined;

    /** Provenance trace that produced this memory, when available. */
    traceId: string | undefined;

    /** Reference to the evidence that supports this memory, when available. */
    evidenceRef: string | undefined;

    /** Lifecycle/validity marker supported by the existing architecture. */
    validity: MemoryValidity | undefined;


    constructor(
        type: string,
        data: string,
        source: string,
        tenantId?: string,
        provenance?: MemoryEventProvenance
    ) {

        this.id = crypto.randomUUID();

        this.type = type;

        this.data = data;

        this.source = source;

        this.createdAt = new Date();

        this.tenantId = tenantId;

        this.observedAt = provenance?.observedAt;

        this.traceId = provenance?.traceId;

        this.evidenceRef = provenance?.evidenceRef;

        this.validity = provenance?.validity;

    }

}
