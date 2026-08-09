import {MasterPlanner} from "./MasterPlanner";
import {TaskDecomposer} from "./TaskDecomposer";
import {GovernanceGate} from "./GovernanceGate";
import {AutonomousExecutionLoop} from "./AutonomousExecutionLoop";
import {ArchitectureDecisionMemory} from "./ArchitectureDecisionMemory";
import {AutonomousRepairLoop} from "./AutonomousRepairLoop";
import {GitAutonomousManager} from "./GitAutonomousManager";
import {MissionState} from "./MissionState";


export class AutonomousOperatingSystem {


planner=new MasterPlanner();

decomposer=new TaskDecomposer();

governance=new GovernanceGate();

executor=new AutonomousExecutionLoop();

memory=new ArchitectureDecisionMemory();

repair=new AutonomousRepairLoop();

git=new GitAutonomousManager();



run(goal:string){


const tasks=this.decomposer.decompose(goal);


const approval=this.governance.validate(tasks);


if(!approval.approved){

return {

state:MissionState.FAILED

};

}



const execution=this.executor.execute(tasks);


this.memory.remember({

goal,

execution

});


const commit=this.git.commit(

"autonomous execution completed"

);



return {


state:MissionState.COMPLETED,

goal,

tasks,

execution,

commit,

memory:this.memory.retrieve()


};


}



}

