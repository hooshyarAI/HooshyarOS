import { Engine } from "../Core/Engine";

export interface ExecutiveKpi {
    name: string;
    actual: number;
    target: number;
    variance: number;
    achievementRate: number;
}

export interface ExecutiveRecommendation {
    status: "ON_TRACK" | "AT_RISK" | "BLOCKED";
    action: string;
}

export interface ExecutivePerformance {
    status: "ON_TRACK" | "BELOW_TARGET" | "BLOCKED";
    achievementRate: number;
}

/**
 * Canonical Executive Intelligence Engine.
 *
 * Owns executive dashboard primitives, KPI analysis, strategic recommendation
 * status and performance evaluation without duplicating the Decision Engine.
 */
export class ExecutiveIntelligenceEngine implements Engine {
    name = "ExecutiveIntelligenceEngine";

    initialize(): void {
        console.log("ExecutiveIntelligenceEngine Started");
    }

    health(): boolean {
        return true;
    }

    analyzeKpi(name: string, actual: number, target: number): ExecutiveKpi {
        const achievementRate = target === 0 ? 0 : (actual / target) * 100;
        return {
            name,
            actual,
            target,
            variance: actual - target,
            achievementRate
        };
    }

    recommend(kpi: ExecutiveKpi): ExecutiveRecommendation {
        if (!Number.isFinite(kpi.actual) || !Number.isFinite(kpi.target)) {
            return { status: "BLOCKED", action: "Provide valid KPI values before executive action." };
        }
        if (kpi.achievementRate >= 100) {
            return { status: "ON_TRACK", action: "Maintain the current execution path and monitor the KPI." };
        }
        return { status: "AT_RISK", action: "Review the KPI gap, root causes and corrective actions." };
    }

    evaluatePerformance(actual: number, target: number): ExecutivePerformance {
        if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) {
            return { status: "BLOCKED", achievementRate: 0 };
        }
        const achievementRate = (actual / target) * 100;
        return {
            status: achievementRate >= 100 ? "ON_TRACK" : "BELOW_TARGET",
            achievementRate
        };
    }
}
