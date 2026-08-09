import {AutonomousAssistantRuntime}
from "../Assistant/Autonomous/AutonomousAssistantRuntime";


test(
"HooshyarOS autonomous assistant runtime completes",
async()=>{


const assistant=
new AutonomousAssistantRuntime();


const result=
await assistant.execute(
"Complete HooshyarOS"
);


expect(result.reasoning.success)
.toBe(true);


expect(result.ctx.memoryLoaded)
.toBe(true);


});

