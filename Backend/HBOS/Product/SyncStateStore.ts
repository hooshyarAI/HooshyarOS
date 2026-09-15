/**
 * Stage 08-GOV.3 — Tenant-Scoped Sync State.
 *
 * Pure supporting service. Tracks per-(tenant, source) sync cursors
 * backed by the canonical SQLitePersistenceStore so the state is
 * durable. Cross-tenant access is structurally impossible because
 * every read/write is scoped through TenantScope.
 *
 * Cursor: { lastWatermark, lastSuccessAt, lastErrorAt?, lastError? }
 * This module is NOT a new Engine.
 */

import type { SQLitePersistenceStore } from "./SQLitePersistenceStore";

export const SYNC_STATE_ERROR_CODES = {
  TENANT_REQUIRED: "ingestion-sync-tenant-required",
  SOURCE_REQUIRED: "ingestion-sync-source-required",
  STORE_REQUIRED: "ingestion-sync-store-required",
} as const;

export interface SyncCursor {
  readonly lastWatermark: string;
  readonly lastSuccessAt: string;
  readonly lastErrorAt?: string;
  readonly lastError?: string;
}

/** A cursor together with the source key it belongs to. */
export interface SyncStateEntry {
  readonly sourceKey: string;
  readonly cursor: SyncCursor;
}

const KEY_PREFIX = "sync-state:";

function buildKey(tenantId: string, sourceKey: string): string {
  return `${KEY_PREFIX}${tenantId}::${sourceKey}`;
}

function toCursor(value: unknown): SyncCursor | null {
  const v = value as Partial<SyncCursor> | null;
  if (!v || typeof v.lastWatermark !== "string" || typeof v.lastSuccessAt !== "string") {
    return null;
  }
  return {
    lastWatermark: v.lastWatermark,
    lastSuccessAt: v.lastSuccessAt,
    ...(typeof v.lastErrorAt === "string" ? { lastErrorAt: v.lastErrorAt } : {}),
    ...(typeof v.lastError === "string" ? { lastError: v.lastError } : {}),
  };
}

export class SyncStateStore {
  private readonly store: SQLitePersistenceStore;
  constructor(store: SQLitePersistenceStore) {
    if (!store) throw new Error(SYNC_STATE_ERROR_CODES.STORE_REQUIRED);
    this.store = store;
  }

  async get(tenantId: string, sourceKey: string): Promise<SyncCursor | null> {
    if (!tenantId?.trim()) throw new Error(SYNC_STATE_ERROR_CODES.TENANT_REQUIRED);
    if (!sourceKey?.trim()) throw new Error(SYNC_STATE_ERROR_CODES.SOURCE_REQUIRED);
    const rec = await this.store.read({ tenantId }, buildKey(tenantId, sourceKey));
    if (!rec) return null;
    return toCursor(rec.value);
  }

  /**
   * Enumerate every sync cursor owned by `tenantId`, ordered by source key.
   *
   * The tenant filter is applied in SQL and every returned key is re-checked
   * against the tenant prefix, so cross-tenant cursors can never appear.
   */
  async list(tenantId: string): Promise<SyncStateEntry[]> {
    if (!tenantId?.trim()) throw new Error(SYNC_STATE_ERROR_CODES.TENANT_REQUIRED);
    const prefix = `${KEY_PREFIX}${tenantId}::`;
    const rows = this.store.database
      .prepare("SELECT key, value_json FROM persistence_records WHERE tenant_id = ? AND key LIKE ? ORDER BY key ASC")
      .all(tenantId, `${prefix}%`) as Array<{ key: string; value_json: string }>;

    const entries: SyncStateEntry[] = [];
    for (const row of rows) {
      if (typeof row.key !== "string" || !row.key.startsWith(prefix)) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(row.value_json) as unknown;
      } catch {
        continue;
      }
      const cursor = toCursor(parsed);
      if (!cursor) continue;
      entries.push({ sourceKey: row.key.slice(prefix.length), cursor });
    }
    return entries;
  }

  async recordSuccess(tenantId: string, sourceKey: string, watermark: string): Promise<SyncCursor> {
    if (!tenantId?.trim()) throw new Error(SYNC_STATE_ERROR_CODES.TENANT_REQUIRED);
    if (!sourceKey?.trim()) throw new Error(SYNC_STATE_ERROR_CODES.SOURCE_REQUIRED);
    const cur: SyncCursor = {
      lastWatermark: watermark,
      lastSuccessAt: new Date().toISOString(),
    };
    await this.store.write({ tenantId }, buildKey(tenantId, sourceKey), cur);
    return cur;
  }

  async recordError(tenantId: string, sourceKey: string, errorMessage: string): Promise<SyncCursor> {
    if (!tenantId?.trim()) throw new Error(SYNC_STATE_ERROR_CODES.TENANT_REQUIRED);
    if (!sourceKey?.trim()) throw new Error(SYNC_STATE_ERROR_CODES.SOURCE_REQUIRED);
    const prev = await this.get(tenantId, sourceKey);
    const cur: SyncCursor = {
      lastWatermark: prev?.lastWatermark ?? "",
      lastSuccessAt: prev?.lastSuccessAt ?? new Date(0).toISOString(),
      lastErrorAt: new Date().toISOString(),
      lastError: errorMessage,
    };
    await this.store.write({ tenantId }, buildKey(tenantId, sourceKey), cur);
    return cur;
  }
}