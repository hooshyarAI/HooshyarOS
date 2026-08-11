import {AutonomousIdentityCore} from "./AutonomousIdentityCore";
import {AutonomousGoalManager} from "./AutonomousGoalManager";
import {SelfEvaluationEngine} from "./SelfEvaluationEngine";
import {ContinuousImprovementEngine} from "./ContinuousImprovementEngine";
import {AutonomousToolManager} from "./AutonomousToolManager";
import {ProjectExecutionMemory} from "./ProjectExecutionMemory";
import {AutonomousAssistantRuntime} from "./AutonomousAssistantRuntime";
import {AutonomousMissionController} from "./AutonomousMissionController";
import {AutonomousBuildDaemon} from "../../Autonomous/Runtime/AutonomousBuildDaemon";

export class HooshyarAutonomousAssistant {
    identity=new AutonomousIdentityCore();
    goals=new AutonomousGoalManager();
    evaluation=new SelfEvaluationEngine();
    improvement=new ContinuousImprovementEngine();
    tools=new AutonomousToolManager();
    memory=new ProjectExecutionMemory();
    runtime=new AutonomousAssistantRuntime();
    missionController=new AutonomousMissionController();

    constructor(private readonly buildDaemon: Pick<AutonomousBuildDaemon, "run"> = new AutonomousBuildDaemon()) {}

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
                construction: null,
            };
        }

        const runtime=await this.runtime.execute(goal);
        const evaluation=this.evaluation.evaluate(runtime);
        const improvement=this.improvement.improve(evaluation);
        const tool=this.tools.execute("internal_reasoning");

        // The Assistant is autonomous construction intelligence, not a human
        // executive advisor. Once its own lifecycle is complete, construction
        // ownership must pass automatically to the governed platform daemon so
        // the Assistant can continue building the repository without requiring
        // a second manual command or a cloud coding provider.
        const construction=this.continuePlatformConstruction();

        const result={identity,mission,lifecycle,runtime,evaluation,improvement,tool,construction};
        this.memory.record(result);
        return result;
    }

    /**
     * Explicitly hand the completed Assistant layer to the governed platform
     * continuation daemon. The daemon owns audit, capability selection,
     * construction, verification, commit/push and re-planning.
     */
    continuePlatformConstruction() {
        return this.buildDaemon.run();
    }
}