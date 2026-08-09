import { AutonomousRepairEngine } from "../RepairEngine/AutonomousRepairEngine";

describe("Autonomous Repair Integration",()=>{

test("creates repair plan during failed verification",()=>{

const engine=new AutonomousRepairEngine();

const plan=engine.createPlan(
"AUTONOMOUS_VERIFY_FAILED",
"Backend/HBOS/test/TestFailure.ts"
);

expect(plan.issue)
.toBe("AUTONOMOUS_VERIFY_FAILED");

expect(plan.action)
.toContain("rerun verification");

});

});
