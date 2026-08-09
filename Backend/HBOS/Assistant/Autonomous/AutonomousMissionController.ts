import { MasterPlanner } from "./MasterPlanner";
import { ArchitectureMemory } from "./ArchitectureMemory";
import { DecisionContextEngine } from "./DecisionContextEngine";
import { TaskDecomposer } from "./TaskDecomposer";
import { AutonomousExecutionLoop } from "./AutonomousExecutionLoop";
import { GovernanceGate } from "./GovernanceGate";


export class AutonomousMissionController {


private planner:MasterPlanner;
private memory:ArchitectureMemory;
private context:DecisionContextEngine;
private decomposer:TaskDecomposer;
private executor:AutonomousExecutionLoop;
private governance:GovernanceGate;



constructor(){

this.planner=new MasterPlanner();
this.memory=new ArchitectureMemory();
this.context=new DecisionContextEngine();
this.decomposer=new TaskDecomposer();
this.executor=new AutonomousExecutionLoop();
this.governance=new GovernanceGate();

}



executeMission(goal:string){


const architecture=this.memory.load();


const plan=this.planner.plan(goal);


const decision=this.context.analyze(goal);


const tasks=this.decomposer.decompose(goal);


const approval=this.governance.validate(tasks);


if(!approval.approved){

return {
status:"BLOCKED",
reason:"Governance rejected mission"
};

}



const execution=this.executor.execute(tasks);



this.memory.store({

goal,

completed:true,

tasks:execution

});



return {

status:"COMPLETED",

goal,

architecture,

plan,

decision,

execution

};


}



}

