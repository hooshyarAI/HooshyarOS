import { aggregateCustomerValueEvidence } from "./CustomerValueEvidenceAggregation";

describe("Customer value evidence aggregation", () => {
    it("aggregates positive customer-owned signals into an evidence score", () => {
        expect(aggregateCustomerValueEvidence({
            minutesSaved: 240,
            manualEntriesAvoided: 90,
            errorsAvoided: 15,
            valueProven: true,
        })).toEqual({
            minutesSaved: 240,
            manualEntriesAvoided: 90,
            errorsAvoided: 15,
            evidenceScore: 1,
            valueProven: true,
        });
    });

    it("does not claim value when no positive signal exists", () => {
        expect(aggregateCustomerValueEvidence({
            minutesSaved: 0,
            manualEntriesAvoided: 0,
            errorsAvoided: 0,
            valueProven: false,
        })).toEqual({
            minutesSaved: 0,
            manualEntriesAvoided: 0,
            errorsAvoided: 0,
            evidenceScore: 0,
            valueProven: false,
        });
    });
});
