import {AssistantBrainOrchestrator}
from "../Assistant/Autonomous/Production/AssistantBrainOrchestrator";


test(
"HooshyarOS production evolution brain works",
async()=>{


const brain=
new AssistantBrainOrchestrator();


const result=
await brain.execute(
"Autonomous HooshyarOS evolution"
);


expect(result.context.contextFound)
.toBe(true);


expect(result.provider.provider)
.toBe("cloud-model");


expect(result.build.generated)
.toBe(true);


});

