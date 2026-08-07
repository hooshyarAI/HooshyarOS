export class BuilderTaskQueue {

private tasks:any[]=[];

push(task:any){

this.tasks.push(task);

}

next(){

return this.tasks.shift();

}

size(){

return this.tasks.length;

}

}

