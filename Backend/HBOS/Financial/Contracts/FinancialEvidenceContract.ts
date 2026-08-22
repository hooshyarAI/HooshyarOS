export interface FinancialEvidenceRecord {
    metric: string;
    period: string;
    value: number;
    unit: string;
}

export interface FinancialSource {
    sourceId: string;
    sourceUri: string;
    rawPath: string;
    entity: string;
}

export interface CanonicalFinancialModel {
    sourceId: string;
    entity: string;
    period: string;
    currency: string;
    scale: number;
    revenue: number;
    expenses: number;
    assets: number;
    liabilities: number;
}
