import { AutonomousAssistantRuntime } from "./AutonomousAssistantRuntime";

export class AssistantOrchestrator {

private runtime=new AutonomousAssistantRuntime();

async start(goal:string){

const result =
await this.runtime.execute(goal);

return {
status:"RUNNING",
assistant:"ACTIVE",
result
};

}

}
