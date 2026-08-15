import { AutonomousFailureAnalyzer } from "../Analyzer/AutonomousFailureAnalyzer";
import type { APRVLRepairAdapter, APRVLRepairEvidence } from "../Integration/APRVLRepairAdapter";
import type { AuthorizedRepairAction, ControlledRepairCapability, ControlledRepairEvidence } from "../Repair/ControlledRepairCapability";

export interface RepairAuthorization {
  readonly authorized: boolean;
  readonly authorizationToken?: string;
}

export class SelfHealingOrchestrator {
  private readonly analyzer = new AutonomousFailureAnalyzer();

  constructor(
    private readonly aprvl: APRVLRepairAdapter,
    private readonly repairCapability?: ControlledRepairCapability,
  ) {}

  async heal(output: string, authorization: RepairAuthorization): Promise<APRVLRepairEvidence> {
    if (!authorization.authorized) {
      return { authorized: false, verified: false, summary: "repair denied by governance" };
    }

    const report = this.analyzer.analyze(output);
    return this.aprvl.execute({ issueType: report.type, failureOutput: output });
  }

  async executeAuthorizedRepair(
    aprvlEvidence: APRVLRepairEvidence,
    action: Omit<AuthorizedRepairAction, "authorizationToken">,
    authorization: RepairAuthorization,
  ): Promise<ControlledRepairEvidence> {
    if (!authorization.authorized || !authorization.authorizationToken) {
      throw new Error("repair authorization required");
    }
    if (!aprvlEvidence.verified) {
      throw new Error("independent APRVL verification required before repair");
    }
    if (!this.repairCapability) {
      throw new Error("controlled repair capability unavailable");
    }

    return this.repairCapability.execute({
      ...action,
      authorizationToken: authorization.authorizationToken,
    });
  }
}
