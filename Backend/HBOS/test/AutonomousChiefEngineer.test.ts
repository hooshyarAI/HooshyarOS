import {AutonomousChiefEngineer}
from "../Assistant/Autonomous/AutonomousChiefEngineer";


test("Autonomous Chief Engineer builds mission",()=>{


const ai=new AutonomousChiefEngineer();


const result=ai.run(
"Complete HooshyarOS"
);


expect(result.approval.approved)
.toBe(true);


expect(result.execution.length)
.toBeGreaterThan(0);


});
