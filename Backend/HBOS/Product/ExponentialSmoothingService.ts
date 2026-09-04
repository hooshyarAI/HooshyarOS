/**
 * Phase 09-1.9: Simple Exponential Smoothing (product service).
 *
 * Local deterministic SES implementation used by the financial workbench for
 * smoothing volatile series before passing to downstream decision or
 * forecasting logic. Not a duplicate of higher-order ARIMA/ML models.
 */

export interface SesResult {
    method: "ses";
    horizon: number;
    alpha: number;
    fitted: { step: number; value: number }[];
    points: { step: number; value: number }[];
    /** Mean absolute error over the in-sample fitted values vs the observed series. */
    inSampleMae: number;
    status: "READY" | "BLOCKED";
}

export class ExponentialSmoothingService {
    ses(series: readonly number[], alpha: number, horizon: number): SesResult {
        if (!Array.isArray(series) || series.length === 0 ||
            !Number.isFinite(alpha) || alpha < 0 || alpha > 1 ||
            !Number.isFinite(horizon) || horizon <= 0) {
            return { method: "ses", horizon: 0, alpha: 0, fitted: [], points: [], inSampleMae: 0, status: "BLOCKED" };
        }
        for (const v of series) {
            if (!Number.isFinite(v)) {
                return { method: "ses", horizon: 0, alpha, fitted: [], points: [], inSampleMae: 0, status: "BLOCKED" };
            }
        }
        const fitted: { step: number; value: number }[] = [];
        let level = series[0];
        fitted.push({ step: 1, value: level });
        let absErr = 0;
        for (let t = 1; t < series.length; t += 1) {
            const observed = series[t];
            const forecast = level;
            absErr += Math.abs(observed - forecast);
            level = alpha * observed + (1 - alpha) * level;
            fitted.push({ step: t + 1, value: level });
        }
        const mae = series.length > 1 ? absErr / (series.length - 1) : 0;
        const points: { step: number; value: number }[] = [];
        for (let i = 1; i <= horizon; i += 1) {
            points.push({ step: i, value: level });
        }
        return { method: "ses", horizon, alpha, fitted, points, inSampleMae: mae, status: "READY" };
    }
}
