export interface KnotCheckpoint {
    capabilityId: string;
    commit: string;
}

export interface KnotExecutionObservation {
    capabilityId: string;
    executionOk: boolean;
    verificationComplete: boolean;
    repositoryChanged: boolean;
}

export interface KnotRecoveryDecision {
    recover: boolean;
    action: "REPAIR" | "ADVANCE";
    checkpoint: KnotCheckpoint;
    rationale: string;
    repairCapabilityId?: string;
    stopConditions: string[];
}

/**
 * Decides whether the current knot is safe to advance or must be re-woven.
 *
 * A knot is never considered correct merely because generation succeeded.
 * Execution, verification and repository evidence must all agree before the
 * next canonical knot is allowed to start.
 */
export class AutonomousKnotRecovery {
    observe(checkpoint: KnotCheckpoint, observation: KnotExecutionObservation): KnotRecoveryDecision {
        if (observation.executionOk && observation.verificationComplete && observation.repositoryChanged) {
            return {
                recover: false,
                action: "ADVANCE",
                checkpoint,
                rationale: "knot execution, verification and repository evidence agree; advance to the next knot",
                stopConditions: [
                    "new verification failure",
                    "checkpoint evidence becomes inconsistent",
                    "unexpected capability owner appears"
                ]
            };
        }

        return {
            recover: true,
            action: "REPAIR",
            checkpoint,
            rationale: "current knot is not trusted; return to the last verified checkpoint and re-weave this knot before continuing",
            repairCapabilityId: `repair-${checkpoint.capabilityId}`,
            stopConditions: [
                "repair verification fails",
                "checkpoint cannot be established",
                "repository remains inconsistent after repair",
                "repair would cross an architecture ownership boundary"
            ]
        };
    }
}
