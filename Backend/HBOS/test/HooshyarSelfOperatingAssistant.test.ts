import {HooshyarSelfOperatingAssistant}
from "../Assistant/Autonomous/HooshyarSelfOperatingAssistant";


test(
"HooshyarOS self operating assistant completes mission",
async()=>{


const assistant=
new HooshyarSelfOperatingAssistant();


const result=
await assistant.runMission(
"Continue autonomous HooshyarOS development"
);


expect(result.status)
.toBe("COMPLETED");


expect(result.decision.confidence)
.toBe(100);


expect(result.health.healthy)
.toBe(true);


});


