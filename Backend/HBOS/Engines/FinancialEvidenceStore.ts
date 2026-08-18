import { DatabaseSync } from "node:sqlite";
import type { CanonicalFinancialModel, FinancialEvidenceRecord, FinancialSource } from "./FinancialDataIngestionEngine";

export interface PersistedFinancialEvidence {
    source: FinancialSource;
    evidenceHash: string;
    records: FinancialEvidenceRecord[];
    model: CanonicalFinancialModel;
}

export class FinancialEvidenceStore {
    private readonly database: DatabaseSync;

    constructor(databasePath: string) {
        this.database = new DatabaseSync(databasePath);
        this.database.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS financial_evidence (
                source_id TEXT PRIMARY KEY,
                source_uri TEXT NOT NULL,
                source_entity TEXT NOT NULL DEFAULT '',
                evidence_hash TEXT NOT NULL UNIQUE,
                records_json TEXT NOT NULL,
                model_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        `);

        const columns = this.database.prepare("PRAGMA table_info(financial_evidence)").all() as Array<{ name: string }>;
        if (!columns.some((column) => column.name === "source_entity")) {
            this.database.exec("ALTER TABLE financial_evidence ADD COLUMN source_entity TEXT NOT NULL DEFAULT ''");
        }
    }

    save(payload: PersistedFinancialEvidence): void {
        const statement = this.database.prepare(`
            INSERT INTO financial_evidence
                (source_id, source_uri, source_entity, evidence_hash, records_json, model_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(source_id) DO UPDATE SET
                source_uri = excluded.source_uri,
                source_entity = excluded.source_entity,
                evidence_hash = excluded.evidence_hash,
                records_json = excluded.records_json,
                model_json = excluded.model_json
        `);

        statement.run(
            payload.source.sourceId,
            payload.source.sourceUri,
            payload.source.entity,
            payload.evidenceHash,
            JSON.stringify(payload.records),
            JSON.stringify(payload.model),
            new Date().toISOString()
        );
    }

    get(sourceId: string): PersistedFinancialEvidence | null {
        const row = this.database
            .prepare("SELECT source_uri, source_entity, evidence_hash, records_json, model_json FROM financial_evidence WHERE source_id = ?")
            .get(sourceId) as { source_uri: string; source_entity: string; evidence_hash: string; records_json: string; model_json: string } | undefined;

        if (!row) return null;
        return {
            source: { sourceId, sourceUri: row.source_uri, rawPath: "", entity: row.source_entity },
            evidenceHash: row.evidence_hash,
            records: JSON.parse(row.records_json),
            model: JSON.parse(row.model_json)
        };
    }

    count(): number {
        const row = this.database.prepare("SELECT COUNT(*) AS count FROM financial_evidence").get() as { count: number };
        return Number(row.count);
    }

    close(): void {
        this.database.close();
    }
}
