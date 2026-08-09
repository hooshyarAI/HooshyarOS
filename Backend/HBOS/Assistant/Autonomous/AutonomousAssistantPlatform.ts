import {AssistantOrchestrator} from "./AssistantOrchestrator";
import {AssistantHealthMonitor} from "./AssistantHealthMonitor";
import {AssistantLifecycle} from "./AssistantLifecycle";


export class AutonomousAssistantPlatform {


private orchestrator=
new AssistantOrchestrator();


private health=
new AssistantHealthMonitor();



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
