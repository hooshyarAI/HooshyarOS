import { execFileSync } from "node:child_process";
import { RuntimeValidationEvidenceBuilder } from "./RuntimeValidationEvidence";
import { RuntimeValidationStage } from "./RuntimeValidationContract";

export interface WindowsRuntimeProbeOptions {
  readonly executable: string;
  readonly healthCommand?: string;
}

export class WindowsRuntimeProbe {
  constructor(private readonly options: WindowsRuntimeProbeOptions) {}

  probe(): readonly ReturnType<RuntimeValidationEvidenceBuilder["build"]>[number][] {
    const evidence = new RuntimeValidationEvidenceBuilder();
    this.recordProcessEvidence(evidence);
    return evidence.build();
  }

  private recordProcessEvidence(evidence: RuntimeValidationEvidenceBuilder): void {
    const stage: RuntimeValidationStage = "process-alive";
    try {
      execFileSync(this.options.executable, ["--version"], {
        stdio: "ignore",
        timeout: 10_000,
        windowsHide: true,
      });
      evidence.record(stage, true, `Process executable responded: ${this.options.executable}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      evidence.record(stage, false, `Process probe failed: ${detail}`);
    }
  }
}
