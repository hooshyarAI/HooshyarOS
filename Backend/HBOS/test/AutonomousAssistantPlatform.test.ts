import {AutonomousAssistantPlatform} from "../Assistant/Autonomous/AutonomousAssistantPlatform";


test(
"HooshyarOS Autonomous Assistant Platform boots",
async()=>{


const orchestrator = {
start: jest.fn().mockResolvedValue({status:"RUNNING"})
};
const platform=
new AutonomousAssistantPlatform(orchestrator);


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
expect(orchestrator.start)
.toHaveBeenCalledWith("Complete HooshyarOS mission");


});


