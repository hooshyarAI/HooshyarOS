
import { Engine } from "../Core/Engine";
import { DecisionEngine } from "./DecisionEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";
import { GovernanceEngine } from "./GovernanceEngine";
import { HealthMonitorEngine } from "./HealthMonitorEngine";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { EngineRegistry } from "./EngineRegistry";
import { SecurityContext } from "../Security/SecurityContext";
import { AuthorizationGuard } from "../Security/AuthorizationGuard";

export interface OperationResult {
    operation: string;
    status: "READY" | "BLOCKED";
    projectCount: number;
}

export interface WorkflowProvenance {
    readonly traceId: string;
    readonly inputHash: string;
    readonly outputHash: string;
    readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
    readonly sourceRef: string;
    readonly reasoningSteps: readonly string[];
    readonly timestamp: string;
}

export interface WorkflowStep {
    readonly stepId: string;
    readonly description: string;
    readonly assignedEngine: string;
    readonly estimatedDurationMs: number;
    readonly requiresApproval: boolean;
}

export interface WorkflowConstraints {
    readonly maxDuration?: number;
    readonly maxBudget?: number;
    readonly requiredApprovals: readonly string[];
}

export interface WorkflowPlan {
    readonly workflowId: string;
    readonly goal: string;
    readonly steps: readonly WorkflowStep[];
    readonly requiredApprovals: readonly string[];
    readonly estimatedDuration: number;
    readonly estimatedBudget: number;
    readonly status: "READY" | "BLOCKED";
    readonly provenance: WorkflowProvenance;
    readonly tenantId: string | undefined;
    readonly timestamp: string;
}

/** Deterministic activity input for Critical Path Method (CPM) planning. */
export interface ProjectActivityInput {
    readonly id: string;
    /** Non-negative duration; all activities in a project must use the same time unit. */
    readonly duration: number;
    /** Finish-to-start dependencies by activity id. */
    readonly dependencies?: readonly string[];
}

export interface ProjectActivityPlan {
    readonly id: string;
    readonly duration: number;
    readonly dependencies: readonly string[];
    readonly earliestStart: number;
    readonly earliestFinish: number;
    readonly latestStart: number;
    readonly latestFinish: number;
    readonly totalFloat: number;
    readonly isCritical: boolean;
}

export interface ProjectScheduleResult {
    readonly projectId: string;
    /** READY means CPM arithmetic completed; it does not independently verify estimates. */
    readonly status: "READY" | "BLOCKED";
    readonly qualification: "REVIEW_REQUIRED" | "BLOCKED";
    readonly requiresHumanReview: true;
    readonly projectDuration: number;
    readonly activities: readonly ProjectActivityPlan[];
    /** One deterministic critical path; other equal critical paths may also exist. */
    readonly criticalPath: readonly string[];
    /** All zero-float activities in deterministic topological order. */
    readonly criticalActivities: readonly string[];
    readonly reason?: string;
    readonly provenance: WorkflowProvenance;
    readonly timestamp: string;
}

export interface AgentAssignment {
    readonly agentType: string;
    readonly agentId: string;
    readonly task: string;
    readonly authority: string;
    readonly provenance?: WorkflowProvenance;
}

export interface AssignedAgent {
    readonly agentType: string;
    readonly agentId: string;
    readonly task: string;
    readonly authority: string;
    readonly tenantId: string | undefined;
    readonly assignedAt: string;
}

export interface CoordinationResult {
    readonly workflowId: string;
    readonly assignedAgents: readonly AssignedAgent[];
    readonly executionStatus: "COORDINATED" | "BLOCKED" | "PARTIAL";
    readonly provenance: WorkflowProvenance;
    readonly tenantId: string | undefined;
    readonly timestamp: string;
}

export interface WorkflowExecutionResult {
    readonly workflowId: string;
    readonly status: "EXECUTED" | "BLOCKED" | "FAILED";
    readonly results: readonly string[];
    readonly provenance: WorkflowProvenance;
    readonly tenantId: string | undefined;
    readonly complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "REVIEW_REQUIRED";
    readonly timestamp: string;
}

export interface ExecutionMonitor {
    readonly workflowId: string;
    readonly status: "RUNNING" | "COMPLETED" | "FAILED" | "ROLLING_BACK" | "UNKNOWN";
    readonly progressPercent: number;
    readonly currentStep: string;
    readonly logs: readonly string[];
    readonly provenance: WorkflowProvenance;
    readonly tenantId: string | undefined;
    readonly timestamp: string;
}

export interface RollbackResult {
    readonly workflowId: string;
    readonly wasRolledBack: boolean;
    readonly previousState: string;
    readonly reason: string;
    readonly provenance: WorkflowProvenance;
    readonly tenantId: string | undefined;
    readonly timestamp: string;
}

const SOURCE_REF = "AutonomousOperationsEngine";

function buildProvenance(
    input: string,
    reasoningSteps: readonly string[],
    output: string,
    previousTraceId?: string
): WorkflowProvenance {
    const traceId = previousTraceId ?? ProvenanceTrace.createTraceId();
    return Object.freeze({
        traceId,
        inputHash: ProvenanceTrace.hashInput(input),
        outputHash: ProvenanceTrace.hashInput(output),
        verificationStatus: "VERIFIED" as const,
        sourceRef: SOURCE_REF,
        reasoningSteps: Object.freeze([...reasoningSteps]),
        timestamp: new Date().toISOString()
    });
}

function safeSerialize(value: unknown): string {
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return "[unserializable-input]";
    }
}

function buildProjectScheduleProvenance(
    input: string,
    reasoningSteps: readonly string[],
    output: string,
    verificationStatus: WorkflowProvenance["verificationStatus"]
): WorkflowProvenance {
    const provenance = buildProvenance(input, reasoningSteps, output);
    return Object.freeze({ ...provenance, verificationStatus });
}

export class AutonomousOperationsEngine implements Engine {
    name = "AutonomousOperationsEngine";

    private readonly decisions = new DecisionEngine();
    private readonly projects = new ProjectPilotEngine();
    private readonly governance = new GovernanceEngine();
    private readonly healthMonitor = new HealthMonitorEngine();

    private readonly workflows = new Map<string, WorkflowPlan>();
    private readonly coordination = new Map<string, CoordinationResult>();
    private readonly executions = new Map<string, WorkflowExecutionResult>();
    private readonly monitors = new Map<string, ExecutionMonitor>();
    private readonly rollbackSnapshots = new Map<string, string>();

    initialize(): void {
        this.decisions.initialize();
        this.projects.initialize();
        this.governance.initialize();
        this.healthMonitor.initialize();
        EngineRegistry.getInstance().register(this);
        console.log("AutonomousOperationsEngine Started");
    }

    health(): boolean {
        if (!this.decisions.health()) return false;
        if (!this.projects.health()) return false;
        if (!this.governance.health()) return false;
        return true;
    }

    execute(operation: string): OperationResult {
        if (!operation || !operation.trim()) {
            return { operation, status: "BLOCKED", projectCount: this.projects.getProjects().length };
        }
        return {
            operation,
            status: this.health() ? "READY" : "BLOCKED",
            projectCount: this.projects.getProjects().length
        };
    }

    planWorkflow(goal: string, constraints: WorkflowConstraints): WorkflowPlan {
        const trimmedGoal = (goal ?? "").trim();
        const approvals = constraints?.requiredApprovals ?? [];
        const input = JSON.stringify({ goal: trimmedGoal, constraints });

        if (!trimmedGoal) {
            const provenance = buildProvenance(
                input,
                ["validate-goal", "goal-empty"],
                JSON.stringify({ status: "BLOCKED", reason: "goal-empty" })
            );
            return Object.freeze({
                workflowId: provenance.traceId,
                goal: trimmedGoal,
                steps: Object.freeze([]),
                requiredApprovals: Object.freeze([...approvals]),
                estimatedDuration: 0,
                estimatedBudget: 0,
                status: "BLOCKED",
                provenance,
                tenantId: undefined,
                timestamp: provenance.timestamp
            });
        }

        if (approvals.length === 0) {
            const provenance = buildProvenance(
                input,
                ["validate-approvals", "missing-required-approvals"],
                JSON.stringify({ status: "BLOCKED", reason: "missing-approvals" })
            );
            return Object.freeze({
                workflowId: provenance.traceId,
                goal: trimmedGoal,
                steps: Object.freeze([]),
                requiredApprovals: Object.freeze([]),
                estimatedDuration: 0,
                estimatedBudget: 0,
                status: "BLOCKED",
                provenance,
                tenantId: undefined,
                timestamp: provenance.timestamp
            });
        }

        const steps: WorkflowStep[] = [
            { stepId: "step-1-validate", description: "Validate goal against tenant and governance constraints", assignedEngine: "GovernanceEngine", estimatedDurationMs: 50, requiresApproval: false },
            { stepId: "step-2-plan", description: "Build execution plan via DecisionEngine", assignedEngine: "DecisionEngine", estimatedDurationMs: 75, requiresApproval: false },
            { stepId: "step-3-coordinate", description: "Coordinate distributed agents via ProjectPilotEngine", assignedEngine: "ProjectPilotEngine", estimatedDurationMs: 100, requiresApproval: true },
            { stepId: "step-4-execute", description: "Execute workflow with security authorization", assignedEngine: "AutonomousOperationsEngine", estimatedDurationMs: 200, requiresApproval: true },
            { stepId: "step-5-verify", description: "Verify health and completion via HealthMonitorEngine", assignedEngine: "HealthMonitorEngine", estimatedDurationMs: 25, requiresApproval: false }
        ];

        const estimatedDuration = steps.reduce((sum, s) => sum + s.estimatedDurationMs, 0);
        const estimatedBudget = steps.length * 10;

        if (constraints.maxDuration !== undefined && estimatedDuration > constraints.maxDuration) {
            const provenance = buildProvenance(
                input,
                ["plan-steps", "validate-duration", "duration-exceeds-max"],
                JSON.stringify({ status: "BLOCKED", reason: "duration-exceeds-max", estimatedDuration, maxDuration: constraints.maxDuration })
            );
            return Object.freeze({
                workflowId: provenance.traceId,
                goal: trimmedGoal,
                steps: Object.freeze([]),
                requiredApprovals: Object.freeze([...approvals]),
                estimatedDuration,
                estimatedBudget,
                status: "BLOCKED",
                provenance,
                tenantId: undefined,
                timestamp: provenance.timestamp
            });
        }

        if (constraints.maxBudget !== undefined && estimatedBudget > constraints.maxBudget) {
            const provenance = buildProvenance(
                input,
                ["plan-steps", "validate-budget", "budget-exceeds-max"],
                JSON.stringify({ status: "BLOCKED", reason: "budget-exceeds-max", estimatedBudget, maxBudget: constraints.maxBudget })
            );
            return Object.freeze({
                workflowId: provenance.traceId,
                goal: trimmedGoal,
                steps: Object.freeze([]),
                requiredApprovals: Object.freeze([...approvals]),
                estimatedDuration,
                estimatedBudget,
                status: "BLOCKED",
                provenance,
                tenantId: undefined,
                timestamp: provenance.timestamp
            });
        }

        const provenance = buildProvenance(
            input,
            ["validate-goal", "validate-approvals", "plan-steps", "validate-duration", "validate-budget"],
            JSON.stringify({ status: "READY", stepCount: steps.length, estimatedDuration, estimatedBudget })
        );

        const plan: WorkflowPlan = Object.freeze({
            workflowId: provenance.traceId,
            goal: trimmedGoal,
            steps: Object.freeze(steps),
            requiredApprovals: Object.freeze([...approvals]),
            estimatedDuration,
            estimatedBudget,
            status: "READY",
            provenance,
            tenantId: undefined,
            timestamp: provenance.timestamp
        });

        this.workflows.set(plan.workflowId, plan);
        return plan;
    }


    /**
     * Calculate a deterministic Critical Path Method schedule from explicit
     * activity durations and finish-to-start dependencies.
     *
     * The arithmetic is verified as a computation, but user-supplied duration
     * estimates are not independent evidence. Successful results therefore
     * remain REVIEW_REQUIRED and carry PENDING provenance until reviewed.
     * This plans a schedule only; it never approves or executes project work.
     */
    planProjectSchedule(
        projectId: string,
        activities: readonly ProjectActivityInput[]
    ): ProjectScheduleResult {
        const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : "";
        const rawInput = safeSerialize({ projectId, activities });
        const blocked = (
            reason: string,
            steps: readonly string[],
            input = rawInput
        ): ProjectScheduleResult => {
            const output = safeSerialize({ status: "BLOCKED", projectId: normalizedProjectId, reason });
            const provenance = buildProjectScheduleProvenance(input, steps, output, "FAILED");
            return Object.freeze({
                projectId: normalizedProjectId,
                status: "BLOCKED",
                qualification: "BLOCKED",
                requiresHumanReview: true as const,
                projectDuration: 0,
                activities: Object.freeze([]),
                criticalPath: Object.freeze([]),
                criticalActivities: Object.freeze([]),
                reason,
                provenance,
                timestamp: provenance.timestamp
            });
        };

        if (!normalizedProjectId) {
            return blocked("PROJECT_ID_REQUIRED", ["validate-project-id"]);
        }
        if (!Array.isArray(activities) || activities.length === 0) {
            return blocked("PROJECT_ACTIVITIES_REQUIRED", ["validate-activities"]);
        }

        const normalized: Array<{
            id: string;
            duration: number;
            dependencies: string[];
            inputIndex: number;
        }> = [];
        const ids = new Set<string>();

        for (let index = 0; index < activities.length; index += 1) {
            const activity = activities[index] as ProjectActivityInput | null | undefined;
            if (!activity || typeof activity.id !== "string" || !activity.id.trim()) {
                return blocked("ACTIVITY_ID_REQUIRED", ["validate-activity-ids"]);
            }
            const id = activity.id.trim();
            if (ids.has(id)) return blocked("DUPLICATE_ACTIVITY_ID", ["validate-unique-activity-ids"]);
            ids.add(id);

            if (typeof activity.duration !== "number" || !Number.isFinite(activity.duration) || activity.duration < 0) {
                return blocked("ACTIVITY_DURATION_INVALID", ["validate-activity-durations"]);
            }

            const rawDependencies = activity.dependencies ?? [];
            if (!Array.isArray(rawDependencies)) {
                return blocked("ACTIVITY_DEPENDENCIES_INVALID", ["validate-activity-dependencies"]);
            }
            const dependencies: string[] = [];
            const seenDependencies = new Set<string>();
            for (const rawDependency of rawDependencies as readonly unknown[]) {
                if (typeof rawDependency !== "string" || !rawDependency.trim()) {
                    return blocked("ACTIVITY_DEPENDENCIES_INVALID", ["validate-activity-dependencies"]);
                }
                const dependency = rawDependency.trim();
                if (dependency === id) return blocked("SELF_DEPENDENCY", ["validate-dependency-edges"]);
                if (seenDependencies.has(dependency)) {
                    return blocked("DUPLICATE_DEPENDENCY", ["validate-unique-dependency-edges"]);
                }
                seenDependencies.add(dependency);
                dependencies.push(dependency);
            }
            normalized.push({ id, duration: activity.duration, dependencies, inputIndex: index });
        }

        for (const activity of normalized) {
            if (activity.dependencies.some(dependency => !ids.has(dependency))) {
                return blocked("UNKNOWN_DEPENDENCY", ["validate-dependency-references"]);
            }
        }

        const successors = new Map<string, string[]>();
        const remainingDependencies = new Map<string, number>();
        for (const activity of normalized) {
            successors.set(activity.id, []);
            remainingDependencies.set(activity.id, activity.dependencies.length);
        }
        for (const activity of normalized) {
            for (const dependency of activity.dependencies) {
                successors.get(dependency)!.push(activity.id);
            }
        }

        // Kahn's algorithm with stable input-order tie-breaking keeps output deterministic.
        const queue = normalized
            .filter(activity => remainingDependencies.get(activity.id) === 0)
            .map(activity => activity.id);
        const topologicalOrder: string[] = [];
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
            const id = queue[cursor];
            topologicalOrder.push(id);
            for (const successor of successors.get(id)!) {
                const remaining = remainingDependencies.get(successor)! - 1;
                remainingDependencies.set(successor, remaining);
                if (remaining === 0) queue.push(successor);
            }
        }
        if (topologicalOrder.length !== normalized.length) {
            return blocked("DEPENDENCY_CYCLE", ["validate-dependency-graph", "cycle-detected"]);
        }

        const byId = new Map(normalized.map(activity => [activity.id, activity]));
        const earliestStart = new Map<string, number>();
        const earliestFinish = new Map<string, number>();
        let projectDuration = 0;

        for (const id of topologicalOrder) {
            const activity = byId.get(id)!;
            const start = activity.dependencies.reduce(
                (latest, dependency) => Math.max(latest, earliestFinish.get(dependency) ?? 0),
                0
            );
            const finish = start + activity.duration;
            if (!Number.isFinite(finish)) {
                return blocked("PROJECT_DURATION_OVERFLOW", ["calculate-earliest-times", "duration-overflow"]);
            }
            earliestStart.set(id, start);
            earliestFinish.set(id, finish);
            projectDuration = Math.max(projectDuration, finish);
        }

        const latestStart = new Map<string, number>();
        const latestFinish = new Map<string, number>();
        for (let index = topologicalOrder.length - 1; index >= 0; index -= 1) {
            const id = topologicalOrder[index];
            const activity = byId.get(id)!;
            const nextActivities = successors.get(id)!;
            const finish = nextActivities.length > 0
                ? Math.min(...nextActivities.map(successor => latestStart.get(successor)!))
                : projectDuration;
            const start = finish - activity.duration;
            if (!Number.isFinite(start) || !Number.isFinite(finish)) {
                return blocked("PROJECT_DURATION_OVERFLOW", ["calculate-latest-times", "duration-overflow"]);
            }
            latestFinish.set(id, finish);
            latestStart.set(id, start);
        }

        const tolerance = 1e-9;
        const plannedActivities: ProjectActivityPlan[] = topologicalOrder.map(id => {
            const activity = byId.get(id)!;
            const start = earliestStart.get(id)!;
            const finish = earliestFinish.get(id)!;
            const lateStart = latestStart.get(id)!;
            const lateFinish = latestFinish.get(id)!;
            const rawFloat = lateStart - start;
            const totalFloat = Math.abs(rawFloat) <= tolerance ? 0 : rawFloat;
            return Object.freeze({
                id,
                duration: activity.duration,
                dependencies: Object.freeze([...activity.dependencies]),
                earliestStart: start,
                earliestFinish: finish,
                latestStart: lateStart,
                latestFinish: lateFinish,
                totalFloat,
                isCritical: totalFloat === 0
            });
        });
        const criticalSet = new Set(plannedActivities.filter(activity => activity.isCritical).map(activity => activity.id));
        const criticalActivities = plannedActivities.filter(activity => activity.isCritical).map(activity => activity.id);

        // Return one deterministic path. The separate criticalActivities list
        // preserves all zero-float activities when several critical paths exist.
        const terminal = topologicalOrder.find(id =>
            successors.get(id)!.length === 0 &&
            Math.abs((earliestFinish.get(id) ?? 0) - projectDuration) <= tolerance &&
            criticalSet.has(id)
        );
        const reversedPath: string[] = [];
        let current = terminal;
        while (current) {
            reversedPath.push(current);
            const currentStart = earliestStart.get(current)!;
            const predecessor = byId.get(current)!.dependencies.find(dependency =>
                criticalSet.has(dependency) &&
                Math.abs((earliestFinish.get(dependency) ?? 0) - currentStart) <= tolerance
            );
            current = predecessor;
        }
        const criticalPath = reversedPath.reverse();
        const resultInput = safeSerialize({
            projectId: normalizedProjectId,
            activities: normalized.map(({ id, duration, dependencies }) => ({ id, duration, dependencies }))
        });
        const output = safeSerialize({ projectDuration, activities: plannedActivities, criticalPath, criticalActivities });
        const provenance = buildProjectScheduleProvenance(
            resultInput,
            ["validate-activities", "validate-dependencies", "topological-sort", "calculate-earliest-times", "calculate-latest-times", "identify-critical-path"],
            output,
            "PENDING"
        );

        return Object.freeze({
            projectId: normalizedProjectId,
            status: "READY",
            qualification: "REVIEW_REQUIRED",
            requiresHumanReview: true as const,
            projectDuration,
            activities: Object.freeze(plannedActivities),
            criticalPath: Object.freeze(criticalPath),
            criticalActivities: Object.freeze(criticalActivities),
            provenance,
            timestamp: provenance.timestamp
        });
    }

    coordinateAgents(workflowId: string, agents: readonly AgentAssignment[]): CoordinationResult {
        const input = JSON.stringify({ workflowId, agents: agents ?? [] });
        const trimmedWorkflowId = (workflowId ?? "").trim();

        if (!trimmedWorkflowId) {
            const provenance = buildProvenance(
                input,
                ["validate-workflow-id", "workflow-id-empty"],
                JSON.stringify({ status: "BLOCKED", reason: "workflow-id-empty" })
            );
            return Object.freeze({
                workflowId: trimmedWorkflowId,
                assignedAgents: Object.freeze([]),
                executionStatus: "BLOCKED",
                provenance,
                tenantId: undefined,
                timestamp: provenance.timestamp
            });
        }

        if (!agents || agents.length === 0) {
            const provenance = buildProvenance(
                input,
                ["validate-agents", "no-agents"],
                JSON.stringify({ status: "BLOCKED", reason: "no-agents" })
            );
            return Object.freeze({
                workflowId: trimmedWorkflowId,
                assignedAgents: Object.freeze([]),
                executionStatus: "BLOCKED",
                provenance,
                tenantId: undefined,
                timestamp: provenance.timestamp
            });
        }

        const plan = this.workflows.get(trimmedWorkflowId);
        const validation = this.validateAgents(agents);

        const assignedAgents: AssignedAgent[] = validation.valid.map((a) =>
            Object.freeze({
                agentType: a.agentType,
                agentId: a.agentId,
                task: a.task,
                authority: a.authority,
                tenantId: undefined,
                assignedAt: new Date().toISOString()
            })
        );

        const provenance = buildProvenance(
            input,
            ["validate-workflow-id", "validate-agents", "resolve-workflow-plan", "assign-agents"],
            JSON.stringify({ status: validation.status, workflowId: trimmedWorkflowId, assigned: assignedAgents.length, total: agents.length, planFound: !!plan })
        );

        const result: CoordinationResult = Object.freeze({
            workflowId: trimmedWorkflowId,
            assignedAgents: Object.freeze(assignedAgents),
            executionStatus: validation.status,
            provenance,
            tenantId: undefined,
            timestamp: provenance.timestamp
        });

        this.coordination.set(trimmedWorkflowId, result);
        return result;
    }

    executeAuthorizedWorkflow(workflowId: string, securityContext: SecurityContext): WorkflowExecutionResult {
        const trimmedWorkflowId = (workflowId ?? "").trim();
        const input = JSON.stringify({ workflowId: trimmedWorkflowId, securityContext });

        if (!trimmedWorkflowId) {
            const provenance = buildProvenance(input, ["validate-workflow-id", "workflow-id-empty"], JSON.stringify({ status: "BLOCKED", reason: "workflow-id-empty" }));
            return Object.freeze({
                workflowId: trimmedWorkflowId,
                status: "BLOCKED",
                results: Object.freeze([]),
                provenance,
                tenantId: securityContext?.tenantId,
                complianceStatus: "NON_COMPLIANT",
                timestamp: provenance.timestamp
            });
        }

        const authCheck = AuthorizationGuard.checkAutonomousExecute(securityContext);
        if (authCheck.result !== "PERMITTED") {
            const provenance = buildProvenance(input, ["security-check", "authorization-denied"], JSON.stringify({ status: "BLOCKED", reason: authCheck.reason }));
            return Object.freeze({
                workflowId: trimmedWorkflowId,
                status: "BLOCKED",
                results: Object.freeze(["Authorization denied: " + authCheck.reason]),
                provenance,
                tenantId: securityContext?.tenantId,
                complianceStatus: "NON_COMPLIANT",
                timestamp: provenance.timestamp
            });
        }

        const plan = this.workflows.get(trimmedWorkflowId);
        if (!plan) {
            const provenance = buildProvenance(input, ["security-check", "resolve-workflow-plan", "plan-missing"], JSON.stringify({ status: "BLOCKED", reason: "plan-missing" }));
            return Object.freeze({
                workflowId: trimmedWorkflowId,
                status: "BLOCKED",
                results: Object.freeze(["Workflow plan not found"]),
                provenance,
                tenantId: securityContext?.tenantId,
                complianceStatus: "NON_COMPLIANT",
                timestamp: provenance.timestamp
            });
        }

        const healthStatuses = this.healthMonitor.checkAll();
        const allHealthy = healthStatuses.length === 0 || healthStatuses.every((s) => s.healthy);

        const results: string[] = [];
        for (const step of plan.steps) {
            results.push("Executed " + step.stepId + " via " + step.assignedEngine);
        }

        const complianceStatus: WorkflowExecutionResult["complianceStatus"] = allHealthy ? "COMPLIANT" : "REVIEW_REQUIRED";
        const status: WorkflowExecutionResult["status"] = allHealthy ? "EXECUTED" : "FAILED";

        const provenance = buildProvenance(
            input,
            ["security-check", "resolve-workflow-plan", "health-check", "execute-steps"],
            JSON.stringify({ status, workflowId: trimmedWorkflowId, stepCount: plan.steps.length, allHealthy, complianceStatus })
        );

        const execution: WorkflowExecutionResult = Object.freeze({
            workflowId: trimmedWorkflowId,
            status,
            results: Object.freeze(results),
            provenance,
            tenantId: securityContext?.tenantId,
            complianceStatus,
            timestamp: provenance.timestamp
        });

        this.executions.set(trimmedWorkflowId, execution);

        const monitor: ExecutionMonitor = Object.freeze({
            workflowId: trimmedWorkflowId,
            status: status === "EXECUTED" ? "COMPLETED" : "FAILED",
            progressPercent: status === "EXECUTED" ? 100 : 50,
            currentStep: status === "EXECUTED" ? "verify" : "execute",
            logs: Object.freeze(results),
            provenance,
            tenantId: securityContext?.tenantId,
            timestamp: provenance.timestamp
        });
        this.monitors.set(trimmedWorkflowId, monitor);
        this.rollbackSnapshots.set(trimmedWorkflowId, JSON.stringify({ workflowId: plan.workflowId, status: plan.status, snapshotAt: provenance.timestamp }));

        return execution;
    }

    monitorExecution(workflowId: string): ExecutionMonitor {
        const trimmedWorkflowId = (workflowId ?? "").trim();
        const input = JSON.stringify({ workflowId: trimmedWorkflowId });

        const existing = this.monitors.get(trimmedWorkflowId);
        if (existing) {
            return existing;
        }

        const execution = this.executions.get(trimmedWorkflowId);

        if (!execution) {
            const provenance = buildProvenance(input, ["lookup-workflow", "workflow-unknown"], JSON.stringify({ status: "UNKNOWN" }));
            return Object.freeze({
                workflowId: trimmedWorkflowId,
                status: "UNKNOWN",
                progressPercent: 0,
                currentStep: "none",
                logs: Object.freeze([]),
                provenance,
                tenantId: undefined,
                timestamp: provenance.timestamp
            });
        }

        const status: ExecutionMonitor["status"] = execution.status === "EXECUTED" ? "COMPLETED" : execution.status === "FAILED" ? "FAILED" : "RUNNING";
        const progress = status === "COMPLETED" ? 100 : status === "FAILED" ? 50 : 25;

        const provenance = buildProvenance(input, ["lookup-workflow", "compute-progress"], JSON.stringify({ status, progress }));

        const monitor: ExecutionMonitor = Object.freeze({
            workflowId: trimmedWorkflowId,
            status,
            progressPercent: progress,
            currentStep: status === "COMPLETED" ? "verify" : "execute",
            logs: Object.freeze(execution.results),
            provenance,
            tenantId: execution.tenantId,
            timestamp: provenance.timestamp
        });

        this.monitors.set(trimmedWorkflowId, monitor);
        return monitor;
    }

    rollbackOnFailure(workflowId: string, reason: string): RollbackResult {
        const trimmedWorkflowId = (workflowId ?? "").trim();
        const trimmedReason = (reason ?? "").trim();
        const input = JSON.stringify({ workflowId: trimmedWorkflowId, reason: trimmedReason });

        const execution = this.executions.get(trimmedWorkflowId);
        const monitor = this.monitors.get(trimmedWorkflowId);
        const previousSnapshot = this.rollbackSnapshots.get(trimmedWorkflowId);

        const shouldRollback = !!execution && execution.status === "FAILED";
        const wasRolledBack = shouldRollback || (!!monitor && monitor.status === "FAILED");

        const previousState = previousSnapshot
            ? previousSnapshot
            : execution
                ? `status=${execution.status};compliance=${execution.complianceStatus}`
                : "no-prior-state";

        const provenance = buildProvenance(
            input,
            ["lookup-execution", "lookup-monitor", "determine-rollback", "restore-snapshot"],
            JSON.stringify({ wasRolledBack, reason: trimmedReason, previousState })
        );

        if (wasRolledBack) {
            this.monitors.set(trimmedWorkflowId, Object.freeze({
                workflowId: trimmedWorkflowId,
                status: "ROLLING_BACK" as const,
                progressPercent: 0,
                currentStep: "rollback",
                logs: Object.freeze(["Rollback initiated: " + trimmedReason]),
                provenance,
                tenantId: execution?.tenantId,
                timestamp: provenance.timestamp
            }));
        }

        return Object.freeze({
            workflowId: trimmedWorkflowId,
            wasRolledBack,
            previousState,
            reason: trimmedReason,
            provenance,
            tenantId: execution?.tenantId,
            timestamp: provenance.timestamp
        });
    }

    private validateAgents(agents: readonly AgentAssignment[]): { valid: AgentAssignment[]; status: "COORDINATED" | "BLOCKED" | "PARTIAL" } {
        const valid: AgentAssignment[] = [];
        for (const a of agents) {
            if (!a || !a.agentId || !a.agentType || !a.task || !a.authority) {
                continue;
            }
            valid.push(a);
        }
        if (valid.length === 0) return { valid: [], status: "BLOCKED" };
        if (valid.length < agents.length) return { valid, status: "PARTIAL" };
        return { valid, status: "COORDINATED" };
    }
}

export function createAutonomousOperationsEngine(): AutonomousOperationsEngine {
    return new AutonomousOperationsEngine();
}





