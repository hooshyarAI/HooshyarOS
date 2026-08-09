import {ChiefEngineerState} from "./ChiefEngineerState";
import {CapabilityRegistry} from "./CapabilityRegistry";
import {DevelopmentMemory} from "./DevelopmentMemory";
import {SelfEvaluationEngine} from "./SelfEvaluationEngine";
import {AutonomousTaskPlanner} from "./AutonomousTaskPlanner";

export class ChiefEngineerController {


state=ChiefEngineerState.IDLE;

registry=new CapabilityRegistry();

memory=new DevelopmentMemory();

evaluation=new SelfEvaluationEngine();

planner=new AutonomousTaskPlanner();



execute(goal:string){

this.state=ChiefEngineerState.ANALYZING;


const plan=this.planner.createPlan(goal);


this.memory.record({

goal,

plan

});


this.state=ChiefEngineerState.READY;


return {

state:this.state,

goal,

plan,

evaluation:this.evaluation.evaluate({

goal

}),

memory:this.memory.read()

};


}


}

