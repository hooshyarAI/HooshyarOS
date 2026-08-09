import { AutonomousPlatform } from "../Autonomous/Platform/AutonomousPlatform";

test("Autonomous Platform boot",()=>{

 const p=new AutonomousPlatform();

 const r=p.execute(
   "repair and verify working tree"
 );

 expect(r.status).toBe("READY");
 expect(r.pipeline.length).toBe(5);

});

