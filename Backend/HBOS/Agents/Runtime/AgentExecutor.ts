export class AgentExecutor {

execute(agent:any, tool:any, input:any){

    return {
        agent: agent.name,
        tool: tool.name,
        input,
        status:"executed"
    };

}

}
