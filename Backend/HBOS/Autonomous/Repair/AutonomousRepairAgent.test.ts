import { AutonomousRepairAgent } from "../Repair/AutonomousRepairAgent";


describe("AutonomousRepairAgent",()=>{

test("analyzes verification failure",()=>{

const agent=new AutonomousRepairAgent();

const result=agent.analyze({
issue:"AUTONOMOUS_VERIFY_FAILED",
output:"jest failure"
});


expect(result.repaired).toBe(true);

});

});
