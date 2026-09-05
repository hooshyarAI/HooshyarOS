import {
  FinancialAnalysisInput,
  FinancialAnalysisResult,
  FinancialIntelligenceEngine,
} from "../Engines/FinancialIntelligenceEngine";
import { ReasoningEngine, ReasoningResult } from "../Engines/ReasoningEngine";
import { FinancialSourceEvidence } from "./FinancialDataIngestionAdapter";

export interface FinancialStatementAnalysisInput extends FinancialAnalysisInput {
  readonly tenantId: string;
  readonly source: FinancialSourceEvidence;
}

export interface FinancialObservation {
  readonly code: "LOSS" | "PROFITABLE";
  readonly message: string;
}

export interface FinancialStatementAnalysisResult {
  readonly capabilityId: "product.financial-statement-analysis";
  readonly targetEngine: "Financial Intelligence Engine";
  readonly tenantId: string;
  readonly source: FinancialSourceEvidence;
  readonly metrics: FinancialAnalysisResult;
  readonly observations: readonly FinancialObservation[];
  readonly reasoningEvidence: Pick<ReasoningResult, "status" | "success">;
  readonly status: "READY" | "BLOCKED";
}

/**
 * Canonical product boundary for financial statement analysis.
 * It composes existing engine contracts and does not create a second financial engine.
 */
export class FinancialStatementAnalysisService {
  readonly capabilityId = "product.financial-statement-analysis" as const;
  readonly targetEngine = "Financial Intelligence Engine" as const;

  constructor(
    private readonly financialIntelligence: FinancialIntelligenceEngine,
    private readonly reasoning: Pick<ReasoningEngine, "reason">,
  ) {}

  initialize(): { status: "READY" } {
    return { status: "READY" };
  }

  execute(input: FinancialStatementAnalysisInput): FinancialStatementAnalysisResult {
    this.assertBoundaryInput(input);

    const metrics = this.financialIntelligence.analyze({
      revenue: input.revenue,
      expenses: input.expenses,
      assets: input.assets,
      liabilities: input.liabilities,
    });

    if (metrics.status !== "READY") {
      return this.blocked(input, metrics, "financial-analysis-blocked");
    }

    const observations = this.observations(metrics);
    const reasoningResult = this.reasoning.reason(this.reasoningPrompt(input, metrics, observations));

    if (!reasoningResult.success) {
      return this.blocked(input, metrics, reasoningResult.status, reasoningResult);
    }

    return {
      capabilityId: this.capabilityId,
      targetEngine: this.targetEngine,
      tenantId: input.tenantId.trim(),
      source: input.source,
      metrics,
      observations,
      reasoningEvidence: { status: reasoningResult.status, success: true },
      status: "READY",
    };
  }

  private observations(metrics: FinancialAnalysisResult): readonly FinancialObservation[] {
    return metrics.profit < 0
      ? [{ code: "LOSS", message: "The analyzed statement has negative profit." }]
      : [{ code: "PROFITABLE", message: "The analyzed statement has non-negative profit." }];
  }

  private reasoningPrompt(
    input: FinancialStatementAnalysisInput,
    metrics: FinancialAnalysisResult,
    observations: readonly FinancialObservation[],
  ): string {
    return [
      "Explain verified financial statement analysis from repository-owned metrics; do not invent thresholds or business rules.",
      `tenant=${input.tenantId.trim()}`,
      `source=${input.source.sourceName}`,
      `profit=${metrics.profit}`,
      `profitMargin=${metrics.profitMargin}`,
      `debtRatio=${metrics.debtRatio}`,
      `observations=${observations.map((observation) => observation.code).join(",")}`,
    ].join(" | ");
  }

  private blocked(
    input: FinancialStatementAnalysisInput,
    metrics: FinancialAnalysisResult,
    reason: string,
    reasoning?: ReasoningResult,
  ): FinancialStatementAnalysisResult {
    return {
      capabilityId: this.capabilityId,
      targetEngine: this.targetEngine,
      tenantId: input.tenantId.trim(),
      source: input.source,
      metrics,
      observations: [],
      reasoningEvidence: {
        status: reasoning?.status ?? reason,
        success: false,
      },
      status: "BLOCKED",
    };
  }

  private assertBoundaryInput(input: FinancialStatementAnalysisInput): void {
    if (!input?.tenantId?.trim()) {
      throw new Error("financial-statement-analysis-tenant-required");
    }

    const source = input.source;
    if (
      !source?.sourceName?.trim() ||
      (source.sourceType !== "CSV" && source.sourceType !== "STRUCTURED") ||
      !/^[a-f0-9]{64}$/i.test(source.sha256) ||
      !source.receivedAt?.trim()
    ) {
      throw new Error("financial-statement-analysis-source-evidence-invalid");
    }
  }
}
