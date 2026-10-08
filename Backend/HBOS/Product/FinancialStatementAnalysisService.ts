import {
  FinancialAnalysisInput,
  FinancialAnalysisResult,
  FinancialIntelligenceEngine,
} from "../Engines/FinancialIntelligenceEngine";
import { ReasoningEngine, ReasoningResult } from "../Engines/ReasoningEngine";
import { FinancialSourceEvidence } from "./FinancialDataIngestionAdapter";

export interface FinancialStatementEvidenceGate {
  /** True only when the required statement evidence was really extracted. */
  readonly ready: boolean;
  readonly missingMeasures: readonly string[];
  readonly incompleteSections: readonly string[];
  /** Precise typed code when not ready. */
  readonly code?: string;
  readonly reason?: string;
}

export interface FinancialStatementAnalysisInput extends FinancialAnalysisInput {
  readonly tenantId: string;
  readonly source: FinancialSourceEvidence;
  /**
   * Sufficiency gate from the canonical document understanding. Present only for
   * report/statement analyses; absent for a real ledger. When present and not
   * ready, the analysis fails closed instead of returning READY over absent data.
   */
  readonly documentEvidence?: FinancialStatementEvidenceGate;
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
  /** Precise typed code when the analysis was refused (never a fabricated READY). */
  readonly failureCode?: string;
  /** Non-fabricated explanation of the refusal. */
  readonly reason?: string;
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

    // Fail closed BEFORE the engine runs: a document whose required statement
    // evidence is incomplete must never yield READY zero/partial metrics.
    const gate = input.documentEvidence;
    if (gate && !gate.ready) {
      return this.insufficient(input, gate);
    }

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

  private insufficient(
    input: FinancialStatementAnalysisInput,
    gate: FinancialStatementEvidenceGate,
  ): FinancialStatementAnalysisResult {
    const code = gate.code?.trim() || "financial-report-insufficient-evidence";
    const reason = gate.reason?.trim() || "required-statement-evidence-missing";
    return {
      capabilityId: this.capabilityId,
      targetEngine: this.targetEngine,
      tenantId: input.tenantId.trim(),
      source: input.source,
      metrics: { revenue: 0, expenses: 0, profit: 0, profitMargin: 0, debtRatio: 0, status: "BLOCKED" },
      observations: [],
      reasoningEvidence: { status: code, success: false },
      status: "BLOCKED",
      failureCode: code,
      reason,
    };
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
    // Accept every canonical ingestion source type, including the governed
    // legacy XLS route and the document/report formats, so a verified canonical
    // source is never rejected merely for its acquisition format.
    const acceptedSourceTypes: ReadonlyArray<FinancialSourceEvidence["sourceType"]> = [
      "CSV", "STRUCTURED", "XLSX", "XLS", "PDF", "DOCX", "HTML", "XML", "TSV", "IMAGE",
    ];
    if (
      !source?.sourceName?.trim() ||
      !acceptedSourceTypes.includes(source.sourceType) ||
      !/^[a-f0-9]{64}$/i.test(source.sha256) ||
      !source.receivedAt?.trim()
    ) {
      throw new Error("financial-statement-analysis-source-evidence-invalid");
    }
  }
}
