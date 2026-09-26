export interface SesResult {
    smoothed: number;
    status: "READY" | "BLOCKED";
}

export class ExponentialSmoothingService {
    readonly capabilityId = "product.exponential-smoothing";
    readonly targetEngine = "Financial Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    ses(history: number[], alpha: number): SesResult {
        if (!Array.isArray(history) || history.length === 0 || !Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) {
            return { smoothed: 0, status: "BLOCKED" };
        }
        const clean = history.filter(Number.isFinite);
        if (clean.length === 0) {
            return { smoothed: 0, status: "BLOCKED" };
        }
        let smoothed = clean[0];
        for (let i = 1; i < clean.length; i += 1) {
            smoothed = alpha * clean[i] + (1 - alpha) * smoothed;
        }
        return { smoothed, status: "READY" };
    }
}
