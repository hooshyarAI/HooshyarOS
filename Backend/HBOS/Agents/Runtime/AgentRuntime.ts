export class AgentRuntime {

private agents:any[] = [];

register(agent:any){

    this.agents.push(agent);

}

run(name:string, task:any){

    const agent = this.agents.find(a => a.name === name);

    if(!agent){
        return {
            status:"agent_not_found"
        };
    }

    return agent.execute(task);

}

list(){

    return this.agents;

}

}
