/**
 * Phase 09-1.6: Cash-flow Forecasting Service (product service).
 *
 * Composition owner for the canonical cash-flow forecasting primitives used
 * by the financial dashboards, KPI workbench and the assistant. Provides:
 *   - movingAverageForecast(series, window, horizon)
 *   - naiveForecast(series, horizon)
 *   - linearTrendForecast(series, horizon)
 *
 * All math is local and deterministic. The Forecasting engines that exist for
 * the higher-order temporal / statistical models (07-C.A / 07-C.B / etc.) are
 * NOT duplicated; this service exposes the simple, evidence-bound cash-flow
 * primitives that the financial workbench and product UI rely on.
 *
 * No external state, no tenant data stored on the service. The caller is
 * responsible for tenant-scoped persistence.
 */

export interface ForecastPoint {
    /** Forecast step index, 1-based (1 = first forecast period after the last observed point). */
    step: number;
    /** Forecasted value at this step. */
    value: number;
}

export interface ForecastResult {
    method: "naive" | "movingAverage" | "linearTrend";
    horizon: number;
    points: ForecastPoint[];
    /** Per-step residuals (observed - fitted) when fitting is possible; otherwise empty. */
    fitted: ForecastPoint[];
    status: "READY" | "BLOCKED";
}

export class CashFlowForecastingService {
    private validateSeries(series: readonly number[]): boolean {
        if (!Array.isArray(series) || series.length === 0) return false;
        for (const v of series) {
            if (!Number.isFinite(v)) return false;
        }
        return true;
    }

    naive(series: readonly number[], horizon: number): ForecastResult {
        if (!this.validateSeries(series) || !Number.isFinite(horizon) || horizon <= 0) {
            return { method: "naive", horizon: 0, points: [], fitted: [], status: "BLOCKED" };
        }
        const last = series[series.length - 1];
        const points: ForecastPoint[] = [];
        for (let i = 1; i <= horizon; i += 1) {
            points.push({ step: i, value: last });
        }
        return { method: "naive", horizon, points, fitted: [], status: "READY" };
    }

    movingAverage(series: readonly number[], window: number, horizon: number): ForecastResult {
        if (!this.validateSeries(series) || !Number.isFinite(window) || !Number.isFinite(horizon) ||
            window <= 0 || horizon <= 0) {
            return { method: "movingAverage", horizon: 0, points: [], fitted: [], status: "BLOCKED" };
        }
        if (window > series.length) {
            return { method: "movingAverage", horizon: 0, points: [], fitted: [], status: "BLOCKED" };
        }
        const fitted: ForecastPoint[] = [];
        for (let t = 0; t < series.length; t += 1) {
            const start = t - window + 1;
            if (start < 0) continue;
            let sum = 0;
            for (let k = start; k <= t; k += 1) sum += series[k];
            fitted.push({ step: t + 1, value: sum / window });
        }
        const lastMA = fitted[fitted.length - 1].value;
        const points: ForecastPoint[] = [];
        for (let i = 1; i <= horizon; i += 1) {
            points.push({ step: i, value: lastMA });
        }
        return { method: "movingAverage", horizon, points, fitted, status: "READY" };
    }

    linearTrend(series: readonly number[], horizon: number): ForecastResult {
        if (!this.validateSeries(series) || !Number.isFinite(horizon) || horizon <= 0) {
            return { method: "linearTrend", horizon: 0, points: [], fitted: [], status: "BLOCKED" };
        }
        if (series.length < 2) {
            return { method: "linearTrend", horizon: 0, points: [], fitted: [], status: "BLOCKED" };
        }
        // Ordinary least squares with x = 1..n
        const n = series.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i += 1) {
            const x = i + 1;
            const y = series[i];
            sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
        }
        const denom = n * sumXX - sumX * sumX;
        if (denom === 0) {
            return { method: "linearTrend", horizon: 0, points: [], fitted: [], status: "BLOCKED" };
        }
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        const fitted: ForecastPoint[] = [];
        for (let i = 0; i < n; i += 1) {
            fitted.push({ step: i + 1, value: intercept + slope * (i + 1) });
        }
        const points: ForecastPoint[] = [];
        for (let i = 1; i <= horizon; i += 1) {
            const x = n + i;
            points.push({ step: i, value: intercept + slope * x });
        }
        return { method: "linearTrend", horizon, points, fitted, status: "READY" };
    }
}
