/**
 * product.financial-analytics — composition owner over the realized financial
 * analytics product services.
 *
 * This is a COMPOSITION service, not a new Engine and not a duplicate product
 * service. It owns no financial mathematics: it validates the tenant boundary,
 * dispatches to the canonical realized owners below and normalizes their
 * deterministic results into one explainable tenant-scoped payload.
 *
 *   - RatioAnalysisService          (vertical / horizontal / profitability / leverage / liquidity)
 *   - BreakEvenAnalysisService      (break-even, contribution margin, margin of safety)
 *   - CashFlowForecastingService    (naive / moving average / linear trend)
 *   - AnomalyDetectionService       (z-score / IQR / modified z-score)
 *
 * Every section fails closed with the owning service's own `BLOCKED` status when
 * input is insufficient; the composition never fabricates a value.
 */
import {
    RatioAnalysisService,
    type CoverageResult,
    type DuPontResult,
    type EfficiencyResult,
    type HorizontalAnalysisResult,
    type RatioStatement,
    type VerticalAnalysisResult,
} from "./RatioAnalysisService";
import {
    BreakEvenAnalysisService,
    type BreakEvenAnalysisInput,
    type BreakEvenResult,
} from "./BreakEvenAnalysisService";
import {
    CashFlowForecastingService,
    type CashFlowForecastResult,
    type LinearTrendResult,
    type MovingAverageResult,
} from "./CashFlowForecastingService";
import { AnomalyDetectionService, type AnomalyResult } from "./AnomalyDetectionService";
import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";

export interface FinancialAnalyticsInput {
    readonly tenantId: string;
    /** Ordered period series for cash-flow forecasting and anomaly detection (>= 2 finite points). */
    readonly series?: readonly number[];
    /**
     * Structured statement for ratio analysis. A partial statement is accepted:
     * each ratio is computed only where its own evidence is present, and the
     * absent ratios are reported as unavailable rather than fabricated.
     */
    readonly statement?: Partial<RatioStatement>;
    /** Prior-period statement enables horizontal analysis (also partial). */
    readonly priorStatement?: Partial<RatioStatement>;
    /** Break-even inputs (fixed/variable/price/units). */
    readonly breakEven?: BreakEvenAnalysisInput;
    /** Moving-average window for forecasting; defaults to 3 (clamped to series length). */
    readonly movingAverageWindow?: number;
}

export interface WorkingCapitalAnalytics {
    readonly netWorkingCapital: number;
    readonly receivablesDays: number;
    readonly inventoryDays: number;
    readonly payablesDays: number;
    readonly cashConversionCycle: number;
}

export interface RatioAnalytics {
    readonly vertical: VerticalAnalysisResult | null;
    readonly horizontal: HorizontalAnalysisResult | null;
    readonly profitability: ReturnType<RatioAnalysisService["profitability"]> | null;
    readonly leverage: ReturnType<RatioAnalysisService["leverage"]> | null;
    readonly liquidity: ReturnType<RatioAnalysisService["liquidity"]> | null;
    /**
     * Working-capital cycle (net working capital, DSO/DIO/DPO and cash
     * conversion cycle) computed by the canonical `FinancialIntelligenceEngine`
     * owner. Null when any required measure (revenue, COGS, receivables,
     * inventory, payables) is absent — never a fabricated zero.
     */
    readonly workingCapital: WorkingCapitalAnalytics | null;
    readonly efficiency: EfficiencyResult | null;
    readonly coverage: CoverageResult | null;
    readonly duPont: DuPontResult | null;
}

export interface ForecastAnalytics {
    readonly naive: CashFlowForecastResult;
    readonly movingAverage: MovingAverageResult;
    readonly linearTrend: LinearTrendResult;
}

export interface AnomalyAnalytics {
    readonly zscore: AnomalyResult;
    readonly iqr: AnomalyResult;
    readonly modifiedZ: AnomalyResult;
}

export interface FinancialAnalyticsResult {
    readonly capabilityId: "product.financial-analytics";
    readonly targetEngine: "Financial Intelligence Engine";
    readonly tenantId: string;
    readonly ratios: RatioAnalytics | null;
    readonly breakEven: BreakEvenResult | null;
    readonly forecast: ForecastAnalytics | null;
    readonly anomalies: AnomalyAnalytics | null;
    readonly status: "READY" | "BLOCKED";
}

const finiteSeries = (value: unknown): number[] | null => {
    if (!Array.isArray(value) || value.length < 2) return null;
    if (!value.every((point) => typeof point === "number" && Number.isFinite(point))) return null;
    return value as number[];
};

export class FinancialAnalyticsService {
    readonly capabilityId = "product.financial-analytics" as const;
    readonly targetEngine = "Financial Intelligence Engine" as const;

    constructor(
        private readonly ratios: RatioAnalysisService = new RatioAnalysisService(),
        private readonly breakEven: BreakEvenAnalysisService = new BreakEvenAnalysisService(),
        private readonly cashFlow: CashFlowForecastingService = new CashFlowForecastingService(),
        private readonly anomaly: AnomalyDetectionService = new AnomalyDetectionService(),
        private readonly financialIntelligence: FinancialIntelligenceEngine = new FinancialIntelligenceEngine(),
    ) {}

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    execute(input: FinancialAnalyticsInput): FinancialAnalyticsResult {
        const tenantId = input?.tenantId?.trim() ?? "";
        if (!tenantId) throw new Error("financial-analytics-tenant-required");

        const series = finiteSeries(input.series);
        const ratios: RatioAnalytics | null = input.statement
            ? {
                vertical: this.ratios.vertical(input.statement),
                horizontal: input.priorStatement ? this.ratios.horizontal(input.statement, input.priorStatement) : null,
                profitability: this.ratios.profitability(input.statement),
                leverage: this.ratios.leverage(input.statement),
                liquidity: this.ratios.liquidity(input.statement),
                workingCapital: this.workingCapital(input.statement),
                efficiency: this.ratios.efficiency(input.statement),
                coverage: this.ratios.coverage(input.statement),
                duPont: this.ratios.duPont(input.statement),
            }
            : null;

        const breakEven: BreakEvenResult | null = input.breakEven
            ? this.breakEven.analyze(input.breakEven)
            : null;

        const forecast: ForecastAnalytics | null = series
            ? {
                naive: this.cashFlow.naive(series),
                movingAverage: this.cashFlow.movingAverage(series, this.windowFor(series, input.movingAverageWindow)),
                linearTrend: this.cashFlow.linearTrend(series),
            }
            : null;

        const anomalies: AnomalyAnalytics | null = series
            ? {
                zscore: this.anomaly.zscore(series),
                iqr: this.anomaly.iqr(series),
                modifiedZ: this.anomaly.modifiedZ(series),
            }
            : null;

        return {
            capabilityId: this.capabilityId,
            targetEngine: this.targetEngine,
            tenantId,
            ratios,
            breakEven,
            forecast,
            anomalies,
            status: this.anyReady(ratios, breakEven, forecast, anomalies) ? "READY" : "BLOCKED",
        };
    }

    /**
     * Working-capital cycle computed by the canonical `FinancialIntelligenceEngine`
     * owner. Delegating here keeps a single mathematics owner: this service only
     * extracts the evidence-backed inputs and returns the engine's verified
     * result, or null when a required input is absent.
     */
    private workingCapital(statement: Partial<RatioStatement>): WorkingCapitalAnalytics | null {
        const num = (field: keyof RatioStatement): number | null => {
            const value = (statement as Record<string, unknown>)[field];
            return typeof value === "number" && Number.isFinite(value) ? value : null;
        };
        const revenue = num("revenue");
        const cogs = num("cogs");
        const receivables = num("receivables");
        const inventory = num("inventory");
        const payables = num("payables");
        if (revenue === null || cogs === null || receivables === null || inventory === null || payables === null) {
            return null;
        }
        const result = this.financialIntelligence.workingCapital({ revenue, cogs, receivables, inventory, payables });
        if (result.status !== "READY") return null;
        return {
            netWorkingCapital: result.netWorkingCapital,
            receivablesDays: result.receivablesDays,
            inventoryDays: result.inventoryDays,
            payablesDays: result.payablesDays,
            cashConversionCycle: result.cashConversionCycle,
        };
    }

    private windowFor(series: readonly number[], requested: number | undefined): number {
        const candidate = Number.isFinite(requested) && (requested as number) > 0 ? Math.floor(requested as number) : 3;
        return Math.max(1, Math.min(candidate, series.length));
    }

    private anyReady(
        ratios: RatioAnalytics | null,
        breakEven: BreakEvenResult | null,
        forecast: ForecastAnalytics | null,
        anomalies: AnomalyAnalytics | null,
    ): boolean {
        const statuses: Array<"READY" | "BLOCKED"> = [];
        if (ratios) {
            if (ratios.vertical) statuses.push(ratios.vertical.status);
            if (ratios.horizontal) statuses.push(ratios.horizontal.status);
            if (ratios.profitability) statuses.push(ratios.profitability.status);
            if (ratios.leverage) statuses.push(ratios.leverage.status);
            if (ratios.liquidity) statuses.push(ratios.liquidity.status);
            if (ratios.workingCapital) statuses.push("READY");
            if (ratios.efficiency) statuses.push(ratios.efficiency.status);
            if (ratios.coverage) statuses.push(ratios.coverage.status);
            if (ratios.duPont) statuses.push(ratios.duPont.status);
        }
        if (breakEven) statuses.push(breakEven.status);
        if (forecast) statuses.push(forecast.naive.status, forecast.movingAverage.status, forecast.linearTrend.status);
        if (anomalies) statuses.push(anomalies.zscore.status, anomalies.iqr.status, anomalies.modifiedZ.status);
        return statuses.includes("READY");
    }
}
