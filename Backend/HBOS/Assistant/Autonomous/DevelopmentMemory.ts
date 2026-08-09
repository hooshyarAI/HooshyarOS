export class DevelopmentMemory {

private history:any[]=[];

record(event:any){

 this.history.push({
  time:new Date().toISOString(),
  event
 });

}

read(){
 return this.history;
}

}

