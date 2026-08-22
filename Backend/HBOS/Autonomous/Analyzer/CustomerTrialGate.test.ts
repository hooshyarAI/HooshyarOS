import { trialAllowed } from "./CustomerTrialGate";
describe("Customer trial gate", () => {
    it("requires commercial readiness, bounded scope, SLA and data boundary", () => {
        expect(trialAllowed({ commercialReady: true, scopeDefined: true, slaDefined: true, dataBoundaryVerified: true })).toBe(true);
        expect(trialAllowed({ commercialReady: true, scopeDefined: true, slaDefined: false, dataBoundaryVerified: true })).toBe(false);
    });
});
