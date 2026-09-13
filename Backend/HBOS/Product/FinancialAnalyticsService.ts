/**
 * product.financial-analytics — composition owner over the realized financial
 * analytics product services.
 *
 * This is a COMPOSITION service, not a new Engine and not a duplicate product
 * service. It owns no financial mathematics: it validates the tenant boundary,
 * dispatches to the canonical realized owners below and normalizes their
 * deterministic results into one explainable tenant-scoped payload.
 *
 *   - RatioAnalysisService          (vertical / horizontal / profitability / leverage)
 *   - BreakEvenAnalysisService      (break-even, contribution margin, margin of safety)
 *   - CashFlowForecastingService    (naive / moving average / linear trend)
 *   - AnomalyDetectionService       (z-score / IQR / modified z-score)
 *
 * Every section fails closed with the owning service's own `BLOCKED` status when
 * input is insufficient; the composition never fabricates a value.
 */
import {
    RatioAnalysisService,
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

export interface FinancialAnalyticsInput {
    readonly tenantId: string;
    /** Ordered period series for cash-flow forecasting and anomaly detection (>= 2 finite points). */
    readonly series?: readonly number[];
    /** Structured statement for ratio analysis. */
    readonly statement?: RatioStatement;
    /** Prior-period statement enables horizontal analysis. */
    readonly priorStatement?: RatioStatement;
    /** Break-even inputs (fixed/variable/price/units). */
    readonly breakEven?: BreakEvenAnalysisInput;
    /** Moving-average window for forecasting; defaults to 3 (clamped to series length). */
    readonly movingAverageWindow?: number;
}

export interface RatioAnalytics {
    readonly vertical: VerticalAnalysisResult | null;
    readonly horizontal: HorizontalAnalysisResult | null;
    readonly profitability: ReturnType<RatioAnalysisService["profitability"]> | null;
    readonly leverage: ReturnType<RatioAnalysisService["leverage"]> | null;
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
        }
        if (breakEven) statuses.push(breakEven.status);
        if (forecast) statuses.push(forecast.naive.status, forecast.movingAverage.status, forecast.linearTrend.status);
        if (anomalies) statuses.push(anomalies.zscore.status, anomalies.iqr.status, anomalies.modifiedZ.status);
        return statuses.includes("READY");
    }
}
