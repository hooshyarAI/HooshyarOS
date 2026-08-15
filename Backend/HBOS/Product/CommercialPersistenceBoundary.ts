export interface TenantScope {
  readonly tenantId: string;
}

export interface PersistenceRecord {
  readonly tenantId: string;
  readonly key: string;
  readonly value: unknown;
}

export interface PersistenceStore {
  read(scope: TenantScope, key: string): Promise<PersistenceRecord | null>;
  write(scope: TenantScope, key: string, value: unknown): Promise<PersistenceRecord>;
}

/**
 * Mandatory tenant-scoped persistence boundary.
 * Implementations must never read or write outside the supplied tenant scope.
 */
export class CommercialPersistenceBoundary {
  constructor(private readonly store: PersistenceStore) {}

  async read(scope: TenantScope, key: string): Promise<PersistenceRecord | null> {
    this.assertScope(scope);
    return this.store.read(scope, key);
  }

  async write(scope: TenantScope, key: string, value: unknown): Promise<PersistenceRecord> {
    this.assertScope(scope);
    return this.store.write(scope, key, value);
  }

  private assertScope(scope: TenantScope): void {
    if (!scope.tenantId || scope.tenantId.trim().length === 0) {
      throw new Error("persistence-tenant-scope-required");
    }
  }
}
