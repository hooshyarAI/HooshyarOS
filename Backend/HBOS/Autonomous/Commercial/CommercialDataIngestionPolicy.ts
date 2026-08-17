export type SourceKind =
    | "IMAGE"
    | "VIDEO"
    | "PAPER"
    | "PDF"
    | "WORD"
    | "EXCEL"
    | "ACCESS"
    | "ACCOUNTING_SOFTWARE"
    | "ERP"
    | "API"
    | "DATABASE";

export interface SourceDefinition {
    kind: SourceKind;
    path?: string;
    connector?: string;
}

export interface IngestionDecision {
    source: SourceKind;
    automatedIngestion: boolean;
    manualDataEntryRequired: boolean;
    requiresHumanReview: boolean;
}

/**
 * HooshyarOS should acquire information from existing organizational sources
 * and avoid asking employees to re-enter data already present in those sources.
 * Human review remains mandatory when extraction confidence or business
 * semantics cannot be established safely.
 */
export class CommercialDataIngestionPolicy {
    evaluate(source: SourceDefinition): IngestionDecision {
        const connectorSources: SourceKind[] = [
            "ACCOUNTING_SOFTWARE",
            "ERP",
            "API",
            "DATABASE",
            "ACCESS",
        ];

        const automatedIngestion = true;
        const manualDataEntryRequired = false;
        const requiresHumanReview =
            source.kind === "IMAGE" ||
            source.kind === "VIDEO" ||
            source.kind === "PAPER" ||
            source.kind === "PDF" ||
            source.kind === "WORD" ||
            source.kind === "EXCEL" ||
            connectorSources.includes(source.kind) === false;

        return {
            source: source.kind,
            automatedIngestion,
            manualDataEntryRequired,
            requiresHumanReview,
        };
    }
}
