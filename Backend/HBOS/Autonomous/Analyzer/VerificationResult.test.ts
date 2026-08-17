import { verificationPassed } from "./VerificationResult";
describe("Verification result", () => { it("requires every required result", () => { expect(verificationPassed([true,true])).toBe(true); expect(verificationPassed([true,false])).toBe(false); }); });
