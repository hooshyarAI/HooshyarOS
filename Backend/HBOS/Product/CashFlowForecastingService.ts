export interface CashFlowForecastResult {
    forecast: number;
    status: "READY" | "BLOCKED";
}

export interface MovingAverageResult {
    forecast: number;
    window: number;
    status: "READY" | "BLOCKED";
}

export interface LinearTrendResult {
    forecast: number;
    slope: number;
    intercept: number;
    status: "READY" | "BLOCKED";
}

export class CashFlowForecastingService {
    readonly capabilityId = "product.cash-flow-forecasting";
    readonly targetEngine = "Financial Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    naive(history: number[]): CashFlowForecastResult {
        if (!Array.isArray(history) || history.length === 0) {
            return { forecast: 0, status: "BLOCKED" };
        }
        const last = history[history.length - 1];
        if (!Number.isFinite(last)) {
            return { forecast: 0, status: "BLOCKED" };
        }
        return { forecast: last, status: "READY" };
    }

    movingAverage(history: number[], window: number): MovingAverageResult {
        if (!Array.isArray(history) || history.length === 0 || !Number.isFinite(window) || window <= 0) {
            return { forecast: 0, window: 0, status: "BLOCKED" };
        }
        const validHistory = history.filter(Number.isFinite);
        if (validHistory.length === 0) {
            return { forecast: 0, window, status: "BLOCKED" };
        }
        const slice = validHistory.slice(-window);
        const forecast = slice.reduce((a, b) => a + b, 0) / slice.length;
        return { forecast, window, status: "READY" };
    }

    linearTrend(history: number[]): LinearTrendResult {
        if (!Array.isArray(history) || history.length < 2) {
            return { forecast: 0, slope: 0, intercept: 0, status: "BLOCKED" };
        }
        const clean = history.map((v, i) => ({ x: i, y: v })).filter(p => Number.isFinite(p.y));
        if (clean.length < 2) {
            return { forecast: 0, slope: 0, intercept: 0, status: "BLOCKED" };
        }
        const n = clean.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (const p of clean) {
            sumX += p.x;
            sumY += p.y;
            sumXY += p.x * p.y;
            sumX2 += p.x * p.x;
        }
        const denom = n * sumX2 - sumX * sumX;
        if (denom === 0) {
            return { forecast: 0, slope: 0, intercept: 0, status: "BLOCKED" };
        }
        const slope = (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        const forecast = slope * n + intercept;
        return { forecast, slope, intercept, status: "READY" };
    }
}
