import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface TenantScope { readonly tenantId: string; }
export interface PersistenceRecord { readonly tenantId: string; readonly key: string; readonly value: unknown; }
export interface SQLitePersistenceStoreOptions { readonly databasePath: string; }
export class SQLitePersistenceStore {
  private readonly database: DatabaseSync;
  constructor(options: SQLitePersistenceStoreOptions) {
    const databasePath = options.databasePath === ":memory:" ? ":memory:" : resolve(options.databasePath);
    if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`CREATE TABLE IF NOT EXISTS persistence_records (tenant_id TEXT NOT NULL,key TEXT NOT NULL,value_json TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY (tenant_id, key));`);
  }
  async read(scope: TenantScope, key: string): Promise<PersistenceRecord | null> {
    this.assertScope(scope); this.assertKey(key);
    const row = this.database.prepare("SELECT tenant_id, key, value_json FROM persistence_records WHERE tenant_id = ? AND key = ?").get(scope.tenantId, key) as {tenant_id?: string; key?: string; value_json?: string} | undefined;
    if (!row?.tenant_id || !row.key || typeof row.value_json !== "string") return null;
    return { tenantId: row.tenant_id, key: row.key, value: JSON.parse(row.value_json) as unknown };
  }
  async write(scope: TenantScope, key: string, value: unknown): Promise<PersistenceRecord> {
    this.assertScope(scope); this.assertKey(key);
    const record = { tenantId: scope.tenantId, key, value };
    this.database.prepare(`INSERT INTO persistence_records (tenant_id, key, value_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`).run(scope.tenantId, key, JSON.stringify(value), new Date().toISOString());
    return record;
  }
  close(): void { if (this.database.isOpen) this.database.close(); }
  private assertScope(scope: TenantScope): void { if (!scope?.tenantId?.trim()) throw new Error("persistence-tenant-required"); }
  private assertKey(key: string): void { if (!key?.trim()) throw new Error("persistence-key-required"); }
}
