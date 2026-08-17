import { executionIsComplete } from "./CycleCompletion";
describe("Cycle completion", () => { it("requires verification and re-evaluation", () => { expect(executionIsComplete(true,true,true)).toBe(true); expect(executionIsComplete(true,true,false)).toBe(false); }); });
