export interface NormalizedFinancialRecord { [key: string]: unknown; }

export class FinancialDataIngestionAdapter {
    readonly capabilityId = "product.financial-data-ingestion";
    readonly targetEngine = "Financial Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    ingest(records: Record<string, unknown>[]): NormalizedFinancialRecord[] {
        return records.map((record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key.trim(), value])));
    }
}
