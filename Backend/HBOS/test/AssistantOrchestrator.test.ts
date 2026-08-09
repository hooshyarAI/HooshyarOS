import { AssistantOrchestrator } from "../Assistants/AssistantOrchestrator";


test("Assistant Orchestrator routes financial request",()=>{


const assistant=new AssistantOrchestrator();


assistant.initialize();


const result=assistant.execute(
"تحلیل سود مالی شرکت"
);


expect(result.face)
.toBe("FinancialFace");


});


test("Assistant Orchestrator routes tax request",()=>{


const assistant=new AssistantOrchestrator();


assistant.initialize();


const result=assistant.execute(
"بررسی مالیات شرکت"
);


expect(result.face)
.toBe("TaxFace");


});
