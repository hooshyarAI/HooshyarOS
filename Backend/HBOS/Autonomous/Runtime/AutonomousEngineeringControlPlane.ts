export type EngineeringFailureKind =
    | "BUILD"
    | "TEST"
    | "RUNTIME"
    | "INTEGRATION"
    | "SECURITY"
    | "PERSISTENCE"
    | "EVIDENCE"
    | "PROCESS";

export type EngineeringAction =
    | "REPAIR_PROCESS"
    | "REPAIR_CAPABILITY"
    | "REBUILD_CANONICAL_PATH"
    | "VERIFY_EXTERNAL_DEPENDENCY"
    | "BLOCK_AND_PRESERVE";

export interface EngineeringFailure {
    id: string;
    kind: EngineeringFailureKind;
    severity: number;
    businessImpact: number;
    recurrence: number;
    recoverability: number;
    observed: boolean;
    postconditionMissing?: boolean;
    evidenceContradictory?: boolean;
    externalDependency?: boolean;
    canonicalPathBroken?: boolean;
}

export interface EngineeringWorkItem {
    failureId: string;
    priority: number;
    action: EngineeringAction;
    reason: string;
}

export interface EngineeringCycleResult {
    status: "CONTINUE" | "BLOCKED";
    work: EngineeringWorkItem[];
    next: EngineeringWorkItem | null;
}

/**
 * Canonical decision boundary for autonomous construction/repair.
 * It deliberately does not implement a second builder: it selects the
 * existing platform capability/tool/engine that owns the work.
 */
export class AutonomousEngineeringControlPlane {
    plan(failures: EngineeringFailure[]): EngineeringCycleResult {
        const work = failures
            .map(failure => this.toWorkItem(failure))
            .sort((a, b) => b.priority - a.priority || a.failureId.localeCompare(b.failureId));

        const blocked = work.some(item => item.action === "BLOCK_AND_PRESERVE");
        return {
            status: blocked ? "BLOCKED" : "CONTINUE",
            work,
            next: work[0] ?? null,
        };
    }

    private toWorkItem(failure: EngineeringFailure): EngineeringWorkItem {
        const priority =
            failure.severity * 5 +
            failure.businessImpact * 4 +
            failure.recurrence * 2 +
            failure.recoverability;

        if (!failure.observed || failure.postconditionMissing || failure.evidenceContradictory) {
            return {
                failureId: failure.id,
                priority: priority + 100,
                action: "BLOCK_AND_PRESERVE",
                reason: "Required execution evidence or postcondition is missing/contradictory.",
            };
        }

        if (failure.externalDependency) {
            return {
                failureId: failure.id,
                priority: priority + 90,
                action: "VERIFY_EXTERNAL_DEPENDENCY",
                reason: "External dependency must be verified or explicitly preserved as blocked.",
            };
        }

        if (failure.kind === "PROCESS" || failure.kind === "EVIDENCE") {
            return {
                failureId: failure.id,
                priority: priority + 80,
                action: "REPAIR_PROCESS",
                reason: "Construction/verification fabric is the failure owner and must be repaired first.",
            };
        }

        if (failure.canonicalPathBroken) {
            return {
                failureId: failure.id,
                priority: priority + 70,
                action: "REBUILD_CANONICAL_PATH",
                reason: "The canonical ownership/product path is broken; dependent work must not continue on a duplicate path.",
            };
        }

        return {
            failureId: failure.id,
            priority,
            action: "REPAIR_CAPABILITY",
            reason: "Repair the owning capability through its existing Engine/tool boundary, then independently re-verify it.",
        };
    }
}
