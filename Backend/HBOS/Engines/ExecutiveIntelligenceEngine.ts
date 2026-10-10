import { Engine } from "../Core/Engine";

export type ExecutiveKpiDirection = "higher-is-better" | "lower-is-better";

export interface ExecutiveKpi {
    name: string;
    actual: number;
    target: number;
    direction: ExecutiveKpiDirection;
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

    analyzeKpi(
        name: string,
        actual: number,
        target: number,
        direction: ExecutiveKpiDirection = "higher-is-better",
    ): ExecutiveKpi {
        const achievementRate = this.calculateAchievement(actual, target, direction);
        return {
            name,
            actual,
            target,
            direction,
            variance: actual - target,
            achievementRate,
        };
    }

    recommend(kpi: ExecutiveKpi): ExecutiveRecommendation {
        if (!Number.isFinite(kpi.actual) || !Number.isFinite(kpi.target) ||
            !Number.isFinite(kpi.achievementRate) ||
            (kpi.direction === "lower-is-better" && kpi.target <= 0)) {
            return { status: "BLOCKED", action: "Provide valid KPI values and a valid target before executive action." };
        }
        if (kpi.achievementRate >= 100) {
            return { status: "ON_TRACK", action: "Maintain the current execution path and monitor the KPI." };
        }
        return { status: "AT_RISK", action: "Review the KPI gap, root causes and corrective actions." };
    }

    evaluatePerformance(
        actual: number,
        target: number,
        direction: ExecutiveKpiDirection = "higher-is-better",
    ): ExecutivePerformance {
        if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) {
            return { status: "BLOCKED", achievementRate: 0 };
        }
        const achievementRate = this.calculateAchievement(actual, target, direction);
        return {
            status: achievementRate >= 100 ? "ON_TRACK" : "BELOW_TARGET",
            achievementRate,
        };
    }

    private calculateAchievement(
        actual: number,
        target: number,
        direction: ExecutiveKpiDirection,
    ): number {
        if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return 0;
        if (direction === "lower-is-better") {
            // A zero or negative observed ratio is not worse than a positive target.
            return actual <= 0 ? 100 : (target / actual) * 100;
        }
        return (actual / target) * 100;
    }
}
