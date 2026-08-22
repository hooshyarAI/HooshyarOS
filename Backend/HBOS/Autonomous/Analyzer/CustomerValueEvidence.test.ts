import { measureCustomerValue } from "./CustomerValueEvidence";

describe("Customer value evidence", () => {
    it("measures time, manual-entry and error reduction", () => {
        expect(measureCustomerValue({
            baselineMinutes: 600,
            currentMinutes: 360,
            baselineManualEntries: 120,
            currentManualEntries: 30,
            baselineErrors: 20,
            currentErrors: 5,
        })).toEqual({
            minutesSaved: 240,
            manualEntriesAvoided: 90,
            errorsAvoided: 15,
            valueProven: true,
        });
    });

    it("does not create negative savings from noisy measurements", () => {
        expect(measureCustomerValue({
            baselineMinutes: 100,
            currentMinutes: 120,
            baselineManualEntries: 10,
            currentManualEntries: 12,
            baselineErrors: 5,
            currentErrors: 7,
        })).toEqual({
            minutesSaved: 0,
            manualEntriesAvoided: 0,
            errorsAvoided: 0,
            valueProven: false,
        });
    });
});
