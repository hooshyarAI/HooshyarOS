import { buildCustomerValueReport } from "./CustomerValueReport";

describe("Customer value report", () => {
    it("builds a customer-owned report from aggregated evidence", () => {
        expect(buildCustomerValueReport({
            customerId: "customer-a",
            trialDays: 30,
            evidence: {
                minutesSaved: 240,
                manualEntriesAvoided: 90,
                errorsAvoided: 15,
                evidenceScore: 1,
                valueProven: true,
            },
        })).toEqual({
            customerId: "customer-a",
            trialDays: 30,
            minutesSaved: 240,
            manualEntriesAvoided: 90,
            errorsAvoided: 15,
            evidenceScore: 1,
            valueProven: true,
            customerOwnedEvidenceOnly: true,
        });
    });

    it("rejects an invalid trial period", () => {
        expect(buildCustomerValueReport({
            customerId: "customer-a",
            trialDays: 0,
            evidence: {
                minutesSaved: 1,
                manualEntriesAvoided: 1,
                errorsAvoided: 1,
                evidenceScore: 1,
                valueProven: true,
            },
        })).toBeNull();
    });
});
