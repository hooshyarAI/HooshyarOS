import { Engine } from "../Core/Engine";

export type DataSourceKind =
    | "erp-accounting"
    | "crm"
    | "hr-payroll"
    | "pos"
    | "bank-export"
    | "sql-database"
    | "api"
    | "excel-csv"
    | "pdf"
    | "word-document"
    | "image-scan-ocr"
    | "historical-file"
    | "report"
    | "budget"
    | "auditor-document";

export interface AcquisitionSource {
    kind: DataSourceKind;
    location: string;
    automatic: boolean;
}

export interface AcquisitionRecord {
    source: AcquisitionSource;
    receivedAt: string;
    rawReference: string;
    normalizedReference: string;
    validated: boolean;
    provenance: string;
    requiresManualEntry: boolean;
}

export class FinancialDataIngestionAdapter implements Engine {
    name = "FinancialDataIngestionAdapter";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return {
            id: "repair-product.financial-data-ingestion",
            capability: "repair and re-verify knot product.financial-data-ingestion from checkpoint cefa479",
            targetEngine: "Financial Intelligence Engine"
        };
    }

    supportedSourceKinds(): DataSourceKind[] {
        return [
            "erp-accounting",
            "crm",
            "hr-payroll",
            "pos",
            "bank-export",
            "sql-database",
            "api",
            "excel-csv",
            "pdf",
            "word-document",
            "image-scan-ocr",
            "historical-file",
            "report",
            "budget",
            "auditor-document",
        ];
    }

    acquire(source: AcquisitionSource, rawReference: string): AcquisitionRecord {
        const requiresManualEntry = !source.automatic;
        return {
            source,
            receivedAt: new Date().toISOString(),
            rawReference,
            normalizedReference: rawReference.trim(),
            validated: rawReference.trim().length > 0,
            provenance: `${source.kind}:${source.location}`,
            requiresManualEntry,
        };
    }
}
