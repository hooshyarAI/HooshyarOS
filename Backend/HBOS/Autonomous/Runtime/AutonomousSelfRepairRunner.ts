import { AutonomousDevelopmentLoop, AutonomousDevelopmentResult } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousKnotRecovery, KnotCheckpoint } from "./AutonomousKnotRecovery";
import { FailureInput, RepairStrategy, SelfRepairCapability } from "../../Assistant/Autonomous/SelfRepairCapability";
import { RepairStrategyKind } from "../../Assistant/Autonomous/SelfRepairStrategyPlanner";

export interface SelfRepairRunnerContext {
    root: string;
    checkpoint: KnotCheckpoint;
    missionCapabilityId: string;
    targetEngine: string;
    dependencies: string[];
    repairDescription: string;
    failures: string[];
    development: AutonomousDevelopmentLoop;
    recovery: AutonomousKnotRecovery;
    snapshot: () => { commit: string; clean: boolean };
}

export interface SelfRepairRunnerResult {
    repairCase: ReturnType<SelfRepairCapability["repair"]>;
    developmentResult?: AutonomousDevelopmentResult;
}

/** Bridges the governed self-repair capability to real autonomous construction execution. */
export class AutonomousSelfRepairRunner {
    run(context: SelfRepairRunnerContext): SelfRepairRunnerResult {
        let lastResult: AutonomousDevelopmentResult | undefined;
        const failure: FailureInput = {
            id: context.missionCapabilityId,
            message: context.failures.join(" | ") || context.repairDescription,
            evidence: context.failures,
            architectureBoundary: context.targetEngine
        };
        const strategies = this.createStrategies(context, result => { lastResult = result; });
        const capability = new SelfRepairCapability(strategies);
        const repairCase = capability.repair(failure);
        return { repairCase, developmentResult: lastResult };
    }

    private createStrategies(context: SelfRepairRunnerContext, recordResult: (result: AutonomousDevelopmentResult) => void): RepairStrategy[] {
        const make = (kind: RepairStrategyKind, description: string, risk: number, fit: number, reversibility: number): RepairStrategy => ({
            id: kind,
            description,
            categories: ["BUILD", "TEST", "DEPENDENCY", "RUNTIME", "PRODUCTIZATION", "RELEASE", "ARCHITECTURE", "UNKNOWN"],
            risk,
            reversibility,
            architecturalFit: fit,
            externalDependency: kind === "DEPENDENCY_PROVISIONING",
            strategyKind: kind,
            execute: () => {
                context.recovery.rollback(context.root, context.checkpoint);
                const before = context.snapshot();
                const goal = {
                    capabilityId: `repair-${context.missionCapabilityId}`,
                    capability: `${description}\n\nMISSION: ${context.missionCapabilityId}\nCHECKPOINT: ${context.checkpoint.commit}\nROOT FAILURE:\n${context.repairDescription}`,
                    targetEngine: context.targetEngine,
                    dependencies: context.dependencies
                };
                const result = context.development.execute(goal);

                if (!result || !result.result) {
                    const after = context.snapshot();
                    return {
                        ok: false,
                        evidence: [
                            `STRATEGY=${kind}`,
                            "RESULT_STATUS=INVALID_EXECUTION_RESULT",
                            "RESULT_STAGE=UNKNOWN",
                            "REPOSITORY_CHANGED=false",
                            `WORKTREE_CLEAN=${after.clean}`,
                            "SELF_REPAIR_EXECUTION_RETURNED_NO_RESULT"
                        ],
                        verificationPassed: false,
                        repositoryChanged: false,
                        idempotent: false
                    };
                }

                const after = context.snapshot();
                recordResult(result);
                const changed = before.commit !== after.commit || result.result.idempotent === true;
                return {
                    ok: result.result.ok,
                    evidence: [
                        `STRATEGY=${kind}`,
                        `RESULT_STATUS=${result.status}`,
                        `RESULT_STAGE=${result.result.stage}`,
                        `REPOSITORY_CHANGED=${changed}`,
                        `WORKTREE_CLEAN=${after.clean}`,
                        ...(result.result.issues ?? [])
                    ],
                    verificationPassed: result.result.ok && result.result.stage === "FINALIZE" && after.clean,
                    repositoryChanged: changed,
                    idempotent: result.result.idempotent === true
                };
            }
        });

        return [
            make("FOCUSED_CANONICAL_REPAIR", "Perform the smallest canonical repair consistent with the diagnosed failure and existing architecture.", 2, 10, 10),
            make("ARCHITECTURAL_REPAIR", "Repair the failure at its architectural contract boundary without changing unrelated capabilities.", 4, 9, 8),
            make("DEPENDENCY_PROVISIONING", "Resolve the required dependency or toolchain through the governed provisioning boundary.", 5, 8, 7),
            make("ISOLATION_OR_FALLBACK", "Isolate the failing external path or activate a governed fallback while preserving the canonical contract.", 6, 8, 7),
            make("DEEPER_REDESIGN", "Reassess the repair strategy and redesign only the failing construction path when prior strategies are exhausted.", 8, 8, 5)
        ];
    }
}
