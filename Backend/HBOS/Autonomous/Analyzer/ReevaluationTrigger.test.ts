import { shouldReevaluate } from "./ReevaluationTrigger";
describe("Re-evaluation trigger", () => { it("rechecks changed capability state", () => { expect(shouldReevaluate("BLOCKED","READY")).toBe(true); expect(shouldReevaluate("READY","READY")).toBe(false); }); });
