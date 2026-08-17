export interface ExecutionAuthorization { preconditionsPass:boolean; testsDefined:boolean; rollbackDefined:boolean; productionTarget:boolean; }
export function authorizeExecution(x: ExecutionAuthorization): { authorized:boolean; blockers:string[] } {
 const blockers:string[]=[];
 if(!x.preconditionsPass) blockers.push("PRECONDITIONS_FAILED");
 if(!x.testsDefined) blockers.push("TESTS_NOT_DEFINED");
 if(!x.rollbackDefined) blockers.push("ROLLBACK_NOT_DEFINED");
 if(x.productionTarget) blockers.push("PRODUCTION_EXECUTION_REQUIRES_EXPLICIT_RELEASE_GATE");
 return {authorized:blockers.length===0,blockers};
}
