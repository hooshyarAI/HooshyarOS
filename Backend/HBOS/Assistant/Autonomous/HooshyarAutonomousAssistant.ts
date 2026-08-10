import {AutonomousIdentityCore} from "./AutonomousIdentityCore";
import {AutonomousGoalManager} from "./AutonomousGoalManager";
import {SelfEvaluationEngine} from "./SelfEvaluationEngine";
import {ContinuousImprovementEngine} from "./ContinuousImprovementEngine";
import {AutonomousToolManager} from "./AutonomousToolManager";
import {ProjectExecutionMemory} from "./ProjectExecutionMemory";
import {AutonomousAssistantRuntime} from "./AutonomousAssistantRuntime";
import {AutonomousMissionController} from "./AutonomousMissionController";

export class HooshyarAutonomousAssistant {
    identity=new AutonomousIdentityCore();
    goals=new AutonomousGoalManager();
    evaluation=new SelfEvaluationEngine();
    improvement=new ContinuousImprovementEngine();
    tools=new AutonomousToolManager();
    memory=new ProjectExecutionMemory();
    runtime=new AutonomousAssistantRuntime();
    missionController=new AutonomousMissionController();

    async execute(goal:string){
        const identity=this.identity.identify();
        const mission=this.goals.create(goal);
        const lifecycle= this.missionController.executeMission(goal);
        if (lifecycle.status !== "COMPLETED") {
            return {
                identity,
                mission,
                lifecycle,
                status: lifecycle.status,
                completed: false,
                runtime: null,
                evaluation: { healthy: false },
                improvement: { improved: false },
                tool: { executed: false },
            };
        }

        const runtime=await this.runtime.execute(goal);
        const evaluation=this.evaluation.evaluate(runtime);
        const improvement=this.improvement.improve(evaluation);
        const tool=this.tools.execute("internal_reasoning");
        const result={identity,mission,lifecycle,runtime,evaluation,improvement,tool};
        this.memory.record(result);
        return result;
    }
}
