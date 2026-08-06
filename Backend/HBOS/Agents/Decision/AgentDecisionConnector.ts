export class AgentDecisionConnector {

constructor(private decisionEngine:any){}

evaluate(input:any){

    return this.decisionEngine.evaluate(input);

}

requestDecision(data:any){

    return {
        type:"decision_request",
        payload:data
    };

}

}

