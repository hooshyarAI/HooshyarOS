import {
    UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION,
} from "./DataAcquisitionCapability";

describe("Unified organizational data acquisition capability", () => {
    it("declares no-repeat data entry as a product principle", () => {
        expect(UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION.noRepeatDataEntry).toBe(true);
    });

    it("covers document, file and system acquisition sources", () => {
        expect(UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION.sources).toEqual(
            expect.arrayContaining([
                "IMAGE",
                "PAPER_SCAN",
                "PDF",
                "WORD",
                "EXCEL",
                "ACCESS",
                "APPLICATION",
                "DATABASE",
                "API",
                "WEB_SERVICE",
            ]),
        );
    });

    it("defines an evidence-first acquisition pipeline", () => {
        expect(UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION.pipeline).toEqual([
            "ACQUIRE",
            "EXTRACT",
            "NORMALIZE",
            "VALIDATE",
            "RECONCILE",
            "EVIDENCE",
        ]);
    });

    it("requires validation, evidence and human review for low-confidence extraction", () => {
        expect(UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION.requiresValidation).toBe(true);
        expect(UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION.requiresEvidenceBeforeUse).toBe(true);
        expect(UNIFIED_ORGANIZATIONAL_DATA_ACQUISITION.humanReviewOnLowConfidence).toBe(true);
    });
});
