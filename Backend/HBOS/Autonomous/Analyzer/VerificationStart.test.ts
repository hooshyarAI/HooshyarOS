import { canStartVerification } from "./VerificationStart";
describe("Verification start", () => { it("requires an execution and test plan", () => { expect(canStartVerification(true,true)).toBe(true); expect(canStartVerification(true,false)).toBe(false); }); });
