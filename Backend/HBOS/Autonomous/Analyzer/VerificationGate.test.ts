import { verificationPassed } from "./VerificationGate";
describe("Verification gate", () => {
    it("requires behavioral, integration and adversarial verification", () => {
        expect(verificationPassed({ behavioral: true, integration: true, adversarial: false })).toBe(false);
        expect(verificationPassed({ behavioral: true, integration: true, adversarial: true })).toBe(true);
    });
});
