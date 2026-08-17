import { customerTrialAllowed } from "./CustomerTrialGate";
describe("Customer trial gate", () => { it("does not allow real customer data before core controls are verified", () => { expect(customerTrialAllowed(true,true,true)).toBe(true); expect(customerTrialAllowed(true,true,false)).toBe(false); }); });
