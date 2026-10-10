/**
 * Phase 12-1.3: Before/After Impact Measurement Service (product service).
 *
 * Provides tenant-scoped before/after impact measurement for executive,
 * financial and operational metrics. Owned by the Executive Intelligence
 * Engine boundary. Reuses OrganizationalIntelligenceEngine learnFromExecution
 * concepts for process metrics, and extends them to financial/executive metrics.
 *
 * IMPORTANT:
 * - Missing baseline or post-intervention data returns NEEDS_DATA, not fabricated impact.
 * - Expected impact is tracked separately from measured actual impact.
 * - Tenant isolation enforced via tenantId.
 * - Provenance preserved for every measurement.
 */

import { ProvenanceTrace } from "../Core/ProvenanceTrace";

export interface BaselineMetrics {
    readonly tenantId: string;
    readonly revenue: number;
    readonly profit: number;
    readonly profitMargin: number;
    readonly debtRatio: number;
    readonly cycleTime: number;
    readonly throughput: number;
    readonly errorRate: number;
    readonly capacity: number;
    readonly operatingCost: number;
    readonly decisionLatency: number;
    readonly riskScore: number;
    readonly recordedAt: string;
}

export interface PostInterventionMetrics {
    readonly tenantId: string;
    readonly revenue: number;
    readonly profit: number;
    readonly profitMargin: number;
    readonly debtRatio: number;
    readonly cycleTime: number;
    readonly throughput: number;
    readonly errorRate: number;
    readonly capacity: number;
    readonly operatingCost: number;
    readonly decisionLatency: number;
    readonly riskScore: number;
    readonly recordedAt: string;
}

export interface ExpectedImpact {
    readonly timeSaved: number;
    readonly costReduced: number;
    readonly capacityRelease: number;
    readonly qualityImprovement: number;
    readonly riskReduction: number;
    readonly financialValue: number;
    readonly roi: number;
}

export interface ImpactMeasurementResult {
    readonly status: "READY" | "BLOCKED" | "NEEDS_DATA";
    readonly tenantId: string;
    readonly measurementId: string;
    readonly baseline: BaselineMetrics;
    readonly postIntervention: PostInterventionMetrics;
    readonly deltas: {
        readonly revenue: number;
        readonly profit: number;
        readonly profitMargin: number;
        readonly debtRatio: number;
        readonly cycleTime: number;
        readonly throughput: number;
        readonly errorRate: number;
        readonly capacity: number;
        readonly operatingCost: number;
        readonly decisionLatency: number;
        readonly riskScore: number;
    };
    readonly percentChanges: {
        readonly revenue: number;
        readonly profit: number;
        readonly profitMargin: number;
        readonly debtRatio: number;
        readonly cycleTime: number;
        readonly throughput: number;
        readonly errorRate: number;
        readonly capacity: number;
        readonly operatingCost: number;
        readonly decisionLatency: number;
        readonly riskScore: number;
    };
    readonly actualImpact: {
        readonly timeSaved: number;
        readonly laborCapacityReleased: number;
        readonly operatingCostReduced: number;
        readonly cycleTimeReduced: number;
        readonly errorRateReduced: number;
        readonly throughputIncreased: number;
        readonly decisionLatencyReduced: number;
        readonly qualityImproved: number;
        readonly riskReduced: number;
        readonly capacityCreated: number;
        readonly actualFinancialValue: number;
        readonly actualROI: number;
        readonly sustainability: "SUSTAINABLE" | "PARTIAL" | "NOT_SUSTAINABLE";
    };
    readonly expectedImpact?: ExpectedImpact;
    readonly provenance: {
        readonly traceId: string;
        readonly inputHash: string;
        readonly outputHash: string;
        readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        readonly sourceRef: string;
        readonly calculatedAt: string;
    };
}

export class ImpactMeasurementService {
    readonly capabilityId = "product.impact-measurement";
    readonly targetEngine = "Executive Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    measure(baseline: BaselineMetrics, post: PostInterventionMetrics, expected?: ExpectedImpact): ImpactMeasurementResult {
        if (!this.validateMetrics(baseline) || !this.validateMetrics(post)) {
            return this.blocked(baseline, post);
        }
        if (baseline.tenantId !== post.tenantId) {
            return this.blocked(baseline, post);
        }
        if (expected !== undefined && !this.validateExpectedImpact(expected)) {
            return this.blocked(baseline, post);
        }

        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = this.hash({ baseline, post, expected });
        const deltas = this.computeDeltas(baseline, post);
        const percentChanges = this.computePercentChanges(baseline, post);
        const actualImpact = this.computeActualImpact(baseline, post, deltas);

        const outputHash = this.hash({ deltas, percentChanges, actualImpact, expectedImpact: expected });

        return {
            status: "READY",
            tenantId: baseline.tenantId,
            measurementId: traceId,
            baseline,
            postIntervention: post,
            deltas,
            percentChanges,
            actualImpact,
            expectedImpact: expected,
            provenance: Object.freeze({
                traceId,
                inputHash,
                outputHash,
                // Arithmetic ran successfully, but independent source evidence
                // is not part of this input contract, so qualification remains pending.
                verificationStatus: "PENDING",
                sourceRef: "ImpactMeasurementService",
                calculatedAt: new Date().toISOString()
            })
        };
    }

    private validateMetrics(m: BaselineMetrics | PostInterventionMetrics | null | undefined): m is BaselineMetrics {
        if (!m || typeof m !== "object") return false;
        if (typeof m.tenantId !== "string" || !m.tenantId.trim() || m.tenantId !== m.tenantId.trim()) return false;
        if (typeof m.recordedAt !== "string" || !Number.isFinite(Date.parse(m.recordedAt))) return false;

        const numericFields = ["revenue", "profit", "profitMargin", "debtRatio", "cycleTime", "throughput", "errorRate", "capacity", "operatingCost", "decisionLatency", "riskScore"];
        for (const f of numericFields) {
            if (!Number.isFinite((m as any)[f])) return false;
        }
        // Profit and margin can legitimately be negative; other metrics in
        // this contract represent non-negative quantities.
        const nonNegativeFields = ["revenue", "debtRatio", "cycleTime", "throughput", "errorRate", "capacity", "operatingCost", "decisionLatency", "riskScore"];
        for (const f of nonNegativeFields) {
            if ((m as any)[f] < 0) return false;
        }
        return true;
    }

    private validateExpectedImpact(expected: ExpectedImpact): boolean {
        const fields: ReadonlyArray<keyof ExpectedImpact> = [
            "timeSaved", "costReduced", "capacityRelease", "qualityImprovement",
            "riskReduction", "financialValue", "roi"
        ];
        if (!fields.every(field => Number.isFinite(expected[field]))) return false;
        return expected.timeSaved >= 0
            && expected.costReduced >= 0
            && expected.capacityRelease >= 0;
    }

    private computeDeltas(b: BaselineMetrics, p: PostInterventionMetrics) {
        return {
            revenue: p.revenue - b.revenue,
            profit: p.profit - b.profit,
            profitMargin: p.profitMargin - b.profitMargin,
            debtRatio: p.debtRatio - b.debtRatio,
            cycleTime: p.cycleTime - b.cycleTime,
            throughput: p.throughput - b.throughput,
            errorRate: p.errorRate - b.errorRate,
            capacity: p.capacity - b.capacity,
            operatingCost: p.operatingCost - b.operatingCost,
            decisionLatency: p.decisionLatency - b.decisionLatency,
            riskScore: p.riskScore - b.riskScore
        };
    }

    private computePercentChanges(b: BaselineMetrics, p: PostInterventionMetrics) {
        const pct = (current: number, base: number) => base === 0 ? (current === 0 ? 0 : 1) : (current - base) / base;
        return {
            revenue: pct(p.revenue, b.revenue),
            profit: pct(p.profit, b.profit),
            profitMargin: pct(p.profitMargin, b.profitMargin),
            debtRatio: pct(p.debtRatio, b.debtRatio),
            cycleTime: pct(p.cycleTime, b.cycleTime),
            throughput: pct(p.throughput, b.throughput),
            errorRate: pct(p.errorRate, b.errorRate),
            capacity: pct(p.capacity, b.capacity),
            operatingCost: pct(p.operatingCost, b.operatingCost),
            decisionLatency: pct(p.decisionLatency, b.decisionLatency),
            riskScore: pct(p.riskScore, b.riskScore)
        };
    }

    private computeActualImpact(b: BaselineMetrics, p: PostInterventionMetrics, deltas: ReturnType<typeof this.computeDeltas>) {
        const timeSaved = Math.max(0, b.cycleTime - p.cycleTime);
        const errorRateReduced = Math.max(0, b.errorRate - p.errorRate);
        const throughputIncreased = Math.max(0, p.throughput - b.throughput);
        const capacityCreated = Math.max(0, p.capacity - b.capacity);
        const operatingCostReduced = Math.max(0, b.operatingCost - p.operatingCost);
        const decisionLatencyReduced = Math.max(0, b.decisionLatency - p.decisionLatency);
        const riskReduced = Math.max(0, b.riskScore - p.riskScore);

        const laborCapacityReleased = throughputIncreased * 0.1 + timeSaved * 0.05;
        const actualFinancialValue = operatingCostReduced + laborCapacityReleased * 100;
        const actualROI = actualFinancialValue > 0 && b.operatingCost > 0 ? actualFinancialValue / b.operatingCost : 0;

        const sustainability: "SUSTAINABLE" | "PARTIAL" | "NOT_SUSTAINABLE" = actualFinancialValue > 0 && timeSaved > 0 && errorRateReduced > 0
            ? "SUSTAINABLE"
            : actualFinancialValue > 0 || timeSaved > 0
                ? "PARTIAL"
                : "NOT_SUSTAINABLE";

        return {
            timeSaved,
            laborCapacityReleased,
            operatingCostReduced,
            cycleTimeReduced: timeSaved,
            errorRateReduced,
            throughputIncreased,
            decisionLatencyReduced,
            qualityImproved: errorRateReduced,
            riskReduced,
            capacityCreated,
            actualFinancialValue,
            actualROI,
            sustainability
        };
    }

    private blocked(
        baseline: BaselineMetrics | null | undefined,
        post: PostInterventionMetrics | null | undefined
    ): ImpactMeasurementResult {
        const traceId = ProvenanceTrace.createTraceId();
        return {
            status: "NEEDS_DATA",
            tenantId: baseline?.tenantId ?? post?.tenantId ?? "",
            measurementId: traceId,
            baseline: baseline ?? this.emptyBaseline(),
            postIntervention: post ?? this.emptyPost(),
            deltas: this.emptyDeltas(),
            percentChanges: this.emptyPercentChanges(),
            actualImpact: this.emptyImpact(),
            provenance: Object.freeze({
                traceId,
                inputHash: "",
                outputHash: "",
                verificationStatus: "FAILED",
                sourceRef: "ImpactMeasurementService",
                calculatedAt: new Date().toISOString()
            })
        };
    }

    private emptyBaseline(): BaselineMetrics {
        return { tenantId: "", revenue: 0, profit: 0, profitMargin: 0, debtRatio: 0, cycleTime: 0, throughput: 0, errorRate: 0, capacity: 0, operatingCost: 0, decisionLatency: 0, riskScore: 0, recordedAt: new Date().toISOString() };
    }

    private emptyPost(): PostInterventionMetrics {
        return { tenantId: "", revenue: 0, profit: 0, profitMargin: 0, debtRatio: 0, cycleTime: 0, throughput: 0, errorRate: 0, capacity: 0, operatingCost: 0, decisionLatency: 0, riskScore: 0, recordedAt: new Date().toISOString() };
    }

    private emptyDeltas() {
        return { revenue: 0, profit: 0, profitMargin: 0, debtRatio: 0, cycleTime: 0, throughput: 0, errorRate: 0, capacity: 0, operatingCost: 0, decisionLatency: 0, riskScore: 0 };
    }

    private emptyPercentChanges() {
        return { revenue: 0, profit: 0, profitMargin: 0, debtRatio: 0, cycleTime: 0, throughput: 0, errorRate: 0, capacity: 0, operatingCost: 0, decisionLatency: 0, riskScore: 0 };
    }

    private emptyImpact() {
        return { timeSaved: 0, laborCapacityReleased: 0, operatingCostReduced: 0, cycleTimeReduced: 0, errorRateReduced: 0, throughputIncreased: 0, decisionLatencyReduced: 0, qualityImproved: 0, riskReduced: 0, capacityCreated: 0, actualFinancialValue: 0, actualROI: 0, sustainability: "NOT_SUSTAINABLE" as const };
    }

    private hash(obj: unknown): string {
        return ProvenanceTrace.hashInput(JSON.stringify(obj) ?? "null");
    }
}
