import { AutonomousFailureAnalyzer } from "../Analyzer/AutonomousFailureAnalyzer";
import type { APRVLRepairAdapter, APRVLRepairEvidence } from "../Integration/APRVLRepairAdapter";

export interface RepairAuthorization {
  readonly authorized: boolean;
}

export class SelfHealingOrchestrator {
  private readonly analyzer = new AutonomousFailureAnalyzer();

  constructor(private readonly aprvl: APRVLRepairAdapter) {}

  async heal(output: string, authorization: RepairAuthorization): Promise<APRVLRepairEvidence> {
    if (!authorization.authorized) {
      return {
        authorized: false,
        verified: false,
        summary: "repair denied by governance",
      };
    }

    const report = this.analyzer.analyze(output);
    return this.aprvl.execute({
      issueType: report.type,
      failureOutput: output,
    });
  }
}
