export class AgentCoordinator {

private agents:any[] = [];

register(agent:any){

    this.agents.push(agent);

}

execute(input:any){

    return this.agents.map(agent => 
        agent.analyze(input)
    );

}

}
