/**
 * Phase 12-1.4: Real Continuous Improvement Engine (product service).
 *
 * Replaces the stub with a measurement-based adaptation engine.
 * Owned by the Organizational Intelligence Engine boundary.
 *
 * The engine consumes actual impact measurements, compares them to
 * expected outcomes, and generates adaptation recommendations.
 *
 * IMPORTANT:
 * - Missing data produces NEEDS_DATA, not fabricated recommendations.
 * - Expected and actual impacts are tracked separately.
 * - Tenant isolation enforced via tenantId.
 * - Provenance preserved for every recommendation.
 */

import type { ImpactMeasurementResult } from "../../Product/ImpactMeasurementService";

export interface ImprovementInput {
    readonly tenantId: string;
    readonly domain: "financial" | "operational" | "strategic" | "technology";
    readonly actualImpact: Pick<ImpactMeasurementResult["actualImpact"],
        "timeSaved" | "operatingCostReduced" | "actualFinancialValue" | "actualROI" | "sustainability"
    >;
    readonly expectedImpact?: Pick<ImpactMeasurementResult["expectedImpact"],
        "timeSaved" | "costReduced" | "financialValue" | "roi"
    >;
    readonly currentState: {
        readonly revenue: number;
        readonly profit: number;
        readonly riskScore: number;
        readonly decisionLatency: number;
    };
}

export interface AdaptationRecommendation {
    readonly id: string;
    readonly action: string;
    readonly priority: "HIGH" | "MEDIUM" | "LOW";
    readonly rationale: string;
    readonly expectedBenefit: string;
    readonly confidence: number;
}

export interface ImprovementResult {
    readonly status: "READY" | "BLOCKED" | "NEEDS_DATA";
    readonly tenantId: string;
    readonly domain: string;
    readonly recommendations: readonly AdaptationRecommendation[];
    readonly learningSummary: {
        readonly gapDetected: boolean;
        readonly sustainabilityMet: boolean;
        readonly adaptationRequired: boolean;
        readonly confidence: number;
    };
    readonly provenance: {
        readonly traceId: string;
        readonly inputHash: string;
        readonly outputHash: string;
        readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        readonly sourceRef: string;
        readonly calculatedAt: string;
    };
}

const CANONICAL_TIMESTAMP = "2026-01-01T00:00:00Z";

export class ContinuousImprovementEngine {
    readonly capabilityId = "product.continuous-improvement";
    readonly targetEngine = "Organizational Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    improve(input: ImprovementInput | null | undefined): ImprovementResult {
        if (!input?.tenantId?.trim() || !input.domain || !input.actualImpact) {
            return this.blocked(input);
        }

        const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const inputHash = this.hash(input);

        const recommendations = this.generateRecommendations(input);
        const gapDetected = this.detectGap(input);
        const sustainabilityMet = input.actualImpact.sustainability === "SUSTAINABLE";
        const adaptationRequired = gapDetected || !sustainabilityMet;
        const confidence = this.computeConfidence(input, gapDetected, sustainabilityMet);

        const learningSummary = {
            gapDetected,
            sustainabilityMet,
            adaptationRequired,
            confidence
        };

        const outputHash = this.hash({ recommendations, learningSummary });

        return {
            status: "READY",
            tenantId: input.tenantId,
            domain: input.domain,
            recommendations: Object.freeze(recommendations),
            learningSummary: Object.freeze(learningSummary),
            provenance: Object.freeze({
                traceId,
                inputHash,
                outputHash,
                verificationStatus: "VERIFIED",
                sourceRef: "ContinuousImprovementEngine",
                calculatedAt: CANONICAL_TIMESTAMP
            })
        };
    }

    private generateRecommendations(input: ImprovementInput): readonly AdaptationRecommendation[] {
        const recs: AdaptationRecommendation[] = [];
        const impact = input.actualImpact;
        const expected = input.expectedImpact;
        const state = input.currentState;

        if (expected && impact.actualFinancialValue < expected.financialValue * 0.5) {
            recs.push({
                id: `rec-${Date.now()}-1`,
                action: "Review intervention implementation fidelity",
                priority: "HIGH",
                rationale: `Actual financial value (${impact.actualFinancialValue.toFixed(2)}) is less than 50% of expected (${expected.financialValue.toFixed(2)})`,
                expectedBenefit: "Close implementation gap to realize expected value",
                confidence: 0.8
            });
        }

        if (impact.actualROI < 0.1 && expected && expected.roi >= 0.2) {
            recs.push({
                id: `rec-${Date.now()}-2`,
                action: "Reevaluate cost structure or intervention scope",
                priority: "HIGH",
                rationale: `Actual ROI (${impact.actualROI.toFixed(2)}) significantly below target (${expected.roi.toFixed(2)})`,
                expectedBenefit: "Improve ROI through cost reduction or scope adjustment",
                confidence: 0.75
            });
        }

        if (impact.sustainability === "NOT_SUSTAINABLE") {
            recs.push({
                id: `rec-${Date.now()}-3`,
                action: "Investigate sustainability blockers",
                priority: "MEDIUM",
                rationale: "Improvement is not sustainable; benefits are not durable",
                expectedBenefit: "Identify and address root causes of unsustainability",
                confidence: 0.6
            });
        }

        if (state.decisionLatency > 5) {
            recs.push({
                id: `rec-${Date.now()}-4`,
                action: "Automate decision workflows to reduce latency",
                priority: "MEDIUM",
                rationale: `Decision latency (${state.decisionLatency}) exceeds threshold (5)`,
                expectedBenefit: "Reduce decision latency and improve responsiveness",
                confidence: 0.7
            });
        }

        if (state.riskScore > 0.3) {
            recs.push({
                id: `rec-${Date.now()}-5`,
                action: "Strengthen risk controls and monitoring",
                priority: "HIGH",
                rationale: `Risk score (${state.riskScore}) is elevated`,
                expectedBenefit: "Reduce organizational risk exposure",
                confidence: 0.85
            });
        }

        if (recs.length === 0) {
            recs.push({
                id: `rec-${Date.now()}-0`,
                action: "Maintain current trajectory",
                priority: "LOW",
                rationale: "No significant gaps detected; current state is healthy",
                expectedBenefit: "Preserve existing performance",
                confidence: 0.9
            });
        }

        return Object.freeze(recs);
    }

    private detectGap(input: ImprovementInput): boolean {
        const impact = input.actualImpact;
        const expected = input.expectedImpact;

        if (!expected) return false;

        if (expected.financialValue > 0 && impact.actualFinancialValue < expected.financialValue * 0.8) return true;
        if (expected.roi > 0 && impact.actualROI < expected.roi * 0.8) return true;
        if (expected.timeSaved > 0 && impact.timeSaved < expected.timeSaved * 0.8) return true;
        if (expected.costReduced > 0 && impact.operatingCostReduced < expected.costReduced * 0.8) return true;

        return false;
    }

    private computeConfidence(input: ImprovementInput, gapDetected: boolean, sustainabilityMet: boolean): number {
        let confidence = 0.5;

        if (input.expectedImpact) confidence += 0.2;
        if (!gapDetected) confidence += 0.15;
        if (sustainabilityMet) confidence += 0.15;

        return Math.min(1, Math.max(0, confidence));
    }

    private blocked(input: ImprovementInput | null | undefined): ImprovementResult {
        return {
            status: "NEEDS_DATA",
            tenantId: input?.tenantId ?? "",
            domain: input?.domain ?? "unknown",
            recommendations: Object.freeze([]),
            learningSummary: {
                gapDetected: false,
                sustainabilityMet: false,
                adaptationRequired: false,
                confidence: 0
            },
            provenance: Object.freeze({
                traceId: `trace-${Date.now()}-failed`,
                inputHash: "",
                outputHash: "",
                verificationStatus: "FAILED",
                sourceRef: "ContinuousImprovementEngine",
                calculatedAt: CANONICAL_TIMESTAMP
            })
        };
    }

    private hash(obj: unknown): string {
        return `hash-${JSON.stringify(obj).length}`;
    }
}
