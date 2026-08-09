import {AutonomousRepairEngine} 
from "../RepairEngine/AutonomousRepairEngine";


describe("AutonomousRepairEngine",()=>{

test("creates repair plan from failure",()=>{

const engine=new AutonomousRepairEngine();

const plan=
engine.createPlan(
"AUTONOMOUS_VERIFY_FAILED",
"Backend/HBOS/TestFailure.ts"
);


expect(plan.action).toContain("rerun verification");

});

});
