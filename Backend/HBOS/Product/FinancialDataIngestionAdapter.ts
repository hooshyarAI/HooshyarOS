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
    duplicateKey: string;
}

export interface AcquisitionPolicy {
    automaticFirst: true;
    noDoubleEntry: true;
    manualEntryExceptional: true;
}

export class FinancialDataIngestionAdapter implements Engine {
    name = "FinancialDataIngestionAdapter";
    readonly acquisitionPolicy: AcquisitionPolicy = {
        automaticFirst: true,
        noDoubleEntry: true,
        manualEntryExceptional: true,
    };

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

    preferredAcquisitionMode(source: AcquisitionSource): "AUTOMATIC" | "MANUAL_CONFIRMATION" {
        return source.automatic ? "AUTOMATIC" : "MANUAL_CONFIRMATION";
    }

    acquire(source: AcquisitionSource, rawReference: string): AcquisitionRecord {
        const normalizedReference = rawReference.trim();
        const requiresManualEntry = !source.automatic;
        const duplicateKey = `${source.kind}:${source.location}:${normalizedReference}`;
        return {
            source,
            receivedAt: new Date().toISOString(),
            rawReference,
            normalizedReference,
            validated: normalizedReference.length > 0,
            provenance: `${source.kind}:${source.location}`,
            requiresManualEntry,
            duplicateKey,
        };
    }

    shouldCreateManualTask(record: AcquisitionRecord, knownDuplicateKeys: ReadonlySet<string>): boolean {
        if (!record.validated) return false;
        if (knownDuplicateKeys.has(record.duplicateKey)) return false;
        return record.requiresManualEntry;
    }
}
