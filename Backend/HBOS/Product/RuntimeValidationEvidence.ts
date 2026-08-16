import { RuntimeValidationEvidence, RuntimeValidationStage } from "./RuntimeValidationContract";

/**
 * Converts externally observed runtime checks into governed evidence.
 * No stage is inferred: callers must explicitly report pass/fail and detail.
 */
export class RuntimeValidationEvidenceBuilder {
  private readonly evidence: RuntimeValidationEvidence[] = [];

  record(stage: RuntimeValidationStage, passed: boolean, detail: string): this {
    if (!detail.trim()) {
      throw new Error(`Runtime evidence detail is required for ${stage}`);
    }
    this.evidence.push({ stage, passed, detail: detail.trim() });
    return this;
  }

  build(): readonly RuntimeValidationEvidence[] {
    return this.evidence.map((item) => ({ ...item }));
  }
}
