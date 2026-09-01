/**
 * Phase 06-C - Real Reasoning Pipeline (Phase 06-E Truthful Confidence Fix)
 *
 * Layered reasoning strategy (in order of preference):
 * 1. Deterministic/domain algorithms
 * 2. Evidence-grounded rules
 * 3. Statistical/ML model when justified by available data
 * 4. LLM reasoning only when appropriate
 *
 * Design principles:
 * - Reasoning consumes IntelligenceContext (retrieved knowledge + evidence)
 * - NOT regex-only pattern matching
 * - Produces IntelligenceResult with truthful confidence
 * - Preserves provenance through the pipeline
 *
 * Phase 06-E Truthful Confidence:
 * - DOMAIN_THRESHOLD values (0.1, 0.5, 0.7, 0.9, 1.1, 0.6, 0.3) are retained
 *   as classification boundaries for financial/budget/risk reasoning
 * - FABRICATED confidence values replaced with data-quality-based calculations
 * - Domain values (profitMargin, utilization, riskScore) are NOT confidence
 * - Confidence reflects reasoning certainty based on input data quality
 */

import { IntelligenceInput, IntelligenceContext, IntelligenceResult, TruthfulConfidence, IntelligencePipeline } from "../Core/IntelligenceContract";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";

/**
 * Domain algorithm result
 */
interface DomainAlgorithmResult {
    conclusion: string;
    confidence: TruthfulConfidence;
    reasoningSteps: string[];
    limitations: string[];
    applicable: boolean;
}

/**
 * Evidence-grounded reasoning engine
 *
 * Composes multiple reasoning strategies:
 * - Financial reasoning (deterministic formulas)
 * - Knowledge-grounded reasoning (retrieved context)
 * - Rule-based reasoning (applicable rules)
 */
export class IntelligenceEngine {
    name = "IntelligenceEngine";

    /**
     * Perform reasoning over input with context
     */
    reason(input: IntelligenceInput, context: IntelligenceContext): IntelligenceResult {
        const traceId = IntelligencePipeline.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(input.problem);

        // Layer 1: Try deterministic domain algorithms first
        const domainResult = this.tryDomainAlgorithms(input, context);
        if (domainResult.applicable) {
            return this.buildResult(
                traceId,
                inputHash,
                domainResult.conclusion,
                domainResult.confidence,
                domainResult.reasoningSteps,
                domainResult.limitations,
                true,
                "reasoned_domain"
            );
        }

        // Layer 2: Evidence-grounded reasoning from retrieved knowledge
        const knowledgeResult = this.reasonWithKnowledge(input, context);
        if (knowledgeResult.applicable) {
            return this.buildResult(
                traceId,
                inputHash,
                knowledgeResult.conclusion,
                knowledgeResult.confidence,
                knowledgeResult.reasoningSteps,
                knowledgeResult.limitations,
                true,
                "reasoned_knowledge"
            );
        }

        // Layer 3: Rule-based reasoning
        const ruleResult = this.reasonWithRules(input, context);
        if (ruleResult.applicable) {
            return this.buildResult(
                traceId,
                inputHash,
                ruleResult.conclusion,
                ruleResult.confidence,
                ruleResult.reasoningSteps,
                ruleResult.limitations,
                true,
                "reasoned_rule"
            );
        }

        // No reasoning method applicable
        return this.buildResult(
            traceId,
            inputHash,
            "Insufficient context for reasoning",
            IntelligencePipeline.unavailable(),
            ["No applicable reasoning method found"],
            ["No relevant knowledge or evidence available", "Cannot reason without domain data or rules"],
            false,
            "insufficient_context"
        );
    }

    /**
     * Layer 1: Deterministic domain algorithms
     * Applies when input contains financial/business metrics
     */
    private tryDomainAlgorithms(input: IntelligenceInput, context: IntelligenceContext): DomainAlgorithmResult {
        const data = input.data;
        if (!data) {
            return { applicable: false, conclusion: "", confidence: IntelligencePipeline.unavailable(), reasoningSteps: [], limitations: [] };
        }

        // Financial analysis path
        if (this.hasFinancialMetrics(data)) {
            return this.reasonFinancial(input, context);
        }

        // Budget analysis path
        if (this.hasBudgetMetrics(data)) {
            return this.reasonBudget(input, context);
        }

        // Risk assessment path
        if (this.hasRiskMetrics(data)) {
            return this.reasonRisk(input, context);
        }

        return { applicable: false, conclusion: "", confidence: IntelligencePipeline.unavailable(), reasoningSteps: [], limitations: [] };
    }

    /**
     * Financial domain reasoning
     */
    private reasonFinancial(input: IntelligenceInput, context: IntelligenceContext): DomainAlgorithmResult {
        const data = input.data!;
        const steps: string[] = [];

        const revenue = this.getNumber(data, "revenue");
        const expenses = this.getNumber(data, "expenses");
        const assets = this.getNumber(data, "assets");
        const liabilities = this.getNumber(data, "liabilities");

        steps.push(`Analyzed revenue: ${revenue}, expenses: ${expenses}, assets: ${assets}, liabilities: ${liabilities}`);

        const profit = revenue - expenses;
        steps.push(`Calculated profit: ${profit}`);

        const profitMargin = revenue > 0 ? profit / revenue : 0;
        steps.push(`Calculated profit margin: ${(profitMargin * 100).toFixed(2)}%`);

        const debtRatio = assets > 0 ? liabilities / assets : 0;
        steps.push(`Calculated debt ratio: ${(debtRatio * 100).toFixed(2)}%`);

        // Generate conclusion based on financial health
        // Phase 06-E: Domain thresholds retained for classification, but
        // confidence is now based on DATA QUALITY, not domain values
        let conclusion: string;
        let confidence: TruthfulConfidence;

        // Calculate data quality for confidence basis
        const dataQuality = this.calculateDataQuality(data, ["revenue", "expenses", "assets", "liabilities"]);
        const qualityBasedConfidence = dataQuality / 100;

        if (profitMargin >= 0.1 && debtRatio < 0.5) {
            conclusion = "Financial health: GOOD. Profit margin is healthy and debt ratio is acceptable.";
            // Phase 06-E: Confidence based on data quality only
            // Domain severity does NOT attenuate confidence
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                qualityBasedConfidence,
                "data_completeness",
                `Data quality: ${dataQuality}%. Metrics: profitMargin=${profitMargin.toFixed(3)}, debtRatio=${debtRatio.toFixed(3)}. Note: profitMargin is domain value, not confidence.`
            );
        } else if (profitMargin >= 0 && debtRatio < 0.7) {
            conclusion = "Financial health: MARGINAL. Consider improving profit margin or reducing debt.";
            // Phase 06-E FIX: Removed undocumented multiplier (* 0.6)
            // Domain severity must NOT attenuate confidence
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                qualityBasedConfidence,
                "data_completeness",
                `Data quality: ${dataQuality}%. Metrics: profitMargin=${profitMargin.toFixed(3)}, debtRatio=${debtRatio.toFixed(3)}. Note: domain severity does not affect confidence.`
            );
        } else {
            conclusion = "Financial health: AT RISK. Immediate attention required to improve profitability or reduce debt.";
            // Phase 06-E FIX: Removed undocumented multiplier (* 0.75)
            // Domain severity must NOT attenuate confidence
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                qualityBasedConfidence,
                "data_completeness",
                `Data quality: ${dataQuality}%. Metrics: profitMargin=${profitMargin.toFixed(3)}, debtRatio=${debtRatio.toFixed(3)}. Note: domain severity does not affect confidence.`
            );
        }

        // Add knowledge context if available
        const relevantKnowledge = context.knowledgeItems.slice(0, 3);
        if (relevantKnowledge.length > 0) {
            steps.push(`Considered ${relevantKnowledge.length} relevant knowledge items`);
        }

        return {
            applicable: true,
            conclusion,
            confidence,
            reasoningSteps: steps,
            limitations: [
                "Analysis based on provided metrics only",
                "Historical trends not considered",
                "Industry benchmarks not applied"
            ]
        };
    }

    /**
     * Budget domain reasoning
     */
    private reasonBudget(input: IntelligenceInput, context: IntelligenceContext): DomainAlgorithmResult {
        const data = input.data!;
        const steps: string[] = [];

        const planned = this.getNumber(data, "planned");
        const actual = this.getNumber(data, "actual");

        steps.push(`Analyzed planned: ${planned}, actual: ${actual}`);

        const variance = actual - planned;
        steps.push(`Calculated variance: ${variance}`);

        const utilization = planned > 0 ? actual / planned : 0;
        steps.push(`Calculated utilization: ${(utilization * 100).toFixed(2)}%`);

        let conclusion: string;
        let confidence: TruthfulConfidence;

        // Phase 06-E: Domain thresholds retained for budget classification
        // Confidence is based on data quality, not budget utilization value
        const dataQuality = this.calculateDataQuality(data, ["planned", "actual"]);
        const qualityBasedConfidence = dataQuality / 100;

        if (utilization >= 0.9 && utilization <= 1.1) {
            conclusion = "Budget status: ON TRACK. Actual spending is within acceptable variance of plan.";
            // Phase 06-E FIX: Confidence based on data quality, not utilization value
            // Utilization is a domain metric, not a confidence score
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                qualityBasedConfidence,
                "data_completeness",
                `Data quality: ${dataQuality}%. Utilization: ${utilization.toFixed(3)} (within 90%-110% range). Note: utilization is domain value, not confidence.`
            );
        } else if (utilization > 1.1) {
            conclusion = "Budget status: OVER BUDGET. Actual spending exceeds plan.";
            // Phase 06-E FIX: Confidence based on data quality
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                qualityBasedConfidence,
                "data_completeness",
                `Data quality: ${dataQuality}%. Utilization: ${utilization.toFixed(3)} exceeds 110%.`
            );
        } else {
            conclusion = "Budget status: UNDER BUDGET. Actual spending is below plan.";
            // Phase 06-E FIX: Confidence based on data quality
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                qualityBasedConfidence,
                "data_completeness",
                `Data quality: ${dataQuality}%. Utilization: ${utilization.toFixed(3)} below 90%.`
            );
        }

        return {
            applicable: true,
            conclusion,
            confidence,
            reasoningSteps: steps,
            limitations: [
                "Variance analysis not performed",
                "Root cause not identified"
            ]
        };
    }

    /**
     * Risk domain reasoning
     */
    private reasonRisk(input: IntelligenceInput, context: IntelligenceContext): DomainAlgorithmResult {
        const data = input.data!;
        const steps: string[] = [];

        const probability = this.getNumber(data, "probability");
        const impact = this.getNumber(data, "impact");

        steps.push(`Analyzed risk: probability=${probability}, impact=${impact}`);

        const riskScore = probability * impact;
        steps.push(`Calculated risk score: ${riskScore.toFixed(3)}`);

        let conclusion: string;
        let confidence: TruthfulConfidence;

        // Phase 06-E: Domain threshold (0.6, 0.3) retained for risk classification
        // Confidence is based on data quality, not riskScore value
        const dataQuality = this.calculateDataQuality(data, ["probability", "impact"]);
        const qualityBasedConfidence = dataQuality / 100;

        if (riskScore >= 0.6) {
            conclusion = "Risk level: HIGH. Immediate mitigation required.";
            // Phase 06-E FIX: Confidence based on data quality, not riskScore value
            // riskScore is a domain metric (probability * impact), not a confidence score
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                qualityBasedConfidence,
                "data_completeness",
                `Data quality: ${dataQuality}%. High risk score: ${riskScore.toFixed(3)}. Note: riskScore is domain value, not confidence.`
            );
        } else if (riskScore >= 0.3) {
            conclusion = "Risk level: MEDIUM. Monitoring and mitigation planning recommended.";
            // Phase 06-E FIX: Confidence based on data quality
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                qualityBasedConfidence,
                "data_completeness",
                `Data quality: ${dataQuality}%. Medium risk score: ${riskScore.toFixed(3)}.`
            );
        } else {
            conclusion = "Risk level: LOW. Continue monitoring.";
            // Phase 06-E FIX: Confidence based on data quality
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                qualityBasedConfidence,
                "data_completeness",
                `Data quality: ${dataQuality}%. Low risk score: ${riskScore.toFixed(3)}.`
            );
        }

        return {
            applicable: true,
            conclusion,
            confidence,
            reasoningSteps: steps,
            limitations: [
                "Risk assessment based on provided probability and impact only",
                "External risk factors not considered"
            ]
        };
    }

    /**
     * Layer 2: Knowledge-grounded reasoning
     */
    private reasonWithKnowledge(input: IntelligenceInput, context: IntelligenceContext): DomainAlgorithmResult {
        const knowledgeItems = context.knowledgeItems;
        if (knowledgeItems.length === 0) {
            return { applicable: false, conclusion: "", confidence: IntelligencePipeline.unavailable(), reasoningSteps: [], limitations: [] };
        }

        const steps: string[] = [];
        steps.push(`Reasoning with ${knowledgeItems.length} knowledge items`);

        // Summarize relevant knowledge
        const relevantTitles = knowledgeItems.slice(0, 3).map(k => k.title);
        steps.push(`Relevant knowledge: ${relevantTitles.join(", ")}`);

        // Check knowledge freshness
        const staleItems = knowledgeItems.filter(k => {
            const age = Date.now() - new Date(k.createdAt).getTime();
            return age > 30 * 24 * 60 * 60 * 1000;
        });
        if (staleItems.length > 0) {
            steps.push(`Warning: ${staleItems.length} knowledge items are stale`);
        }

        // Calculate average confidence from knowledge
        const confidences = knowledgeItems
            .map(k => k.confidence)
            .filter((c): c is number => c !== undefined);

        let confidence: TruthfulConfidence;
        if (confidences.length > 0) {
            const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
            confidence = IntelligencePipeline.fromCalculatedConfidence(
                avgConfidence,
                "average_knowledge_confidence",
                `Average of ${confidences.length} knowledge item confidences`
            );
        } else {
            confidence = IntelligencePipeline.unavailable();
        }

        const conclusion = `Based on ${knowledgeItems.length} knowledge items, the relevant context suggests considering prior insights when making decisions.`;

        return {
            applicable: true,
            conclusion,
            confidence,
            reasoningSteps: steps,
            limitations: [
                "Knowledge-grounded reasoning depends on knowledge quality",
                "Stale knowledge may lead to outdated conclusions"
            ]
        };
    }

    /**
     * Layer 3: Rule-based reasoning
     */
    private reasonWithRules(input: IntelligenceInput, context: IntelligenceContext): DomainAlgorithmResult {
        // Check if problem matches any known rules
        const problem = input.problem.toLowerCase();

        // Phase 06-E: Rule-based routing has no defensible confidence basis
        // Simple keyword matching does not provide certainty about routing recommendations
        // Therefore confidence is UNAVAILABLE - not a fabricated 0.8
        const rules: Array<{ pattern: string; conclusion: string }> = [
            {
                pattern: "kpi",
                conclusion: "KPI analysis requested. Consider using ExecutiveIntelligenceEngine.analyzeKPI() for structured KPI evaluation."
            },
            {
                pattern: "budget",
                conclusion: "Budget analysis requested. Consider using BudgetIntelligenceEngine.analyze() for variance analysis."
            },
            {
                pattern: "risk",
                conclusion: "Risk assessment requested. Consider using RiskIntelligenceEngine.assess() for probability/impact analysis."
            },
            {
                pattern: "financial",
                conclusion: "Financial analysis requested. Consider using FinancialIntelligenceEngine.analyze() for comprehensive financial evaluation."
            }
        ];

        for (const rule of rules) {
            if (problem.includes(rule.pattern)) {
                return {
                    applicable: true,
                    conclusion: rule.conclusion,
                    confidence: IntelligencePipeline.unavailable(),
                    reasoningSteps: [`Matched rule pattern: "${rule.pattern}"`],
                    limitations: ["Rule-based routing only, not deep reasoning", "Confidence unavailable for simple keyword-based routing"]
                };
            }
        }

        return { applicable: false, conclusion: "", confidence: IntelligencePipeline.unavailable(), reasoningSteps: [], limitations: [] };
    }

    private buildResult(
        traceId: string,
        inputHash: string,
        conclusion: string,
        confidence: TruthfulConfidence,
        reasoningSteps: string[],
        limitations: string[],
        success: boolean,
        status: string
    ): IntelligenceResult {
        return {
            traceId,
            conclusion,
            confidence,
            limitations: Object.freeze([...limitations]),
            reasoningSteps: Object.freeze([...reasoningSteps]),
            success,
            status,
            inputHash,
            outputHash: success ? ProvenanceTrace.hashInput(conclusion) : undefined
        };
    }

    private hasFinancialMetrics(data: Record<string, unknown>): boolean {
        return this.hasAll(data, ["revenue", "expenses"]) ||
               this.hasAll(data, ["profit", "profitMargin"]) ||
               this.hasAll(data, ["assets", "liabilities"]);
    }

    private hasBudgetMetrics(data: Record<string, unknown>): boolean {
        return this.hasAll(data, ["planned", "actual"]);
    }

    private hasRiskMetrics(data: Record<string, unknown>): boolean {
        return this.hasAll(data, ["probability", "impact"]);
    }

    private hasAll(data: Record<string, unknown>, keys: string[]): boolean {
        return keys.every(k => typeof data[k] === "number" && Number.isFinite(data[k] as number));
    }

    private getNumber(data: Record<string, unknown>, key: string): number {
        const val = data[key];
        return typeof val === "number" && Number.isFinite(val) ? val : 0;
    }

    private calculateDataQuality(data: Record<string, unknown>, keys: string[]): number {
        const present = keys.filter(k => typeof data[k] === "number" && Number.isFinite(data[k] as number)).length;
        return Math.round((present / keys.length) * 100);
    }
}
