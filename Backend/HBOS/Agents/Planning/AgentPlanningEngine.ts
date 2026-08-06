export class AgentPlanningEngine {

createPlan(request:any){

    return {
        request,
        steps:[
            "analyze",
            "select_tools",
            "execute",
            "validate"
        ],
        status:"planned"
    };

}

}

