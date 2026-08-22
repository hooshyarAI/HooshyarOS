import { CommercialTrialPolicy } from "./CommercialTrialPolicy";

describe("CommercialTrialPolicy", () => {
    const policy = new CommercialTrialPolicy();

    it("starts at 30 days and only extends with a valid reason and customer cooperation", () => {
        expect(policy.evaluate()).toEqual({
            durationDays: 30,
            free: true,
            extensionAllowed: false,
            reason: null,
        });

        expect(policy.evaluate({
            initialDays: 30,
            extensionReason: "INTEGRATION_COMPLEXITY",
            customerCooperation: true,
        })).toEqual({
            durationDays: 60,
            free: true,
            extensionAllowed: true,
            reason: "INTEGRATION_COMPLEXITY",
        });

        expect(policy.evaluate({
            initialDays: 60,
            extensionReason: "VALUE_VALIDATION_INCOMPLETE",
            customerCooperation: true,
        }).durationDays).toBe(90);
    });
});
