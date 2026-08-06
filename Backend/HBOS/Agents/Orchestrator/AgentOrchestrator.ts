export class AgentOrchestrator {

private agents:any[] = [];

register(agent:any){
    this.agents.push(agent);
}

dispatch(task:any){

    return {
        task,
        agents:this.agents.map(a=>a.name),
        status:"dispatched"
    };

}

}
