import { ExecutiveIntelligenceEngine, ExecutiveKpi, ExecutivePerformance, ExecutiveRecommendation } from "../Engines/ExecutiveIntelligenceEngine";
import { FinancialAnalysisResult } from "../Engines/FinancialIntelligenceEngine";

export interface ExecutiveIntelligenceWorkbenchInput {
  readonly tenantId: string;
  readonly metrics: FinancialAnalysisResult;
  readonly targets: {
    readonly revenue: number;
    readonly profit: number;
    readonly profitMargin: number;
    readonly debtRatio: number;
  };
}

export interface ExecutiveIntelligenceWorkbenchResult {
  readonly capabilityId: "product.executive-intelligence-workbench";
  readonly targetEngine: "Executive Intelligence Engine";
  readonly tenantId: string;
  readonly kpis: readonly ExecutiveKpi[];
  readonly performance: readonly ExecutivePerformance[];
  readonly recommendations: readonly ExecutiveRecommendation[];
  readonly status: "READY" | "BLOCKED";
}

export class ExecutiveIntelligenceWorkbench {
  readonly capabilityId = "product.executive-intelligence-workbench" as const;
  readonly targetEngine = "Executive Intelligence Engine" as const;

  constructor(private readonly executive: ExecutiveIntelligenceEngine) {}

  initialize(): { status: "READY" } {
    return { status: "READY" };
  }

  execute(input: ExecutiveIntelligenceWorkbenchInput): ExecutiveIntelligenceWorkbenchResult {
    this.assertBoundaryInput(input);
    if (input.metrics.status !== "READY") return this.blocked(input);

    const actuals = [
      ["revenue", input.metrics.revenue, input.targets.revenue],
      ["profit", input.metrics.profit, input.targets.profit],
      ["profitMargin", input.metrics.profitMargin, input.targets.profitMargin],
      ["debtRatio", input.metrics.debtRatio, input.targets.debtRatio],
    ] as const;

    const kpis = actuals.map(([name, actual, target]) => this.executive.analyzeKpi(name, actual, target));
    const performance = actuals.map(([, actual, target]) => this.executive.evaluatePerformance(actual, target));
    const recommendations = kpis.map((kpi) => this.executive.recommend(kpi));

    return {
      capabilityId: this.capabilityId,
      targetEngine: this.targetEngine,
      tenantId: input.tenantId.trim(),
      kpis,
      performance,
      recommendations,
      status: "READY",
    };
  }

  private blocked(input: ExecutiveIntelligenceWorkbenchInput): ExecutiveIntelligenceWorkbenchResult {
    return {
      capabilityId: this.capabilityId,
      targetEngine: this.targetEngine,
      tenantId: input.tenantId.trim(),
      kpis: [],
      performance: [],
      recommendations: [],
      status: "BLOCKED",
    };
  }

  private assertBoundaryInput(input: ExecutiveIntelligenceWorkbenchInput): void {
    if (!input?.tenantId?.trim()) throw new Error("executive-intelligence-workbench-tenant-required");
    if (!input.metrics || typeof input.metrics !== "object") throw new Error("executive-intelligence-workbench-metrics-required");
    const targets = input.targets;
    if (
      !targets ||
      !Number.isFinite(targets.revenue) ||
      !Number.isFinite(targets.profit) ||
      !Number.isFinite(targets.profitMargin) ||
      !Number.isFinite(targets.debtRatio) ||
      targets.revenue <= 0 ||
      targets.profit <= 0 ||
      targets.profitMargin <= 0 ||
      targets.debtRatio <= 0
    ) {
      throw new Error("executive-intelligence-workbench-targets-invalid");
    }
  }
}
