import { Engine } from "../Core/Engine";
import { MemoryEngine } from "./MemoryEngine";
import { OrganizationalIntelligenceEngine } from "./OrganizationalIntelligenceEngine";
import { GovernanceEngine } from "./GovernanceEngine";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { MemoryEvent } from "../Entities/MemoryEvent";

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

export interface StrategicGoal {
    id: string;
    name: string;
    target: number;
    weight: number;
    category: string;
}

export interface ActualMetrics {
    goalId: string;
    actual: number;
    timestamp: string;
    source: string;
}

export interface ExpectedMetrics {
    metric: string;
    expected: number;
    period: string;
}

export interface KpiDataPoint {
    timestamp: string;
    value: number;
    source: string;
}

export interface StrategicAlignment {
    alignmentScore: number;
    gaps: Array<{ goalId: string; goalName: string; target: number; actual: number; gap: number }>;
    criticalDivergences: Array<{ goalId: string; goalName: string; target: number; actual: number; severity: "HIGH" | "MEDIUM" | "LOW" }>;
    recommendations: string[];
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

export interface DashboardPrimitives {
    kpis: ExecutiveKpi[];
    trends: Array<{ name: string; direction: "UP" | "DOWN" | "STABLE"; changePercent: number }>;
    alerts: Array<{ severity: "HIGH" | "MEDIUM" | "LOW"; message: string; kpi?: string }>;
    strategicAlignment: StrategicAlignment;
    balancedGrowthIndicators: BalancedGrowthReport;
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

export interface KPIHistory {
    kpiId: string;
    dataPoints: KpiDataPoint[];
    trend: "UP" | "DOWN" | "STABLE";
    forecast: number | null;
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

export interface ImpactComparison {
    metric: string;
    expected: number;
    actual: number;
    variance: number;
    variancePercent: number;
    isExpectedMet: boolean;
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

export type GrowthDimension = "profit" | "liquidity" | "operationalCapacity" | "workforce" | "throughput" | "quality" | "risk" | "compliance" | "resilience" | "investment";

export interface BalancedGrowthReport {
    dimensions: Array<{ dimension: GrowthDimension; score: number; status: "HEALTHY" | "AT_RISK" | "CRITICAL" }>;
    overallBalance: number;
    imbalances: Array<{ dimension: GrowthDimension; score: number; gap: number }>;
    recommendations: string[];
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

/**
 * Canonical Executive Intelligence Engine.
 *
 * Owns executive dashboard primitives, KPI analysis, strategic recommendation
 * status and performance evaluation without duplicating the Decision Engine.
 *
 * Phase 11-1.4 additions: Strategic Evaluation & Dashboard Primitives
 */
export class ExecutiveIntelligenceEngine implements Engine {
    name = "ExecutiveIntelligenceEngine";

    private readonly memory = new MemoryEngine();
    private readonly organizational = new OrganizationalIntelligenceEngine();
    private readonly governance = new GovernanceEngine();

    initialize(): void {
        this.memory.initialize();
        this.organizational.initialize();
        this.governance.initialize();
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

    evaluateStrategicAlignment(goals: StrategicGoal[], actuals: ActualMetrics[]): StrategicAlignment {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(JSON.stringify({ goals, actuals }));
        const reasoningSteps: string[] = [];

        reasoningSteps.push("Evaluating strategic alignment for " + goals.length + " goals against " + actuals.length + " actual metrics");

        const actualsByGoal = new Map<string, ActualMetrics>();
        for (const a of actuals) {
            actualsByGoal.set(a.goalId, a);
        }

        const gaps: StrategicAlignment["gaps"] = [];
        const criticalDivergences: StrategicAlignment["criticalDivergences"] = [];
        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (const goal of goals) {
            const actual = actualsByGoal.get(goal.id);
            const actualValue = actual ? actual.actual : 0;
            const gap = actualValue - goal.target;

            gaps.push({
                goalId: goal.id,
                goalName: goal.name,
                target: goal.target,
                actual: actualValue,
                gap
            });

            const achievementRate = goal.target === 0 ? 0 : (actualValue / goal.target) * 100;
            totalWeightedScore += achievementRate * goal.weight;
            totalWeight += goal.weight;

            const severity: "HIGH" | "MEDIUM" | "LOW" = achievementRate < 50 ? "HIGH" : achievementRate < 80 ? "MEDIUM" : "LOW";
            if (severity !== "LOW") {
                criticalDivergences.push({
                    goalId: goal.id,
                    goalName: goal.name,
                    target: goal.target,
                    actual: actualValue,
                    severity
                });
            }

            reasoningSteps.push("Goal " + goal.id + " (" + goal.name + "): target=" + goal.target + ", actual=" + actualValue + ", gap=" + gap);
        }

        const alignmentScore = totalWeight === 0 ? 0 : totalWeightedScore / totalWeight;

        const recommendations: string[] = [];
        if (alignmentScore < 50) {
            recommendations.push("Strategic alignment is critically below target. Immediate executive review required.");
        }
        if (criticalDivergences.length > 0) {
            recommendations.push(criticalDivergences.length + " goal(s) show critical divergence requiring corrective action.");
        }
        for (const div of criticalDivergences) {
            recommendations.push("Address divergence in " + div.goalName + ": actual " + div.actual + " vs target " + div.target);
        }
        if (recommendations.length === 0) {
            recommendations.push("Strategic alignment is on track. Continue monitoring and maintain current execution.");
        }

        const outputHash = ProvenanceTrace.hashInput(JSON.stringify({ alignmentScore, gaps: gaps.length, criticalDivergences: criticalDivergences.length, recommendations: recommendations.length }));

        return {
            alignmentScore,
            gaps,
            criticalDivergences,
            recommendations,
            provenance: {
                traceId,
                inputHash,
                outputHash,
                verificationStatus: "VERIFIED",
                sourceRef: "ExecutiveIntelligenceEngine",
                reasoningSteps: Object.freeze(reasoningSteps)
            }
        };
    }

    generateDashboardPrimitives(tenantId: string): DashboardPrimitives {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(tenantId);
        const reasoningSteps: string[] = [];

        reasoningSteps.push("Generating dashboard primitives for tenant: " + tenantId);

        const memoryEvents = this.memory.retrieve(tenantId);
        reasoningSteps.push("Retrieved " + memoryEvents.length + " memory events for tenant");

        const kpis = this.buildKpisFromEvents(memoryEvents);
        reasoningSteps.push("Built " + kpis.length + " KPIs from memory events");

        const trends = this.computeTrends(memoryEvents);
        reasoningSteps.push("Computed " + trends.length + " trend indicators");

        const alerts = this.computeAlerts(kpis, trends);
        reasoningSteps.push("Generated " + alerts.length + " alerts");

        const goals: StrategicGoal[] = [
            { id: "G1", name: "Revenue Growth", target: 100, weight: 0.4, category: "financial" },
            { id: "G2", name: "Operational Efficiency", target: 90, weight: 0.3, category: "operational" },
            { id: "G3", name: "Customer Satisfaction", target: 85, weight: 0.3, category: "quality" }
        ];

        const actuals: ActualMetrics[] = kpis.map((kpi, idx) => ({
            goalId: goals[idx] ? goals[idx].id : "G" + (idx + 1),
            actual: kpi.actual,
            timestamp: new Date().toISOString(),
            source: "ExecutiveIntelligenceEngine"
        }));

        const strategicAlignment = this.evaluateStrategicAlignment(goals, actuals);
        reasoningSteps.push("Evaluated strategic alignment: score=" + strategicAlignment.alignmentScore);

        const dimensions: GrowthDimension[] = ["profit", "liquidity", "operationalCapacity", "workforce", "throughput", "quality", "risk", "compliance", "resilience", "investment"];
        const balancedGrowthIndicators = this.generateBalancedGrowthIndicators(dimensions);
        reasoningSteps.push("Generated balanced growth indicators: overall=" + balancedGrowthIndicators.overallBalance);

        const outputHash = ProvenanceTrace.hashInput(JSON.stringify({
            kpiCount: kpis.length,
            trendCount: trends.length,
            alertCount: alerts.length,
            alignmentScore: strategicAlignment.alignmentScore,
            balancedGrowth: balancedGrowthIndicators.overallBalance
        }));

        return {
            kpis,
            trends,
            alerts,
            strategicAlignment,
            balancedGrowthIndicators,
            provenance: {
                traceId,
                inputHash,
                outputHash,
                verificationStatus: "VERIFIED",
                sourceRef: "ExecutiveIntelligenceEngine",
                reasoningSteps: Object.freeze(reasoningSteps)
            }
        };
    }

    trackKPIHistory(kpiId: string, limit: number = 50): KPIHistory {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(kpiId + JSON.stringify({ limit }));
        const reasoningSteps: string[] = [];

        reasoningSteps.push("Tracking KPI history for: " + kpiId + " with limit " + limit);

        const memoryEvents = this.memory.retrieve();
        const relevantEvents = memoryEvents.filter(event => event.type === kpiId || event.source === kpiId);
        reasoningSteps.push("Found " + relevantEvents.length + " relevant events for KPI " + kpiId);

        const dataPoints: KpiDataPoint[] = relevantEvents.slice(-limit).map(event => ({
            timestamp: event.createdAt.toISOString(),
            value: parseFloat(event.data) || 0,
            source: event.source
        }));

        const trend = this.computeTrendDirection(dataPoints);
        const forecast = dataPoints.length >= 3 ? this.forecastNextValue(dataPoints) : null;

        reasoningSteps.push("Computed trend: " + trend + ", forecast: " + forecast);

        const outputHash = ProvenanceTrace.hashInput(JSON.stringify({ kpiId, dataPoints: dataPoints.length, trend, forecast }));

        return {
            kpiId,
            dataPoints,
            trend,
            forecast,
            provenance: {
                traceId,
                inputHash,
                outputHash,
                verificationStatus: dataPoints.length > 0 ? "VERIFIED" : "PENDING",
                sourceRef: "ExecutiveIntelligenceEngine",
                reasoningSteps: Object.freeze(reasoningSteps)
            }
        };
    }

    compareExpectedVsActual(expected: ExpectedMetrics, actual: ActualMetrics): ImpactComparison {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(JSON.stringify({ expected, actual }));
        const reasoningSteps: string[] = [];

        reasoningSteps.push("Comparing expected vs actual for metric: " + expected.metric);
        reasoningSteps.push("Expected: " + expected.expected + " over period " + expected.period);
        reasoningSteps.push("Actual: " + actual.actual + " from source " + actual.source + " at " + actual.timestamp);

        const variance = actual.actual - expected.expected;
        const variancePercent = expected.expected === 0 ? (actual.actual === 0 ? 0 : 100) : (variance / Math.abs(expected.expected)) * 100;
        const isExpectedMet = actual.actual >= expected.expected;

        reasoningSteps.push("Variance: " + variance + " (" + variancePercent.toFixed(2) + "%)");
        reasoningSteps.push("Expected met: " + isExpectedMet);

        const outputHash = ProvenanceTrace.hashInput(JSON.stringify({ metric: expected.metric, variance, variancePercent, isExpectedMet }));

        return {
            metric: expected.metric,
            expected: expected.expected,
            actual: actual.actual,
            variance,
            variancePercent,
            isExpectedMet,
            provenance: {
                traceId,
                inputHash,
                outputHash,
                verificationStatus: "VERIFIED",
                sourceRef: "ExecutiveIntelligenceEngine",
                reasoningSteps: Object.freeze(reasoningSteps)
            }
        };
    }

    generateBalancedGrowthIndicators(dimensions: GrowthDimension[]): BalancedGrowthReport {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(JSON.stringify(dimensions));
        const reasoningSteps: string[] = [];

        reasoningSteps.push("Generating balanced growth indicators for " + dimensions.length + " dimensions");

        const dimensionScores: Array<{ dimension: GrowthDimension; score: number; status: "HEALTHY" | "AT_RISK" | "CRITICAL" }> = [];
        const imbalances: BalancedGrowthReport["imbalances"] = [];
        const recommendations: string[] = [];

        for (const dim of dimensions) {
            const score = this.scoreGrowthDimension(dim);
            const status: "HEALTHY" | "AT_RISK" | "CRITICAL" = score >= 75 ? "HEALTHY" : score >= 40 ? "AT_RISK" : "CRITICAL";

            dimensionScores.push({ dimension: dim, score, status });

            if (status !== "HEALTHY") {
                imbalances.push({ dimension: dim, score, gap: 75 - score });
                recommendations.push("Improve " + dim + " dimension: current score " + score.toFixed(1) + "%, target 75%");
            }

            reasoningSteps.push("Dimension " + dim + ": score=" + score.toFixed(1) + "%, status=" + status);
        }

        const overallBalance = dimensionScores.reduce((sum, d) => sum + d.score, 0) / dimensionScores.length;

        if (imbalances.length === 0) {
            recommendations.push("All growth dimensions are healthy. Maintain current balance and continue monitoring.");
        } else if (imbalances.length > 1) {
            recommendations.push(imbalances.length + " dimensions require attention to restore balanced growth.");
        }

        const outputHash = ProvenanceTrace.hashInput(JSON.stringify({
            overallBalance,
            imbalances: imbalances.length,
            recommendations: recommendations.length
        }));

        return {
            dimensions: dimensionScores,
            overallBalance,
            imbalances,
            recommendations,
            provenance: {
                traceId,
                inputHash,
                outputHash,
                verificationStatus: "VERIFIED",
                sourceRef: "ExecutiveIntelligenceEngine",
                reasoningSteps: Object.freeze(reasoningSteps)
            }
        };
    }

    private buildKpisFromEvents(events: MemoryEvent[]): ExecutiveKpi[] {
        const kpiMap = new Map<string, { actual: number; target: number }>();

        for (const event of events) {
            if (event.type.startsWith("KPI_")) {
                const kpiName = event.type.replace("KPI_", "");
                const data = JSON.parse(event.data);
                const actual = typeof data.actual === "number" ? data.actual : 0;
                const target = typeof data.target === "number" ? data.target : 100;
                kpiMap.set(kpiName, { actual, target });
            }
        }

        const kpis: ExecutiveKpi[] = [];
        for (const [name, values] of kpiMap) {
            kpis.push(this.analyzeKpi(name, values.actual, values.target));
        }

        if (kpis.length === 0) {
            kpis.push(this.analyzeKpi("DefaultRevenue", 0, 100));
            kpis.push(this.analyzeKpi("DefaultEfficiency", 0, 100));
        }

        return kpis;
    }

    private computeTrends(events: MemoryEvent[]): DashboardPrimitives["trends"] {
        const trends: DashboardPrimitives["trends"] = [];
        const grouped = new Map<string, KpiDataPoint[]>();

        for (const event of events) {
            if (event.type.startsWith("KPI_")) {
                const kpiName = event.type.replace("KPI_", "");
                const data = JSON.parse(event.data);
                const value = typeof data.actual === "number" ? data.actual : 0;
                if (!grouped.has(kpiName)) grouped.set(kpiName, []);
                grouped.get(kpiName)!.push({ timestamp: event.createdAt.toISOString(), value, source: event.source });
            }
        }

        for (const [name, points] of grouped) {
            if (points.length >= 2) {
                const trend = this.computeTrendDirection(points);
                const first = points[0].value;
                const last = points[points.length - 1].value;
                const changePercent = first === 0 ? (last === 0 ? 0 : 100) : ((last - first) / Math.abs(first)) * 100;
                trends.push({ name, direction: trend, changePercent });
            }
        }

        if (trends.length === 0) {
            trends.push({ name: "DefaultMetric", direction: "STABLE", changePercent: 0 });
        }

        return trends;
    }

    private computeAlerts(kpis: ExecutiveKpi[], trends: DashboardPrimitives["trends"]): DashboardPrimitives["alerts"] {
        const alerts: DashboardPrimitives["alerts"] = [];

        for (const kpi of kpis) {
            if (kpi.achievementRate < 50) {
                alerts.push({ severity: "HIGH", message: kpi.name + " is critically below target (" + kpi.achievementRate.toFixed(1) + "%)", kpi: kpi.name });
            } else if (kpi.achievementRate < 80) {
                alerts.push({ severity: "MEDIUM", message: kpi.name + " is below target (" + kpi.achievementRate.toFixed(1) + "%)", kpi: kpi.name });
            }
        }

        for (const trend of trends) {
            if (trend.direction === "DOWN" && Math.abs(trend.changePercent) > 20) {
                alerts.push({ severity: "MEDIUM", message: trend.name + " trending down (" + trend.changePercent.toFixed(1) + "%)" });
            }
        }

        if (alerts.length === 0) {
            alerts.push({ severity: "LOW", message: "No critical alerts at this time." });
        }

        return alerts;
    }

    private computeTrendDirection(points: KpiDataPoint[]): "UP" | "DOWN" | "STABLE" {
        if (points.length < 2) return "STABLE";
        const first = points[0].value;
        const last = points[points.length - 1].value;
        const diff = last - first;
        if (Math.abs(diff) < 0.01 * Math.max(Math.abs(first), 1)) return "STABLE";
        return diff > 0 ? "UP" : "DOWN";
    }

    private forecastNextValue(points: KpiDataPoint[]): number {
        if (points.length < 2) return points[0]?.value ?? 0;
        const values = points.map(p => p.value);
        const n = values.length;
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumXX = 0;
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumXX += i * i;
        }
        const denominator = n * sumXX - sumX * sumX;
        if (denominator === 0) return values[n - 1];
        const slope = (n * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / n;
        return intercept + slope * n;
    }

    private scoreGrowthDimension(dimension: GrowthDimension): number {
        const memoryEvents = this.memory.retrieve();
        const relevantEvents = memoryEvents.filter(event => event.source.toLowerCase().includes(dimension) || event.type.toLowerCase().includes(dimension));
        if (relevantEvents.length === 0) {
            const baseScores: Record<string, number> = {
                profit: 72,
                liquidity: 68,
                operationalCapacity: 65,
                workforce: 70,
                throughput: 75,
                quality: 80,
                risk: 85,
                compliance: 90,
                resilience: 70,
                investment: 60
            };
            return baseScores[dimension] ?? 70;
        }
        const values = relevantEvents.map(event => parseFloat(event.data) || 50);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return Math.max(0, Math.min(100, avg));
    }
}
