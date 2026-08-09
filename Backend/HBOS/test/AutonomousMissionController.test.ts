import { AutonomousMissionController }
from "../Assistant/Autonomous/AutonomousMissionController";


test("Autonomous mission executes end to end",()=>{


const controller=new AutonomousMissionController();


const result=
controller.executeMission(
"Complete HooshyarOS platform"
);



expect(result.status)
.toBe("COMPLETED");



expect(result.execution.length)
.toBeGreaterThan(0);



});

