import {MasterPlanner} from "./MasterPlanner";
import {ArchitectureMemory} from "./ArchitectureMemory";
import {DecisionContextEngine} from "./DecisionContextEngine";
import {TaskDecomposer} from "./TaskDecomposer";
import {AutonomousExecutionLoop} from "./AutonomousExecutionLoop";
import {GovernanceGate} from "./GovernanceGate";


export class AutonomousChiefEngineer {


planner=new MasterPlanner();
memory=new ArchitectureMemory();
context=new DecisionContextEngine();
decomposer=new TaskDecomposer();
executor=new AutonomousExecutionLoop();
governance=new GovernanceGate();



run(goal:string){


const plan=this.planner.plan(goal);

const ctx=this.context.analyze(goal);

const tasks=this.decomposer.decompose(goal);


const approval=this.governance.validate(tasks);


const execution=this.executor.execute(tasks);


return {

plan,
ctx,
approval,
execution

};


}


}

