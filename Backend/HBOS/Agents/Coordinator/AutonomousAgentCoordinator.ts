export class AutonomousAgentCoordinator {

constructor(
    private orchestrator:any,
    private planner:any,
    private selector:any
){}

execute(request:any){

    const plan = this.planner.createPlan(request);

    const tool = this.selector.select(request);

    return {
        request,
        plan,
        tool,
        status:"coordinated"
    };

}

}

