export type DataAcquisitionSource =
    | "IMAGE"
    | "PAPER_SCAN"
    | "PDF"
    | "WORD"
    | "EXCEL"
    | "ACCESS"
    | "VIDEO"
    | "APPLICATION"
    | "DATABASE"
    | "API"
    | "WEB_SERVICE";

export interface DataAcquisitionCapability {
    id: "UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION";
    noRepeatDataEntry: true;
    sources: readonly DataAcquisitionSource[];
    requiresValidation: true;
    requiresEvidenceBeforeUse: true;
    humanReviewOnLowConfidence: true;
}

export const UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION: DataAcquisitionCapability = {
    id: "UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION",
    noRepeatDataEntry: true,
    sources: [
        "IMAGE",
        "PAPER_SCAN",
        "PDF",
        "WORD",
        "EXCEL",
        "ACCESS",
        "VIDEO",
        "APPLICATION",
        "DATABASE",
        "API",
        "WEB_SERVICE",
    ],
    requiresValidation: true,
    requiresEvidenceBeforeUse: true,
    humanReviewOnLowConfidence: true,
};
