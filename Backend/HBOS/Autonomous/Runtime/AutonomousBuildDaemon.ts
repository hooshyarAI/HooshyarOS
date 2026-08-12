import { existsSync } from "node:fs";
import { join } from "node:path";
import { AutonomousDevelopmentLoop, AutonomousDevelopmentResult } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousProjectMission, Mission } from "./AutonomousProjectMission";
import { AutonomousPlatformContinuation, PlatformCapabilityMission, PlatformContinuationMission } from "./AutonomousPlatformContinuation";
import { CapabilityEvidenceAudit } from "./CapabilityEvidenceAudit";
import { CanonicalCapabilityAudit } from "./CanonicalCapabilityAudit";
import { CommercialProductCompletionAudit } from "./CommercialProductCompletionAudit";
import { AutonomousWeavingPlanner } from "./AutonomousWeavingPlanner";
import { AutonomousKnotRecovery } from "./AutonomousKnotRecovery";
import { createLocalConstructionTools } from "./LocalConstructionToolset";
import { AutonomousPerformanceBudget } from "./AutonomousPerformanceBudget";

export interface DaemonOptions {
    root?: string;
    maxCycles?: number;
    reportEvery?: number;
    performanceBudget?: AutonomousPerformanceBudget;
    mission?: AutonomousProjectMission;
    continuation?: AutonomousPlatformContinuation;
    development?: AutonomousDevelopmentLoop;
}

type MissionDecision =
    | { kind: "mission"; mission: Mission; assistantGatePassed: false; continuation?: undefined }
    | { kind: "platform-continuation"; mission: PlatformCapabilityMission; assistantGatePassed: true; continuation: PlatformContinuationMission }
    | { kind: "platform-complete"; mission: Mission; assistantGatePassed: true; continuation: PlatformContinuationMission; canonicalAudit: ReturnType<CanonicalCapabilityAudit["audit"]>; commercialAudit: ReturnType<CommercialProductCompletionAudit["audit"]> }
    | { kind: "platform-audit-blocked"; mission: Mission; assistantGatePassed: true; continuation: PlatformContinuationMission; reason: string; details: unknown };

export class AutonomousBuildDaemon {
    private readonly root: string;
    private readonly mission: AutonomousProjectMission;
    private readonly continuation: AutonomousPlatformContinuation;
    private readonly development: AutonomousDevelopmentLoop;
    private readonly evidenceAudit = new CapabilityEvidenceAudit();
    private readonly canonicalAudit = new CanonicalCapabilityAudit();
    private readonly commercialAudit = new CommercialProductCompletionAudit();
    private readonly weavingPlanner = new AutonomousWeavingPlanner();
    private readonly knotRecovery = new AutonomousKnotRecovery();
    private readonly maxCycles: number;
    private readonly reportEvery: number;
    private readonly performanceBudget: AutonomousPerformanceBudget;

    constructor(options: DaemonOptions = {}) {
        this.root = options.root || process.cwd();
        this.mission = options.mission ?? new AutonomousProjectMission(this.root);
        this.continuation = options.continuation ?? new AutonomousPlatformContinuation();
        this.development = options.development ?? new AutonomousDevelopmentLoop(createLocalConstructionTools(this.root));
        this.maxCycles = options.maxCycles ?? 1000;
        this.reportEvery = options.reportEvery ?? 1;
        this.performanceBudget = options.performanceBudget ?? new AutonomousPerformanceBudget({
            statePath: join(this.root, ".git", "hooshyar-autonomous-performance.json")
        });
    }

    private finalCompletionEvidence(selected: Mission): ReturnType<CapabilityEvidenceAudit["evaluate"]> {
        const root = selected.evidence?.root || this.root;
        const exists = (path: string) => existsSync(join(root, path));
        const implementationPaths = [
            "Backend/HBOS/Assistant/Autonomous/AutonomousAssistantRuntime.ts",
            "Backend/HBOS/Assistant/Autonomous/AutonomousMissionController.ts",
            "Backend/HBOS/Assistant/Autonomous/HooshyarAutonomousAssistant.ts",
            "Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts",
            "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts",
            "Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts",
            "Backend/HBOS/Builder/Autonomous/ArchitectureDrivenBuildController.ts",
            "Backend/HBOS/Builder/Autonomous/AutonomousConstructionEngine.ts",
            "Backend/AI_Runtime/autonomous_builder.py",
            "Backend/AI_Runtime/reasoning/reasoning_engine.py"
        ];
        const testPaths = [
            "Backend/HBOS/test/AutonomousMissionController.test.ts",
            "Backend/HBOS/test/AutonomousAssistantRuntime.test.ts",
            "Backend/HBOS/test/HooshyarAutonomousAssistant.test.ts",
            "Backend/HBOS/test/PythonReasoningAdapter.test.ts"
        ];
        const documentationPaths = ["AGENTS.md", "Assistant/SYSTEM_PROMPT.md"];
        const dependencyPaths = [
            "Backend/HBOS/Engines/MemoryEngine.ts",
            "Backend/HBOS/Engines/KnowledgeEngine.ts",
            "Backend/HBOS/Engines/DecisionEngine.ts",
            "Backend/HBOS/Engines/GovernanceEngine.ts"
        ];
        const implementation = implementationPaths.every(exists);
        const test = testPaths.every(exists);
        const documentation = documentationPaths.every(exists);
        const dependenciesSatisfied = dependencyPaths.every(exists);
        const verified = test && selected.evidence.clean && selected.evidence.commit.length > 0;

        return this.evidenceAudit.evaluate({ implementation, test, documentation, dependenciesSatisfied, verified });
    }

    private selectMission(): MissionDecision {
        const selected = this.mission.nextMission();
        if (selected.capabilityId !== "assistant.completion.gate") return { kind: "mission", mission: selected, assistantGatePassed: false };

        const continuation = this.continuation.createMission();
        const nextPlatformMission = this.continuation.selectNextCapability(this.mission);
        if (nextPlatformMission) return { kind: "platform-continuation", mission: nextPlatformMission, assistantGatePassed: true, continuation };

        const finalEvidence = this.finalCompletionEvidence(selected);
        if (!finalEvidence.complete) {
            return {
                kind: "mission",
                mission: { ...selected, capabilityId: "assistant.completion.evidence", capability: `complete missing final completion evidence: ${finalEvidence.missing.join(", ")}` },
                assistantGatePassed: false
            };
        }

        const canonicalAudit = this.canonicalAudit.audit(this.root, this.mission);
        if (!canonicalAudit.complete) {
            return {
                kind: "platform-audit-blocked",
                mission: selected,
                assistantGatePassed: true,
                continuation,
                reason: canonicalAudit.missingArtifacts.length > 0 ? "CANONICAL_CAPABILITY_AUDIT_MISSING_ARTIFACTS" : canonicalAudit.roadmapPresent ? "CANONICAL_CAPABILITY_AUDIT_BACKLOG_NOT_EXHAUSTED" : "CANONICAL_CAPABILITY_AUDIT_ROADMAP_MISSING",
                details: canonicalAudit
            };
        }

        const commercialAudit = this.commercialAudit.audit(this.root);
        if (!commercialAudit.complete) {
            return {
                kind: "platform-audit-blocked",
                mission: selected,
                assistantGatePassed: true,
                continuation,
                reason: "COMMERCIAL_PRODUCT_AUDIT_MISSING_LAYERS",
                details: commercialAudit
            };
        }

        return { kind: "platform-complete", mission: selected, assistantGatePassed: true, continuation, canonicalAudit, commercialAudit };
    }

    run() {
        const history: unknown[] = [];
        for (let cycle = 1; cycle <= this.maxCycles; cycle += 1) {
            const cycleStartedAt = this.performanceBudget.beginCycle();
            let budgetSnapshot;
            try {
                budgetSnapshot = this.performanceBudget.assertWithinDeadline();
            } catch (error) {
                const result = { status: "blocked", cycles: cycle - 1, history, reason: String(error) };
                console.log(JSON.stringify({ type: "AUTONOMOUS_PERFORMANCE_BUDGET_EXCEEDED", cycle, ...this.performanceBudget.snapshot(), error: String(error) }));
                return result;
            }

            const before = this.mission.snapshot();
            const decision = this.selectMission();
            if (decision.kind === "platform-complete") {
                budgetSnapshot = this.performanceBudget.completeCycle(cycleStartedAt);
                const productComplete = decision.canonicalAudit.complete && decision.commercialAudit.complete;
                console.log(JSON.stringify({ type: "AUTONOMOUS_PLATFORM_CONSTRUCTION_COMPLETE", cycle, status: "completed", assistantComplete: true, autonomousConstructionComplete: true, canonicalPlatformConstructionComplete: decision.canonicalAudit.complete, commercialProductRuntimeComplete: decision.commercialAudit.complete, externalProductionDependenciesComplete: decision.commercialAudit.blockedExternalDependencies.length === 0, productComplete, backlogExhausted: decision.canonicalAudit.backlogExhausted, nonAutonomousProductionItems: decision.canonicalAudit.nonAutonomousProductionItems, commercialMissingLayers: decision.commercialAudit.missingLayers, blockedExternalDependencies: decision.commercialAudit.blockedExternalDependencies, continuation: decision.continuation, performance: budgetSnapshot, message: "Assistant and canonical construction are complete; commercial product completion is derived from independent application-level evidence." }));
                return { status: "completed", cycles: cycle, history };
            }
            if (decision.kind === "platform-audit-blocked") {
                budgetSnapshot = this.performanceBudget.completeCycle(cycleStartedAt);
                const result = { goal: { capabilityId: "platform.continuation.audit", capability: decision.reason, targetEngine: "Autonomous Operations Engine", dependencies: [] }, result: { ok: false, status: "BLOCKED", attempts: 0, selectedTool: "audit", issues: [decision.reason], trace: ["ARCHITECTURE", "AUDIT", "FINALIZE"], details: JSON.stringify(decision.details), stage: "FINALIZE" }, status: "blocked" };
                console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, performance: budgetSnapshot, result }));
                return { status: "blocked", cycles: cycle, history: [...history, { cycle, audit: decision.details, status: "blocked", performance: budgetSnapshot }] };
            }

            const mission = decision.mission;
            const weavingPlan = this.weavingPlanner.plan(mission, before.clean);
            console.log(JSON.stringify({ type: "AUTONOMOUS_WEAVING_PLAN", cycle, plan: weavingPlan, performance: budgetSnapshot }));
            if (!weavingPlan.safe) {
                budgetSnapshot = this.performanceBudget.completeCycle(cycleStartedAt);
                const blocked = { goal: { capabilityId: weavingPlan.capabilityId, capability: mission.capability, targetEngine: mission.targetEngine, dependencies: mission.dependencies }, result: { ok: false, status: "BLOCKED", attempts: 0, selectedTool: "weaving-planner", issues: ["WEAVING_PRECONDITION_FAILED"], trace: ["ARCHITECTURE", "PLAN"], details: weavingPlan.rationale, stage: "PLAN" }, status: "blocked" };
                console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, performance: budgetSnapshot, result: blocked }));
                return { status: "blocked", cycles: cycle, history: [...history, { cycle, weavingPlan, status: "blocked", performance: budgetSnapshot }] };
            }

            if (decision.kind === "platform-continuation") console.log(JSON.stringify({ type: "AUTONOMOUS_PLATFORM_CONTINUATION", cycle, continuation: decision.continuation, mission }));
            console.log(JSON.stringify({ type: "AUTONOMOUS_MISSION", cycle, commit: before.commit, capability: mission.capability, targetEngine: mission.targetEngine }));

            const goal = { capabilityId: mission.capabilityId, capability: mission.capability, targetEngine: mission.targetEngine, dependencies: mission.dependencies };
            let result: AutonomousDevelopmentResult = this.development.execute(goal);
            history.push({ cycle, commit: before.commit, mission: mission.capability, capabilityId: mission.capabilityId, targetEngine: mission.targetEngine, assistantGatePassed: decision.assistantGatePassed, handoff: decision.kind === "platform-continuation" ? decision.continuation : undefined, weavingPlan, result });

            if (!result.result.ok) {
                const recovery = this.knotRecovery.observe({ capabilityId: mission.capabilityId, commit: before.commit }, { capabilityId: mission.capabilityId, executionOk: false, verificationComplete: false, repositoryChanged: false });
                console.log(JSON.stringify({ type: "AUTONOMOUS_REWEAVE", cycle, recovery }));
                try {
                    this.knotRecovery.rollback(this.root, recovery.checkpoint);
                    console.log(JSON.stringify({ type: "AUTONOMOUS_ROLLBACK", cycle, checkpoint: recovery.checkpoint.commit, capabilityId: mission.capabilityId }));
                } catch (error) {
                    const blocked = { status: "BLOCKED", stage: "RECOVERY", issues: ["CHECKPOINT_ROLLBACK_FAILED"], checkpoint: recovery.checkpoint.commit, error: String(error) };
                    budgetSnapshot = this.performanceBudget.completeCycle(cycleStartedAt);
                    console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, performance: budgetSnapshot, result: blocked }));
                    return { status: "blocked", cycles: cycle, history: [...history, { cycle, recovery, status: "blocked", result: blocked, performance: budgetSnapshot }] };
                }
                const repairGoal = { capabilityId: recovery.repairCapabilityId!, capability: `repair and re-verify knot ${mission.capabilityId} from checkpoint ${before.commit}`, targetEngine: mission.targetEngine, dependencies: mission.dependencies };
                const repairResult = this.development.execute(repairGoal);
                history.push({ cycle, recovery, repairGoal, repairResult });
                if (!repairResult.result.ok) {
                    budgetSnapshot = this.performanceBudget.completeCycle(cycleStartedAt);
                    console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, performance: budgetSnapshot, result: repairResult }));
                    return { status: "blocked", cycles: cycle, history };
                }
                result = repairResult;
                const repaired = this.mission.snapshot();
                if (repaired.commit === before.commit && !result.result.idempotent) {
                    budgetSnapshot = this.performanceBudget.completeCycle(cycleStartedAt);
                    const blocked = { status: "BLOCKED", stage: "VERIFY", issues: ["REWEAVE_DID_NOT_PRODUCE_VERIFIED_REPOSITORY_CHANGE"], checkpoint: before.commit, current: repaired.commit };
                    console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, performance: budgetSnapshot, result: blocked }));
                    return { status: "blocked", cycles: cycle, history };
                }
                if (!repaired.clean) {
                    budgetSnapshot = this.performanceBudget.completeCycle(cycleStartedAt);
                    const blocked = { status: "BLOCKED", stage: "VERIFY", issues: ["REWEAVE_LEFT_WORKING_TREE_DIRTY"], checkpoint: before.commit, current: repaired.commit };
                    console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, performance: budgetSnapshot, result: blocked }));
                    return { status: "blocked", cycles: cycle, history };
                }
            }

            const after = this.mission.snapshot();
            const knotObservation = this.knotRecovery.observe({ capabilityId: mission.capabilityId, commit: before.commit }, { capabilityId: mission.capabilityId, executionOk: result.result.ok, verificationComplete: result.result.ok && result.result.stage === "FINALIZE", repositoryChanged: result.result.idempotent ? true : after.commit !== before.commit && after.clean });
            console.log(JSON.stringify({ type: "AUTONOMOUS_KNOT_CHECK", cycle, recovery: knotObservation }));
            if (knotObservation.recover) {
                budgetSnapshot = this.performanceBudget.completeCycle(cycleStartedAt);
                const blocked = { status: "BLOCKED", stage: "VERIFY", issues: ["KNOT_NOT_VERIFIED"], checkpoint: before.commit, recovery: knotObservation };
                const current = history[history.length - 1] as Record<string, unknown>;
                current.performance = budgetSnapshot;
                console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, performance: budgetSnapshot, result: blocked }));
                return { status: "blocked", cycles: cycle, history };
            }
            budgetSnapshot = this.performanceBudget.completeCycle(cycleStartedAt);
            const current = history[history.length - 1] as Record<string, unknown>;
            if (current) current.performance = budgetSnapshot;
            if (after.commit === before.commit && after.clean && !result.result.idempotent && cycle < this.maxCycles) {
                console.log(JSON.stringify({ type: "AUTONOMOUS_IDLE", cycle, commit: after.commit, capability: mission.capability, performance: budgetSnapshot, message: "No repository change was produced; refusing to advance as completed." }));
                return { status: "idle", cycles: cycle, history };
            }
            if (result.result.idempotent) {
                console.log(JSON.stringify({ type: "AUTONOMOUS_IDEMPOTENT_ADVANCE", cycle, capabilityId: mission.capabilityId, capability: mission.capability, commit: after.commit, status: result.status, message: "Capability already existed, passed verification, and is accepted without synthetic repository mutation." }));
            }
            if (cycle % this.reportEvery === 0) console.log(JSON.stringify({ type: "AUTONOMOUS_PROGRESS", cycle, latestCommit: after.commit, status: result.status, assistantGatePassed: decision.assistantGatePassed, idempotent: result.result.idempotent === true, performance: budgetSnapshot }));
        }
        console.log(JSON.stringify({ type: "AUTONOMOUS_CYCLE_LIMIT", cycles: this.maxCycles, performance: this.performanceBudget.snapshot() }));
        return { status: "cycle_limit", cycles: this.maxCycles, history };
    }
}

if (require.main === module) {
    const result = new AutonomousBuildDaemon().run();
    process.exitCode = result.status === "blocked" ? 1 : 0;
}
