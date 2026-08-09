export class ArchitectureDecisionMemory {

private records:any[]=[];


remember(decision:any){

this.records.push({
timestamp:new Date().toISOString(),
decision
});

return true;

}


retrieve(){

return this.records;

}

}
