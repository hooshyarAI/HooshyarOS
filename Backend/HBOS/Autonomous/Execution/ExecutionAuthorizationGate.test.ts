import { authorizeExecution } from "./ExecutionAuthorizationGate";
describe("Execution authorization",()=>{
 it("requires rollback and tests",()=>expect(authorizeExecution({preconditionsPass:true,testsDefined:false,rollbackDefined:false,productionTarget:false}).authorized).toBe(false));
 it("blocks direct production execution",()=>expect(authorizeExecution({preconditionsPass:true,testsDefined:true,rollbackDefined:true,productionTarget:true}).blockers).toContain("PRODUCTION_EXECUTION_REQUIRES_EXPLICIT_RELEASE_GATE"));
});
