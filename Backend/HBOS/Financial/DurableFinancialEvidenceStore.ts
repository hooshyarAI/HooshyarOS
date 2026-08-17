import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { CanonicalFinancialRecord } from "./CsvFinancialIngestion";

export interface FinancialEvidence {
    id: string;
    tenantId: string;
    sourceId: string;
    rowNumber: number;
    payload: CanonicalFinancialRecord;
    payloadHash: string;
    createdAt: string;
}

export class DurableFinancialEvidenceStore {
    private readonly db: DatabaseSync;

    constructor(databasePath: string) {
        this.db = new DatabaseSync(databasePath);
        this.db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = FULL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
            CREATE TABLE IF NOT EXISTS financial_evidence (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                source_id TEXT NOT NULL,
                row_number INTEGER NOT NULL,
                payload_json TEXT NOT NULL,
                payload_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(tenant_id, source_id, row_number)
            );
            CREATE INDEX IF NOT EXISTS idx_financial_evidence_tenant ON financial_evidence(tenant_id, id);
        `);
    }

    save(record: CanonicalFinancialRecord): FinancialEvidence {
        if (!record.tenantId || !record.sourceId) throw new Error("Tenant and source are required");
        const payloadJson = JSON.stringify(record);
        const payloadHash = createHash("sha256").update(payloadJson).digest("hex");
        const id = createHash("sha256").update(`${record.tenantId}:${record.sourceId}:${record.rowNumber}`).digest("hex");
        const createdAt = new Date().toISOString();
        this.db.prepare(`
            INSERT OR IGNORE INTO financial_evidence
            (id, tenant_id, source_id, row_number, payload_json, payload_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, record.tenantId, record.sourceId, record.rowNumber, payloadJson, payloadHash, createdAt);
        return this.get(record.tenantId, id)!;
    }

    get(tenantId: string, id: string): FinancialEvidence | null {
        if (!tenantId || !id) return null;
        const row = this.db.prepare(`
            SELECT id, tenant_id, source_id, row_number, payload_json, payload_hash, created_at
            FROM financial_evidence
            WHERE tenant_id = ? AND id = ?
        `).get(tenantId, id) as {
            id: string; tenant_id: string; source_id: string; row_number: number;
            payload_json: string; payload_hash: string; created_at: string;
        } | undefined;
        if (!row) return null;
        return {
            id: row.id,
            tenantId: row.tenant_id,
            sourceId: row.source_id,
            rowNumber: row.row_number,
            payload: JSON.parse(row.payload_json) as CanonicalFinancialRecord,
            payloadHash: row.payload_hash,
            createdAt: row.created_at
        };
    }

    listByTenant(tenantId: string): FinancialEvidence[] {
        if (!tenantId) return [];
        const rows = this.db.prepare(`
            SELECT id, tenant_id, source_id, row_number, payload_json, payload_hash, created_at
            FROM financial_evidence WHERE tenant_id = ? ORDER BY id
        `).all(tenantId) as Array<{
            id: string; tenant_id: string; source_id: string; row_number: number;
            payload_json: string; payload_hash: string; created_at: string;
        }>;
        return rows.map((row) => ({
            id: row.id, tenantId: row.tenant_id, sourceId: row.source_id, rowNumber: row.row_number,
            payload: JSON.parse(row.payload_json) as CanonicalFinancialRecord,
            payloadHash: row.payload_hash, createdAt: row.created_at
        }));
    }

    close(): void { this.db.close(); }
}
