export class AutonomousDecisionLoop {

private decisions:any[] = [];

run(context:any){

    const decision = {
        context,
        action:"execute",
        learned:false,
        timestamp:new Date()
    };

    this.decisions.push(decision);

    return decision;
}

getDecisions(){

    return this.decisions;

}

}
