import { MasterPlanner } from "./MasterPlanner";
import { ArchitectureMemory } from "./ArchitectureMemory";
import { DecisionContextEngine } from "./DecisionContextEngine";
import { TaskDecomposer } from "./TaskDecomposer";
import { AutonomousExecutionLoop } from "./AutonomousExecutionLoop";
import { GovernanceGate } from "./GovernanceGate";

export type MissionStage =
    | "OBSERVE"
    | "REASON"
    | "DECIDE"
    | "PLAN"
    | "EXECUTE"
    | "VERIFY"
    | "LEARN";

export type MissionStatus = "RUNNING" | "COMPLETED" | "BLOCKED" | "FAILED";

export interface MissionRecord {
    goal: string;
    status: MissionStatus;
    stage: MissionStage;
    completed: boolean;
    progress: number;
    tasks: any[];
    failure?: {
        stage: MissionStage;
        reason: string;
        isolated: true;
        completed: false;
    };
}

/**
 * Autonomous Assistant mission orchestration boundary.
 * Existing engines remain the owners of planning, context, governance,
 * execution and memory; this controller coordinates their lifecycle.
 */
export class AutonomousMissionController {
    private planner: MasterPlanner;
    private memory: ArchitectureMemory;
    private context: DecisionContextEngine;
    private decomposer: TaskDecomposer;
    private executor: AutonomousExecutionLoop;
    private governance: GovernanceGate;

    constructor() {
        this.planner = new MasterPlanner();
        this.memory = new ArchitectureMemory();
        this.context = new DecisionContextEngine();
        this.decomposer = new TaskDecomposer();
        this.executor = new AutonomousExecutionLoop();
        this.governance = new GovernanceGate();
    }

    executeMission(goal: string) {
        if (!goal || !goal.trim()) {
            return {
                status: "FAILED" as const,
                goal,
                failure: {
                    stage: "OBSERVE" as const,
                    reason: "Mission goal is empty",
                    isolated: true as const,
                    completed: false as const
                }
            };
        }

        const lifecycle: MissionStage[] = [
            "OBSERVE",
            "REASON",
            "DECIDE",
            "PLAN",
            "EXECUTE",
            "VERIFY",
            "LEARN"
        ];

        const architecture = this.memory.load();
        const plan = this.planner.plan(goal);
        const decision = this.context.analyze(goal);
        const tasks = this.decomposer.decompose(goal);
        const approval = this.governance.validate(tasks);

        if (!approval.approved) {
            const failure: MissionRecord = {
                goal,
                status: "BLOCKED",
                stage: "DECIDE",
                completed: false,
                progress: 0,
                tasks,
                failure: {
                    stage: "DECIDE",
                    reason: "Governance rejected mission",
                    isolated: true,
                    completed: false
                }
            };
            this.memory.store(failure);
            return failure;
        }

        let execution: any[];
        try {
            execution = this.executor.execute(tasks);
        } catch (error: any) {
            const failure: MissionRecord = {
                goal,
                status: "FAILED",
                stage: "EXECUTE",
                completed: false,
                progress: 0,
                tasks,
                failure: {
                    stage: "EXECUTE",
                    reason: error?.message || "Mission execution failed",
                    isolated: true,
                    completed: false
                }
            };
            this.memory.store(failure);
            return failure;
        }

        const verified = Array.isArray(execution)
            && execution.length === tasks.length
            && execution.every(task => task && task.executed === true);

        if (!verified) {
            const failure: MissionRecord = {
                goal,
                status: "FAILED",
                stage: "VERIFY",
                completed: false,
                progress: tasks.length === 0 ? 0 : Math.floor((execution.length / tasks.length) * 100),
                tasks: execution,
                failure: {
                    stage: "VERIFY",
                    reason: "Execution verification failed",
                    isolated: true,
                    completed: false
                }
            };
            this.memory.store(failure);
            return failure;
        }

        const result: MissionRecord & {
            architecture: any;
            plan: any;
            decision: any;
            execution: any[];
            lifecycle: MissionStage[];
        } = {
            status: "COMPLETED",
            goal,
            stage: "LEARN",
            completed: true,
            progress: 100,
            tasks: execution,
            architecture,
            plan,
            decision,
            execution,
            lifecycle
        };

        this.memory.store({
            ...result,
            outcome: "SUCCESS"
        });

        return result;
    }
}
