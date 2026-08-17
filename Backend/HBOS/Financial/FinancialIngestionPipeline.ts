import { CsvFinancialIngestion, CanonicalFinancialRecord } from "./CsvFinancialIngestion";
import { DurableFinancialEvidenceStore, FinancialEvidence } from "./DurableFinancialEvidenceStore";

export interface FinancialIngestionResult {
    records: CanonicalFinancialRecord[];
    evidence: FinancialEvidence[];
}

export class FinancialIngestionPipeline {
    constructor(
        private readonly ingestion: CsvFinancialIngestion,
        private readonly evidenceStore: DurableFinancialEvidenceStore
    ) {}

    ingest(csv: string, tenantId: string, sourceId: string): FinancialIngestionResult {
        const records = this.ingestion.ingest(csv, tenantId, sourceId);
        const evidence = this.evidenceStore.saveMany(records);
        return { records, evidence };
    }
}
