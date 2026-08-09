import {HooshyarAutonomousAssistant}
from "./HooshyarAutonomousAssistant";

import {AutonomousDecisionPipeline}
from "./AutonomousDecisionPipeline";

import {AutonomousPlanningEngine}
from "./AutonomousPlanningEngine";

import {MissionHistoryEngine}
from "./MissionHistoryEngine";

import {AssistantHealthMonitor}
from "./AssistantHealthMonitor";

import {AutonomousGovernanceController}
from "./AutonomousGovernanceController";


export class HooshyarSelfOperatingAssistant {


assistant=new HooshyarAutonomousAssistant();

decision=new AutonomousDecisionPipeline();

planning=new AutonomousPlanningEngine();

history=new MissionHistoryEngine();

health=new AssistantHealthMonitor();

governance=new AutonomousGovernanceController();



async runMission(goal:string){


const plan=this.planning.plan(goal);


const governance=
this.governance.validate(plan);



if(!governance.approved){

return {

status:"BLOCKED"

};

}



const decision=
this.decision.decide(plan);



const execution=
await this.assistant.execute(goal);



const result={


status:"COMPLETED",

goal,

plan,

decision,

execution,

health:this.health.check()


};



this.history.record(result);


return result;


}


}


