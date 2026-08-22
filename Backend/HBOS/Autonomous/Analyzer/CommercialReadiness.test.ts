import { commercialReady } from "./CommercialReadiness";
describe("Commercial readiness", () => { it("requires security, isolation, recovery and complete evidence", () => { expect(commercialReady(true,true,true,true)).toBe(true); expect(commercialReady(true,true,true,false)).toBe(false); }); });
