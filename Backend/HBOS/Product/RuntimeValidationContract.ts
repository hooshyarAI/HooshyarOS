export type RuntimeValidationStage =
  | "install"
  | "launch"
  | "process-alive"
  | "hbos-ready"
  | "backend-reachable"
  | "auth-ready"
  | "tenant-context"
  | "persistence-ready"
  | "workflow-ready";

export interface RuntimeValidationEvidence {
  readonly stage: RuntimeValidationStage;
  readonly passed: boolean;
  readonly detail: string;
}

export interface RuntimeValidationReport {
  readonly platform: "windows" | "android";
  readonly passed: boolean;
  readonly evidence: readonly RuntimeValidationEvidence[];
}

export class RuntimeValidationContract {
  static requiredStages(): readonly RuntimeValidationStage[] {
    return [
      "install",
      "launch",
      "process-alive",
      "hbos-ready",
      "backend-reachable",
      "auth-ready",
      "tenant-context",
      "persistence-ready",
      "workflow-ready",
    ];
  }

  static evaluate(
    platform: RuntimeValidationReport["platform"],
    evidence: readonly RuntimeValidationEvidence[],
  ): RuntimeValidationReport {
    const byStage = new Map(evidence.map((item) => [item.stage, item]));
    const passed = this.requiredStages().every((stage) => byStage.get(stage)?.passed === true);

    return { platform, passed, evidence };
  }
}
