import {AutonomousAssistantPlatform}
from "../Assistant/Autonomous/AutonomousAssistantPlatform";


test(
"HooshyarOS Autonomous Assistant Platform boots",
async()=>{


const platform=
new AutonomousAssistantPlatform();


const result=
await platform.boot(
"Complete HooshyarOS mission"
);


expect(result.state)
.toBe("READY");


expect(result.health.status)
.toBe("HEALTHY");


expect(result.result.status)
.toBe("RUNNING");


});


