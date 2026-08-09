export class ArchitectureMemory {

private decisions:any[]=[];


store(decision:any){

this.decisions.push(decision);

return true;

}


load(){

return this.decisions;

}


}

