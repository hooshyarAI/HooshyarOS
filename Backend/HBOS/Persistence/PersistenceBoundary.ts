export interface PersistenceRecord {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    tenantId?: string;
    createdAt: string;
}

/**
 * Canonical persistence boundary for HBOS.
 *
 * This interface deliberately does not select a database/provider. Concrete
 * adapters must live behind this boundary and preserve tenant scope and
 * evidence metadata. Production database activation remains an external
 * deployment concern until backed by environment evidence.
 */
export interface PersistenceBoundary {
    save(record: PersistenceRecord): Promise<void>;
    get(id: string): Promise<PersistenceRecord | null>;
    delete(id: string): Promise<void>;
}
