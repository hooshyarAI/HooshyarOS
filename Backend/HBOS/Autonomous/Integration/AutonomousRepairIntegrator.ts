import { AutonomousRepairEngine, RepairPlan } from "../RepairEngine/AutonomousRepairEngine";
import { ProcessAPRVLRepairAdapter, APRVLRepairAdapter, APRVLRepairEvidence } from "./APRVLRepairAdapter";
import { SelfHealingOrchestrator, RepairAuthorization } from "../Orchestrator/SelfHealingOrchestrator";
import { AuthorizedRepairAction, ControlledRepairCapability, ControlledRepairEvidence } from "../Repair/ControlledRepairCapability";

export interface RepairFailureContext {
    capabilityId?: string;
    authorization?: RepairAuthorization;
    action?: Omit<AuthorizedRepairAction, "authorizationToken">;
}

export interface CanonicalRepairExecutionResult {
    repaired: boolean;
    plan: RepairPlan;
    aprvl: APRVLRepairEvidence;
    repair?: ControlledRepairEvidence;
    reason?: string;
}

/** Canonical handoff from repair planning to the platform's APRVL + controlled-repair path. */
export class AutonomousRepairIntegrator {
    private readonly planning = new AutonomousRepairEngine();
    private readonly healing: SelfHealingOrchestrator;

    constructor(
        root = process.cwd(),
        aprvl: APRVLRepairAdapter = new ProcessAPRVLRepairAdapter(),
        capability: ControlledRepairCapability = new ControlledRepairCapability(root),
    ) {
        this.healing = new SelfHealingOrchestrator(aprvl, capability);
    }

    async repairFailure(issue: string, output: string, context: RepairFailureContext = {}): Promise<CanonicalRepairExecutionResult> {
        const plan = this.planning.createPlan(issue, output, context.capabilityId);
        const authorization = context.authorization;
        const action = context.action;

        if (!authorization?.authorized || !authorization.authorizationToken) {
            return {
                repaired: false,
                plan,
                aprvl: { authorized: false, verified: false, summary: "repair authorization required" },
                reason: "REPAIR_AUTHORIZATION_REQUIRED",
            };
        }

        if (!action) {
            return {
                repaired: false,
                plan,
                aprvl: { authorized: false, verified: false, summary: "authorized repair action required" },
                reason: "REPAIR_ACTION_REQUIRED",
            };
        }

        const aprvlEvidence = await this.healing.heal(output, authorization);
        if (!aprvlEvidence.verified) {
            return { repaired: false, plan, aprvl: aprvlEvidence, reason: "APRVL_VERIFICATION_REQUIRED" };
        }

        const repair = await this.healing.executeAuthorizedRepair(aprvlEvidence, action, authorization);
        return {
            repaired: repair.verified,
            plan,
            aprvl: aprvlEvidence,
            repair,
            reason: repair.verified ? undefined : "CONTROLLED_REPAIR_VERIFICATION_FAILED",
        };
    }
}