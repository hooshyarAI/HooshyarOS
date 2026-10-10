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

export type ExecutiveRecommendationActionCode =
    | "MONITOR"
    | "INVESTIGATE_TARGET_SHORTFALL"
    | "INVESTIGATE_TARGET_EXCEEDANCE"
    | "VERIFY_INPUTS";

export interface ExecutiveRecommendation {
    status: "ON_TRACK" | "AT_RISK" | "BLOCKED";
    actionCode: ExecutiveRecommendationActionCode;
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
            !Number.isFinite(kpi.achievementRate) || kpi.target <= 0 ||
            (kpi.direction !== "higher-is-better" && kpi.direction !== "lower-is-better")) {
            return {
                status: "BLOCKED",
                actionCode: "VERIFY_INPUTS",
                action: "Verify KPI values, direction and target before executive action.",
            };
        }
        if (kpi.achievementRate >= 100) {
            return {
                status: "ON_TRACK",
                actionCode: "MONITOR",
                action: "Maintain the current execution path and monitor the KPI.",
            };
        }
        if (kpi.direction === "lower-is-better") {
            return {
                status: "AT_RISK",
                actionCode: "INVESTIGATE_TARGET_EXCEEDANCE",
                action: "The observed value exceeds a lower-is-better target; review evidence and mitigation options.",
            };
        }
        return {
            status: "AT_RISK",
            actionCode: "INVESTIGATE_TARGET_SHORTFALL",
            action: "The observed value is below a higher-is-better target; review evidence and corrective options.",
        };
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
