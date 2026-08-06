export class AgentRunner {

    run(agent:string, task:string){

        return {
            agent,
            task,
            status:"EXECUTED"
        };

    }

}