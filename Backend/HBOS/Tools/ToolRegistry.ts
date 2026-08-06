export class ToolRegistry {

private tools:any[] = [];

register(tool:any){

    this.tools.push(tool);

}

getTools(){

    return this.tools;

}

find(name:string){

    return this.tools.find(t => t.name === name);

}

}
