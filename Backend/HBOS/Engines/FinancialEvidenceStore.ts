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
            PRAGMA synchronous = FULL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
            CREATE TABLE IF NOT EXISTS financial_evidence (
                source_id TEXT PRIMARY KEY,
                source_uri TEXT NOT NULL,
                evidence_hash TEXT NOT NULL UNIQUE,
                records_json TEXT NOT NULL,
                model_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        `);
        this.database.exec("PRAGMA user_version = 1;");
    }

    save(payload: PersistedFinancialEvidence): void {
        if (!/^[a-f0-9]{64}$/.test(payload.evidenceHash)) {
            throw new Error("Financial evidence hash must be a SHA-256 hex digest");
        }

        const existing = this.database
            .prepare("SELECT evidence_hash FROM financial_evidence WHERE source_id = ?")
            .get(payload.source.sourceId) as { evidence_hash: string } | undefined;

        if (existing) {
            if (existing.evidence_hash !== payload.evidenceHash) {
                throw new Error(`Financial evidence conflict for source: ${payload.source.sourceId}`);
            }
            return;
        }

        const statement = this.database.prepare(`
            INSERT INTO financial_evidence
                (source_id, source_uri, evidence_hash, records_json, model_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        statement.run(
            payload.source.sourceId,
            payload.source.sourceUri,
            payload.evidenceHash,
            JSON.stringify(payload.records),
            JSON.stringify(payload.model),
            new Date().toISOString()
        );
    }

    get(sourceId: string): PersistedFinancialEvidence | null {
        const row = this.database
            .prepare("SELECT source_uri, evidence_hash, records_json, model_json FROM financial_evidence WHERE source_id = ?")
            .get(sourceId) as { source_uri: string; evidence_hash: string; records_json: string; model_json: string } | undefined;

        if (!row) return null;
        return {
            source: { sourceId, sourceUri: row.source_uri, rawPath: "" },
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
