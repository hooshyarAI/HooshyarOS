export class ProjectExecutionMemory {


private history:any[]=[];


record(data:any){

this.history.push(data);

}


recall(){

return this.history;

}

}

