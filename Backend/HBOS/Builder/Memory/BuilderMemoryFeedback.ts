export class BuilderMemoryFeedback {

private history:any[]=[];

store(result:any){

this.history.push(result);

}

getHistory(){

return this.history;

}

}

