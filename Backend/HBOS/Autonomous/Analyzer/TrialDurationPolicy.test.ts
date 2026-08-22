import { trialDurationAllowed } from "./TrialDurationPolicy";
describe("Trial duration policy", () => { it("allows 30 days and controlled 60/90 day extensions", () => { expect(trialDurationAllowed(30,false)).toBe(true); expect(trialDurationAllowed(60,true)).toBe(true); expect(trialDurationAllowed(90,false)).toBe(false); }); });
