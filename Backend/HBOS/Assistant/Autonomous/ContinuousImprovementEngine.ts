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

import { ProvenanceTrace } from "../../Core/ProvenanceTrace";
import type { ImpactMeasurementResult } from "../../Product/ImpactMeasurementService";

export type LearningQualification = "QUALIFIED" | "REVIEW_REQUIRED" | "NEEDS_DATA";

export type MeasurementProvenance = Pick<
    ImpactMeasurementResult["provenance"],
    "traceId" | "inputHash" | "outputHash" | "verificationStatus" | "sourceRef" | "calculatedAt"
>;

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
    /** Evidence carried from the canonical before/after measurement. */
    readonly measurementProvenance?: MeasurementProvenance;
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
    /** READY means the rule workflow executed; qualification is reported separately. */
    readonly status: "READY" | "BLOCKED" | "NEEDS_DATA";
    readonly learningQualification: LearningQualification;
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
        readonly measurementTraceId?: string;
    };
}

export class ContinuousImprovementEngine {
    readonly capabilityId = "product.continuous-improvement";
    readonly targetEngine = "Organizational Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    improve(input: ImprovementInput | null | undefined): ImprovementResult {
        if (!this.validateInput(input)) {
            return this.blocked(input);
        }

        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = this.hash(input);
        const qualified = this.hasVerifiedMeasurement(input.measurementProvenance);
        const recommendationCandidates = this.generateRecommendations(input);
        // Never expose heuristic recommendation confidence while its source
        // measurement is not qualified.
        const recommendations = qualified
            ? recommendationCandidates
            : recommendationCandidates.map(recommendation => ({ ...recommendation, confidence: 0 }));
        const gapDetected = this.detectGap(input);
        const sustainabilityMet = input.actualImpact.sustainability === "SUSTAINABLE";
        const adaptationRequired = gapDetected || !sustainabilityMet;
        const learningQualification: LearningQualification = qualified ? "QUALIFIED" : "REVIEW_REQUIRED";
        // Heuristic rules do not constitute evidence-backed confidence.
        const confidence = qualified
            ? this.computeConfidence(input, gapDetected, sustainabilityMet)
            : 0;

        const learningSummary = { gapDetected, sustainabilityMet, adaptationRequired, confidence };
        const outputHash = this.hash({ recommendations, learningSummary, learningQualification });

        return {
            status: "READY",
            learningQualification,
            tenantId: input.tenantId,
            domain: input.domain,
            recommendations: Object.freeze(recommendations),
            learningSummary: Object.freeze(learningSummary),
            provenance: Object.freeze({
                traceId,
                inputHash,
                outputHash,
                verificationStatus: qualified ? "VERIFIED" : "PENDING",
                sourceRef: "ContinuousImprovementEngine",
                calculatedAt: new Date().toISOString(),
                measurementTraceId: input.measurementProvenance?.traceId
            })
        };
    }

    /**
     * Use measured before/after impact as the source of learning inputs.
     * Tenant scope must match exactly. Pending source evidence can produce
     * candidate recommendations for review, never a qualified learning claim.
     */
    improveFromMeasurement(
        measurement: ImpactMeasurementResult | null | undefined,
        currentState: ImprovementInput["currentState"],
        tenantId: string
    ): ImprovementResult {
        if (!measurement || measurement.status !== "READY"
            || typeof tenantId !== "string" || !tenantId.trim()
            || measurement.tenantId !== tenantId) {
            return this.blocked({ tenantId: typeof tenantId === "string" ? tenantId : "" });
        }

        return this.improve({
            tenantId,
            domain: "operational",
            actualImpact: {
                timeSaved: measurement.actualImpact.timeSaved,
                operatingCostReduced: measurement.actualImpact.operatingCostReduced,
                actualFinancialValue: measurement.actualImpact.actualFinancialValue,
                actualROI: measurement.actualImpact.actualROI,
                sustainability: measurement.actualImpact.sustainability
            },
            ...(measurement.expectedImpact ? {
                expectedImpact: {
                    timeSaved: measurement.expectedImpact.timeSaved,
                    costReduced: measurement.expectedImpact.costReduced,
                    financialValue: measurement.expectedImpact.financialValue,
                    roi: measurement.expectedImpact.roi
                }
            } : {}),
            currentState,
            measurementProvenance: measurement.provenance
        });
    }

    private validateInput(input: ImprovementInput | null | undefined): input is ImprovementInput {
        if (!input || typeof input.tenantId !== "string" || !input.tenantId.trim()) return false;
        if (!["financial", "operational", "strategic", "technology"].includes(input.domain)) return false;
        if (!input.actualImpact || !input.currentState) return false;

        const actualFields = ["timeSaved", "operatingCostReduced", "actualFinancialValue", "actualROI"];
        const actual = input.actualImpact as unknown as Record<string, number>;
        if (!actualFields.every(field => Number.isFinite(actual[field]))) return false;
        if (input.actualImpact.timeSaved < 0 || input.actualImpact.operatingCostReduced < 0
            || input.actualImpact.actualFinancialValue < 0) return false;
        if (!["SUSTAINABLE", "PARTIAL", "NOT_SUSTAINABLE"].includes(input.actualImpact.sustainability)) return false;

        const stateFields = ["revenue", "profit", "riskScore", "decisionLatency"];
        const state = input.currentState as unknown as Record<string, number>;
        if (!stateFields.every(field => Number.isFinite(state[field]))) return false;
        if (input.currentState.riskScore < 0 || input.currentState.decisionLatency < 0) return false;

        if (input.expectedImpact) {
            const expectedFields = ["timeSaved", "costReduced", "financialValue", "roi"];
            const expected = input.expectedImpact as unknown as Record<string, number>;
            if (!expectedFields.every(field => Number.isFinite(expected[field]))) return false;
            if (input.expectedImpact.timeSaved < 0 || input.expectedImpact.costReduced < 0) return false;
        }
        return true;
    }

    private hasVerifiedMeasurement(provenance?: MeasurementProvenance): boolean {
        return !!provenance
            && provenance.verificationStatus === "VERIFIED"
            && !!provenance.traceId?.trim()
            && /^[a-f0-9]{64}$/i.test(provenance.inputHash)
            && /^[a-f0-9]{64}$/i.test(provenance.outputHash)
            && !!provenance.sourceRef?.trim()
            && Number.isFinite(Date.parse(provenance.calculatedAt));
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

    private blocked(input: Partial<ImprovementInput> | null | undefined): ImprovementResult {
        const traceId = ProvenanceTrace.createTraceId();
        return {
            status: "NEEDS_DATA",
            learningQualification: "NEEDS_DATA",
            tenantId: typeof input?.tenantId === "string" ? input.tenantId : "",
            domain: input?.domain ?? "unknown",
            recommendations: Object.freeze([]),
            learningSummary: {
                gapDetected: false,
                sustainabilityMet: false,
                adaptationRequired: false,
                confidence: 0
            },
            provenance: Object.freeze({
                traceId,
                inputHash: input ? this.hash(input) : "",
                outputHash: this.hash({ status: "NEEDS_DATA", traceId }),
                verificationStatus: "FAILED",
                sourceRef: "ContinuousImprovementEngine",
                calculatedAt: new Date().toISOString(),
                measurementTraceId: input?.measurementProvenance?.traceId
            })
        };
    }

    private hash(obj: unknown): string {
        return ProvenanceTrace.hashInput(JSON.stringify(obj) ?? "null");
    }
}
