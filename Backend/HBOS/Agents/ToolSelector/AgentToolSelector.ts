export class AgentToolSelector {

constructor(private registry:any){}

select(task:any){

    const tools = this.registry.getTools();

    return tools.find((tool:any)=>
        tool.capability === task.type
    );

}

list(){

    return this.registry.getTools();

}

}

