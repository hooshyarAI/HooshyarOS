import { MemoryEvent } from './MemoryEvent';
import { EventListener } from '../Interfaces/EventListener';

/**
 * Minimal structural contract for a reaction sink. It is intentionally
 * structural so that any reaction engine implementation (Core or Engines) can
 * be subscribed without the memory owner depending on a duplicate engine copy.
 */
export interface MemoryReactionSink {
    react(event: MemoryEvent): unknown;
}

/**
 * Reserved scope for platform/system memory that is not owned by any tenant.
 * System records are never returned to a tenant-scoped retrieval; they are only
 * reachable by explicitly asking for this scope.
 */
export const MEMORY_SYSTEM_SCOPE = "__system__";

/**
 * Reserved scope for engine-local working memory that is not tenant data (for
 * example organizational process events owned by a single engine instance).
 * It is isolated per engine instance and is never used for tenant-facing
 * cognitive memory.
 */
export const MEMORY_INTERNAL_SCOPE = "__internal__";

/** Thrown when a memory record has no resolvable owner. Fails closed. */
export class MemoryOwnershipRequiredError extends Error {
    constructor() {
        super('memory-ownership-required: an explicit tenantId is required to store a memory event');
        this.name = 'MemoryOwnershipRequiredError';
    }
}

/** Thrown when retrieval is attempted without a tenant context. Fails closed. */
export class MemoryTenantRequiredError extends Error {
    constructor() {
        super('memory-tenant-required: an explicit tenantId is required to retrieve memory');
        this.name = 'MemoryTenantRequiredError';
    }
}

/** Thrown when an explicit tenant conflicts with the event's own tenant. */
export class MemoryTenantConflictError extends Error {
    constructor(explicitTenantId: string, ownedTenantId: string) {
        super(`memory-tenant-conflict: explicit tenant "${explicitTenantId}" does not match event tenant "${ownedTenantId}"`);
        this.name = 'MemoryTenantConflictError';
    }
}

const normalizeScope = (value?: string): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Canonical tenant-safe cognitive memory.
 *
 * Ownership contract (B-04):
 *   - every stored record MUST carry an explicit owner (the event's own
 *     `tenantId` or a trusted `tenantId` supplied by the canonical caller);
 *   - a store without ownership fails closed;
 *   - an explicit tenant that contradicts the event's own tenant fails closed;
 *   - retrieval REQUIRES an explicit tenant scope and never returns records
 *     owned by another tenant, and never returns global records for an omitted
 *     tenant (retrieval without a tenant fails closed).
 *
 * The engine stays the single memory owner: no parallel store, no scoped
 * wrapper, no duplicate retrieval path.
 */
export class MemoryEngine {

    name: string = 'MemoryEngine';

    private memories: MemoryEvent[] = [];

    private reactionEngine?: MemoryReactionSink;

    private listeners: EventListener[] = [];

    initialize(): void {
        console.log('Memory Engine Started');
    }

    health(): boolean {
        return true;
    }

    subscribe(reactionEngine: MemoryReactionSink): void {
        this.reactionEngine = reactionEngine;
    }

    addListener(listener: EventListener): void {
        this.listeners.push(listener);
    }

    /**
     * Store a cognitive memory record.
     *
     * The owner is the explicit `tenantId` (a trust decision made by the
     * canonical caller) or the event's own `tenantId`. If neither is present the
     * store fails closed; if both are present and disagree it fails closed.
     */
    store(event: MemoryEvent, tenantId?: string): void {

        const explicit = normalizeScope(tenantId);

        const owned = normalizeScope(event?.tenantId);

        if (!explicit && !owned) {
            throw new MemoryOwnershipRequiredError();
        }

        if (explicit && owned && explicit !== owned) {
            throw new MemoryTenantConflictError(explicit, owned);
        }

        // Explicit trusted ownership wins; the event carries the canonical owner.
        event.tenantId = explicit ?? owned;

        this.memories.push(event);

        if (this.reactionEngine) {
            this.reactionEngine.react(event);
        }

        for (const listener of this.listeners) {
            listener.onEvent(event);
        }

    }

    /**
     * Retrieve the memory records owned by `tenantId`.
     *
     * A tenant is REQUIRED. Omitting it (or passing an empty/whitespace scope)
     * fails closed instead of returning every tenant's records.
     */
    retrieve(tenantId?: string): MemoryEvent[] {

        const scope = normalizeScope(tenantId);

        if (!scope) {
            throw new MemoryTenantRequiredError();
        }

        return this.memories.filter(event => normalizeScope(event.tenantId) === scope);

    }

    /** Count of records owned by the given tenant. */
    count(tenantId: string): number {
        return this.retrieve(tenantId).length;
    }

}
