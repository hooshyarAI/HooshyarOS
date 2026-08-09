import { AutonomousAssistant } from "../Assistant/Core/AutonomousAssistant";


test("Autonomous Assistant core works",()=>{


 const assistant=new AutonomousAssistant();


 assistant.initialize();


 const result=assistant.analyze(
 "Complete HooshyarOS platform"
 );


 expect(result.status)
 .toBe("ANALYZED");


});


