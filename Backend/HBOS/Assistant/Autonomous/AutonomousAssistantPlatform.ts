import {AssistantOrchestrator} from "./AssistantOrchestrator";
import {AssistantHealthMonitor} from "./AssistantHealthMonitor";
import {AssistantLifecycle} from "./AssistantLifecycle";


export class AutonomousAssistantPlatform {


private health=
new AssistantHealthMonitor();

constructor(
private readonly orchestrator: Pick<AssistantOrchestrator, "start"> = new AssistantOrchestrator(),
private readonly healthMonitor: AssistantHealthMonitor = new AssistantHealthMonitor()
) {
this.health = healthMonitor;
}


async boot(goal:string){

const result=
await this.orchestrator.start(goal);


return {

state:AssistantLifecycle.READY,

health:this.health.check(),

result

};


}


}
