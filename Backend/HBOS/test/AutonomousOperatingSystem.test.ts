import {AutonomousOperatingSystem}
from "../Assistant/Autonomous/AutonomousOperatingSystem";


test(
"HBOS Autonomous Operating System completes mission",
()=>{


const os=new AutonomousOperatingSystem();


const result=os.run(
"Complete HooshyarOS platform"
);


expect(result.state)
.toBe("COMPLETED");


expect(result.tasks.length)
.toBeGreaterThan(0);


expect(result.commit.committed)
.toBe(true);


});


