import { SelfRepairGovernance } from "./SelfRepairGovernance";
import { RepairDepth, RepairStrategyKind, SelfRepairPlan, SelfRepairStrategyPlanner } from "./SelfRepairStrategyPlanner";

export type SelfRepairOutcome = "FIXED" | "RETRY_WITH_NEW_STRATEGY" | "ESCALATE_TO_DEEPER_ANALYSIS" | "BLOCKED_WITH_PROOF";
export type FailureClass = "BUILD" | "TEST" | "DEPENDENCY" | "RUNTIME" | "PRODUCTIZATION" | "RELEASE" | "ARCHITECTURE" | "UNKNOWN";
export interface FailureInput { id: string; message: string; command?: string; evidence?: string[]; category?: FailureClass; architectureBoundary?: string; }
export interface RepairStrategy { id: string; description: string; categories: FailureClass[]; risk: number; reversibility: number; architecturalFit: number; externalDependency: boolean; strategyKind?: RepairStrategyKind; execute: (failure: FailureInput) => RepairExecution; }
export interface RepairExecution { ok: boolean; evidence: string[]; verificationPassed: boolean; repositoryChanged: boolean; environmentChanged?: boolean; idempotent?: boolean; externalBoundary?: string; }
export interface RepairDecision { strategyId: string; rationale: string; score: number; }
export interface RepairCase { capabilityId: "assistant.autonomous.self-repair"; failure: FailureInput; classification: FailureClass; repairDepth: RepairDepth; repairPlan: SelfRepairPlan; candidateStrategies: string[]; decision?: RepairDecision; attempts: string[]; evidence: string[]; outcome: SelfRepairOutcome; blockedProof?: string[]; }
export interface SelfRepairMemory { get(failureId: string): RepairCase | undefined; set(failureId: string, repairCase: RepairCase): void; }
class InMemorySelfRepairMemory implements SelfRepairMemory { private readonly cases = new Map<string, RepairCase>(); get(failureId: string): RepairCase | undefined { return this.cases.get(failureId); } set(failureId: string, repairCase: RepairCase): void { this.cases.set(failureId, repairCase); } }

/** Canonical self-repair boundary. Execution is governed by proportional strategy, evidence, policy and a finite failure budget. */
export class SelfRepairCapability {
    readonly id = "assistant.autonomous.self-repair" as const;
    private readonly strategyPlanner = new SelfRepairStrategyPlanner();
    constructor(private readonly strategies: RepairStrategy[] = [], private readonly memory: SelfRepairMemory = new InMemorySelfRepairMemory(), private readonly maxAttempts = 5, private readonly governance = new SelfRepairGovernance()) {}

    repair(failure: FailureInput): RepairCase {
        const classification = this.classify(failure);
        const previous = this.memory.get(failure.id);
        const previousKinds = (previous?.attempts ?? []).map(id => this.strategies.find(strategy => strategy.id === id)?.strategyKind).filter((kind): kind is RepairStrategyKind => Boolean(kind));
        const cluster = { id: `failure-${failure.id}`, rootCause: classification, repairCapabilityId: `repair-${failure.id}`, priority: 1, evidence: failure.evidence ?? [failure.message], rationale: `Failure classified as ${classification}; proportional repair depth is derived before strategy execution.` };
        const repairPlan = this.strategyPlanner.plan(cluster, [failure.message, ...(failure.evidence ?? [])], previousKinds);
        const eligible = this.strategies.filter(strategy => strategy.categories.includes(classification) || strategy.categories.includes("UNKNOWN")).filter(strategy => !(previous?.attempts.includes(strategy.id) ?? false));
        const repairCase: RepairCase = { capabilityId: this.id, failure, classification, repairDepth: repairPlan.depth, repairPlan, candidateStrategies: eligible.map(strategy => strategy.id), attempts: [...(previous?.attempts ?? [])], evidence: [...(previous?.evidence ?? []), ...(failure.evidence ?? [])], outcome: "ESCALATE_TO_DEEPER_ANALYSIS" };
        if (eligible.length === 0 || repairCase.attempts.length >= this.maxAttempts) return this.block(repairCase, ["No unused autonomous repair strategy is available within the failure budget.", "Manual repair is forbidden before an autonomous boundary is proven."]);

        while (eligible.length > 0 && repairCase.attempts.length < this.maxAttempts) {
            const strategy = this.choose(eligible, repairPlan.strategy);
            const governance = this.governance.authorizeRepair(failure, strategy);
            if (!governance.allowed) { repairCase.evidence.push(`GOVERNANCE_BLOCK: ${governance.reason}`); eligible.splice(eligible.indexOf(strategy), 1); continue; }
            repairCase.decision = { strategyId: strategy.id, rationale: `${governance.reason}; proportional plan=${repairPlan.strategy}/${repairPlan.depth}; selected by architectural fit, reversibility and risk.`, score: this.score(strategy, repairPlan.strategy) };
            repairCase.attempts.push(strategy.id);
            const execution = strategy.execute(failure);
            repairCase.evidence.push(...execution.evidence);
            if (execution.externalBoundary) repairCase.evidence.push(`EXTERNAL_BOUNDARY: ${execution.externalBoundary}`);
            const stateChanged = execution.repositoryChanged || execution.environmentChanged || execution.idempotent;
            if (execution.ok && execution.verificationPassed && stateChanged) { repairCase.outcome = "FIXED"; this.memory.set(failure.id, repairCase); return repairCase; }
            eligible.splice(eligible.indexOf(strategy), 1);
            if (eligible.length > 0 && repairCase.attempts.length < this.maxAttempts) repairCase.outcome = "RETRY_WITH_NEW_STRATEGY";
        }
        return this.block(repairCase, [`Failure budget exhausted or all autonomous strategies failed: ${repairCase.attempts.join(", ") || "none"}.`, "Every attempt required execution evidence and verification evidence.", "A failed strategy cannot be repeated without materially new evidence.", "Manual intervention is allowed only after this proof is persisted as an external boundary."]);
    }

    recall(failureId: string): RepairCase | undefined { return this.memory.get(failureId); }
    private classify(failure: FailureInput): FailureClass { if (failure.category) return failure.category; const text = `${failure.message} ${failure.command ?? ""}`.toLowerCase(); if (/android.*(sdk|gradle)|gradle|jdk|npm|package|dependency|toolchain/.test(text)) return "DEPENDENCY"; if (/test|jest|assert|snapshot/.test(text)) return "TEST"; if (/build|compile|tsc|webpack/.test(text)) return "BUILD"; if (/productization|exe|installer|artifact|apk/.test(text)) return "PRODUCTIZATION"; if (/release|publish|deploy/.test(text)) return "RELEASE"; if (/runtime|process|daemon/.test(text)) return "RUNTIME"; if (/architecture|freeze|boundary|contract/.test(text)) return "ARCHITECTURE"; return "UNKNOWN"; }
    private choose(strategies: RepairStrategy[], preferred: RepairStrategyKind): RepairStrategy { return [...strategies].sort((a, b) => this.score(b, preferred) - this.score(a, preferred))[0]; }
    private score(strategy: RepairStrategy, preferred: RepairStrategyKind): number { const externalPenalty = strategy.externalDependency ? 20 : 0; const proportionalBonus = strategy.strategyKind === preferred ? 50 : 0; return proportionalBonus + strategy.architecturalFit * 4 + strategy.reversibility * 3 - strategy.risk * 2 - externalPenalty; }
    private block(repairCase: RepairCase, proof: string[]): RepairCase { repairCase.outcome = "BLOCKED_WITH_PROOF"; const boundaryProof = repairCase.evidence.filter(item => /EXTERNAL_BOUNDARY/i.test(item)); repairCase.blockedProof = [`ROOT_CAUSE_CLASS: ${repairCase.classification}`, `REPAIR_DEPTH: ${repairCase.repairDepth}`, `SELECTED_STRATEGY: ${repairCase.repairPlan.strategy}`, `FAILURE: ${repairCase.failure.message}`, `ATTEMPTS: ${repairCase.attempts.join(", ") || "none"}`, ...boundaryProof, ...proof]; this.memory.set(repairCase.failure.id, repairCase); return repairCase; }
}
