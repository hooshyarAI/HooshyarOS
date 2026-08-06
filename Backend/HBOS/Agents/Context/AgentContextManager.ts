export class AgentContextManager {

private contexts:any = {};

set(agent:string, context:any){

    this.contexts[agent] = context;

}

get(agent:string){

    return this.contexts[agent];

}

clear(agent:string){

    delete this.contexts[agent];

}

}

