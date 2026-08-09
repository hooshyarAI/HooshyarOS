export class AuditTrailEngine {


private logs:any[]=[];


record(event:any){

this.logs.push({

time:new Date().toISOString(),
event

});

}


get(){

return this.logs;

}


}
