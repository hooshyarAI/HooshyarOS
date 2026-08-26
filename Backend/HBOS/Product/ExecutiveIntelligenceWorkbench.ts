import {
  ExecutiveIntelligenceEngine,
  ExecutiveKpi,
  ExecutivePerformance,
  ExecutiveRecommendation,
} from "../Engines/ExecutiveIntelligenceEngine";
import { FinancialAnalysisResult } from "../Engines/FinancialIntelligenceEngine";

export interface ExecutiveIntelligenceWorkbenchInput {
  readonly tenantId: string;
  readonly metrics: Pick<FinancialAnalysisResult, "revenue" | "profit" | "profitMargin" | "debtRatio">;
  readonly targets: Readonly<Record<"revenue" | "profit" | "profitMargin" | "debtRatio", number>>;
}

export interface ExecutiveIntelligenceWorkbenchResult {
  readonly capabilityId: "product.executive-intelligence-workbench";
  readonly targetEngine: "Executive Intelligence Engine";
  readonly tenantId: string;
  readonly kpis: readonly ExecutiveKpi[];
  readonly recommendations: readonly ExecutiveRecommendation[];
  readonly performance: readonly ExecutivePerformance[];
  readonly status: "READY";
}

/**
 * Canonical product boundary for executive KPI and performance intelligence.
 * Composes existing executive and verified financial contracts without creating
 * a duplicate engine hierarchy or inventing business thresholds.
 */
export class ExecutiveIntelligenceWorkbench {
  readonly capabilityId = "product.executive-intelligence-workbench" as const;
  readonly targetEngine = "Executive Intelligence Engine" as const;

  constructor(private readonly executiveIntelligence: ExecutiveIntelligenceEngine) {}

  initialize(): { status: "READY" } {
    return { status: "READY" };
  }

  execute(input: ExecutiveIntelligenceWorkbenchInput): ExecutiveIntelligenceWorkbenchResult {
    this.assertBoundaryInput(input);

    const definitions = [
      ["revenue", input.metrics.revenue],
      ["profit", input.metrics.profit],
      ["profitMargin", input.metrics.profitMargin],
      ["debtRatio", input.metrics.debtRatio],
    ] as const;

    const kpis = definitions.map(([name, actual]) =>
      this.executiveIntelligence.analyzeKpi(name, actual, input.targets[name]),
    );

    return {
      capabilityId: this.capabilityId,
      targetEngine: this.targetEngine,
      tenantId: input.tenantId.trim(),
      kpis,
      recommendations: kpis.map((kpi) => this.executiveIntelligence.recommend(kpi)),
      performance: kpis.map((kpi) => this.executiveIntelligence.evaluatePerformance(kpi.actual, kpi.target)),
      status: "READY",
    };
  }

  private assertBoundaryInput(input: ExecutiveIntelligenceWorkbenchInput): void {
    if (!input?.tenantId?.trim()) {
      throw new Error("executive-intelligence-workbench-tenant-required");
    }
    if (!input.metrics) {
      throw new Error("executive-intelligence-workbench-metrics-required");
    }

    for (const name of ["revenue", "profit", "profitMargin", "debtRatio"] as const) {
      if (!Number.isFinite(input.metrics[name])) {
        throw new Error(`executive-intelligence-workbench-metric-invalid:${name}`);
      }
      if (!Number.isFinite(input.targets[name])) {
        throw new Error(`executive-intelligence-workbench-target-invalid:${name}`);
      }
    }
  }
}
