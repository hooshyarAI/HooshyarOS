export class BuildHistoryMemory {

private history:any[]=[];

record(build:any){

this.history.push(build);

}

getHistory(){

return this.history;

}

}

