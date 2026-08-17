import { reevaluate } from "./ReevaluationEngine";
describe("Re-evaluation",()=>{ it("detects state changes",()=>expect(reevaluate("BLOCKED","READY")).toEqual({changed:true,state:"READY"})); it("detects unchanged state",()=>expect(reevaluate("BLOCKED","BLOCKED")).toEqual({changed:false,state:"BLOCKED"})); });
