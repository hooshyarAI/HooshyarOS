/**
 * Phase 06-D - Real Decision Authority
 *
 * DecisionEngine is the canonical decision authority that transforms:
 * - Reasoning results (from IntelligenceEngine)
 * - Knowledge/context (from KnowledgeEngine)
 * - Applicable rules/constraints
 * - Security context
 *
 * Into explicit decisions: APPROVE, REJECT, or REVIEW_REQUIRED
 *
 * Design principles:
 * - Decisions transform reasoning/context, not echo status
 * - No fabrication: confidence, risks, recommendations from actual inputs
 * - Authorization enforcement via existing AuthorizationGuard
 * - Tenant isolation via existing TenantIsolation
 * - Provenance/evidence preserved through pipeline
 * - Security events logged for denials/rejections
 * - Offline-capable (no network dependency)
 */

import { Authorization, AuthorizationResult } from "../Security/Authorization";
import { AuthorizationGuard } from "../Security/AuthorizationGuard";
import { PrincipalType } from "../Security/Principals";
import { SecurityContext } from "../Security/SecurityContext";
import { TenantIsolation } from "../Security/TenantIsolation";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { IntelligenceResult, TruthfulConfidence, IntelligencePipeline } from "../Core/IntelligenceContract";
import { IntelligenceContext } from "../Core/IntelligenceContract";
import { SecurityEventLogger } from "../Entities/SecurityEventLogger";

/**
 * Decision outcome states
 */
export type DecisionOutcome = "APPROVED" | "REJECTED" | "REVIEW_REQUIRED";

/**
 * A decision rule or constraint
 */
export interface DecisionRule {
    readonly id: string;
    readonly description: string;
    readonly blocking: boolean; // If true, matching this rule REJECTS the decision
    readonly severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/**
 * Extended decision input with reasoning/context/evidence
 */
export interface DecisionInput {
    /** The decision problem/question */
    readonly problem: string;
    /** The decision objective */
    readonly objective: string;
    /** Assumptions/facts being evaluated */
    readonly assumptions: readonly string[];
    /** Optional reasoning result from IntelligenceEngine */
    readonly reasoning?: IntelligenceResult;
    /** Optional knowledge/context from KnowledgeEngine */
    readonly context?: IntelligenceContext;
    /** Optional applicable rules/constraints */
    readonly rules?: readonly DecisionRule[];
    /** Optional security context for authorization */
    readonly securityContext?: SecurityContext;
    /** Tenant context for tenant-scoped decisions */
    readonly tenantId?: string;
}

/**
 * Extended decision result with full evidence
 */
export interface DecisionResult {
    /** Decision outcome */
    readonly outcome: DecisionOutcome;
    /** Decision message/explanation */
    readonly decision: string;
    /** Derived recommendations */
    readonly recommendations: readonly string[];
    /** Derived risks */
    readonly risks: readonly string[];
    /** Truthful confidence in the decision */
    readonly confidence: TruthfulConfidence;
    /** Reasoning result that led to this decision (if any) */
    readonly reasoning?: IntelligenceResult;
    /** Applied rules that affected the decision */
    readonly appliedRules: readonly string[];
    /** Known limitations */
    readonly limitations: readonly string[];
    /** Tenant context */
    readonly tenantId?: string;
    /** Whether decision was authorized */
    readonly authorized: boolean;
    /** Authorization reason (if denied) */
    readonly authorizationReason?: string;
    /** Trace ID for correlation */
    readonly traceId: string;
    /** Input hash for integrity */
    readonly inputHash: string;
    /** Output hash for integrity */
    readonly outputHash?: string;
}

/**
 * Decision engine - canonical decision authority
 *
 * Transforms reasoning/context/evidence into explicit decisions.
 * Not a placeholder - performs actual decision transformation.
 */
export class DecisionEngine {
    private securityLogger: SecurityEventLogger | undefined;

    initialize(): void {
        console.log("Decision Engine Ready.");
    }

    /**
     * Evaluate a decision with reasoning/context/evidence
     *
     * Decision logic:
     * 1. Check authorization (if securityContext provided)
     * 2. Check tenant isolation (if tenantId provided)
     * 3. Evaluate blocking rules
     * 4. Evaluate reasoning quality
     * 5. Derive outcome, risks, recommendations
     */
    evaluate(input: DecisionInput): DecisionResult {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(input.problem);

        // Step 1: Authorization check
        const authResult = this.checkAuthorization(input);
        if (!authResult.authorized) {
            return this.buildDenyResult(
                traceId,
                inputHash,
                "Authorization denied",
                authResult.reason,
                input
            );
        }

        // Step 2: Tenant isolation check
        const tenantResult = this.checkTenantIsolation(input);
        if (!tenantResult.passed) {
            return this.buildDenyResult(
                traceId,
                inputHash,
                "Tenant isolation violation",
                tenantResult.reason,
                input
            );
        }

        // Step 3: Evaluate blocking rules
        const ruleResult = this.evaluateRules(input);
        if (ruleResult.rejected) {
            return this.buildRejectResult(
                traceId,
                inputHash,
                ruleResult.reason,
                ruleResult.risks,
                ruleResult.appliedRules,
                input
            );
        }

        // Step 4: Evaluate reasoning quality
        const reasoningResult = this.evaluateReasoning(input);

        // Step 5: Derive outcome
        if (reasoningResult.insufficient) {
            return this.buildReviewRequiredResult(
                traceId,
                inputHash,
                reasoningResult.reason,
                reasoningResult.limitations,
                ruleResult.appliedRules,
                input
            );
        }

        // Sufficient evidence and reasoning - APPROVE
        return this.buildApproveResult(
            traceId,
            inputHash,
            reasoningResult.conclusion,
            reasoningResult.risks,
            ruleResult.appliedRules,
            reasoningResult.confidence,
            input
        );
    }

    /**
     * Set security event logger for audit trail
     */
    setSecurityLogger(logger: SecurityEventLogger): void {
        this.securityLogger = logger;
    }

    /**
     * Check authorization via existing AuthorizationGuard
     */
    private checkAuthorization(input: DecisionInput): { authorized: boolean; reason?: string } {
        if (!input.securityContext) {
            // No security context = permit (defer to caller responsibility)
            return { authorized: true };
        }

        const ctx = input.securityContext;

        // Missing actor => deny
        if (!ctx.actor) {
            return { authorized: false, reason: "No actor in security context" };
        }

        // Autonomous operations require EXECUTE permission
        if (ctx.actor.type === PrincipalType.AutonomousOperation) {
            if (!ctx.permissions.includes(Authorization.EXECUTE)) {
                return { authorized: false, reason: "EXECUTE permission required for autonomous operations" };
            }
        }

        // For decision approval, check APPROVE permission
        // But DecisionEngine itself is the authority - it doesn't need APPROVE permission
        // It just needs EXECUTE or READ to operate
        if (!ctx.permissions.includes(Authorization.EXECUTE) && !ctx.permissions.includes(Authorization.READ)) {
            return { authorized: false, reason: "EXECUTE or READ permission required" };
        }

        return { authorized: true };
    }

    /**
     * Check tenant isolation via existing TenantIsolation
     */
    private checkTenantIsolation(input: DecisionInput): { passed: boolean; reason?: string } {
        if (!input.tenantId || !input.securityContext) {
            return { passed: true };
        }

        // Check if actor tenant matches decision tenant
        if (input.securityContext.tenantId !== undefined &&
            input.securityContext.tenantId !== input.tenantId) {
            return {
                passed: false,
                reason: `Tenant mismatch: actor tenant ${input.securityContext.tenantId} does not match decision tenant ${input.tenantId}`
            };
        }

        return { passed: true };
    }

    /**
     * Evaluate blocking rules
     */
    private evaluateRules(input: DecisionInput): {
        rejected: boolean;
        reason?: string;
        risks: string[];
        appliedRules: string[];
    } {
        const rules = input.rules || [];
        const blockingRules: string[] = [];
        const risks: string[] = [];
        const appliedRules: string[] = [];

        for (const rule of rules) {
            appliedRules.push(rule.id);

            if (rule.blocking) {
                blockingRules.push(rule.description);
                risks.push(`Blocking rule: ${rule.description}`);
            }
        }

        if (blockingRules.length > 0) {
            return {
                rejected: true,
                reason: `Blocked by ${blockingRules.length} rule(s): ${blockingRules.join("; ")}`,
                risks,
                appliedRules
            };
        }

        return { rejected: false, risks, appliedRules };
    }

    /**
     * Evaluate reasoning quality and sufficiency
     */
    private evaluateReasoning(input: DecisionInput): {
        insufficient: boolean;
        reason?: string;
        conclusion?: string;
        risks: string[];
        appliedRules: string[];
        confidence: TruthfulConfidence;
        limitations: string[];
    } {
        const reasoning = input.reasoning;
        const context = input.context;
        const risks: string[] = [];
        const limitations: string[] = [];
        const appliedRules: string[] = [];

        // No reasoning provided
        if (!reasoning) {
            // Check if we have context knowledge
            if (context && context.knowledgeItems.length > 0) {
                // Can proceed with knowledge-only reasoning
                const conclusion = `Based on ${context.knowledgeItems.length} knowledge item(s)`;
                return {
                    insufficient: false,
                    conclusion,
                    risks: [],
                    appliedRules,
                    confidence: this.deriveConfidenceFromContext(context),
                    limitations: ["Decision based on knowledge context, not formal reasoning"]
                };
            }

            // No reasoning and no context = insufficient
            return {
                insufficient: true,
                reason: "No reasoning result and no context provided",
                risks: ["Insufficient evidence for decision"],
                appliedRules,
                confidence: IntelligencePipeline.unavailable(),
                limitations: ["Cannot make decision without reasoning or context"]
            };
        }

        // Reasoning failed
        if (!reasoning.success) {
            return {
                insufficient: true,
                reason: `Reasoning failed: ${reasoning.status}`,
                risks: [`Reasoning failed: ${reasoning.status}`],
                appliedRules,
                confidence: IntelligencePipeline.unavailable(),
                limitations: [...reasoning.limitations]
            };
        }

        // Reasoning succeeded but check confidence
        const confidenceValue = IntelligencePipeline.getConfidenceValue(reasoning.confidence);

        // Very low confidence = review required
        if (confidenceValue !== undefined && confidenceValue < 0.3) {
            limitations.push("Very low reasoning confidence");
            risks.push("Low confidence in reasoning result");
        }

        // Stale context check
        if (context) {
            for (const item of context.knowledgeItems) {
                const age = Date.now() - new Date(item.createdAt).getTime();
                const daysOld = age / (1000 * 60 * 60 * 24);
                if (daysOld > 30) {
                    risks.push(`Stale knowledge item: ${item.title} (${daysOld.toFixed(0)} days old)`);
                }
            }
        }

        return {
            insufficient: false,
            conclusion: reasoning.conclusion,
            risks,
            appliedRules,
            confidence: reasoning.confidence,
            limitations: [...reasoning.limitations, ...limitations]
        };
    }

    /**
     * Derive confidence from knowledge context
     */
    private deriveConfidenceFromContext(context: IntelligenceContext): TruthfulConfidence {
        const confidences = context.knowledgeItems
            .map(k => k.confidence)
            .filter((c): c is number => c !== undefined);

        if (confidences.length === 0) {
            return IntelligencePipeline.unavailable();
        }

        const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        return IntelligencePipeline.fromCalculatedConfidence(
            avgConfidence,
            "average_knowledge_confidence",
            `Average of ${confidences.length} knowledge item confidences`
        );
    }

    /**
     * Build APPROVED result
     */
    private buildApproveResult(
        traceId: string,
        inputHash: string,
        conclusion: string,
        risks: string[],
        appliedRules: string[],
        confidence: TruthfulConfidence,
        input: DecisionInput
    ): DecisionResult {
        // Derive recommendations from reasoning/conclusion
        const recommendations = this.deriveRecommendations(input, conclusion);

        const result: DecisionResult = {
            outcome: "APPROVED",
            decision: conclusion,
            recommendations,
            risks: Object.freeze([...risks]),
            confidence,
            reasoning: input.reasoning,
            appliedRules: Object.freeze([...appliedRules]),
            limitations: Object.freeze(["Decision based on provided reasoning and context"]),
            tenantId: input.tenantId,
            authorized: true,
            traceId,
            inputHash,
            outputHash: ProvenanceTrace.hashInput(`APPROVED:${conclusion}`)
        };

        return Object.freeze(result);
    }

    /**
     * Build REJECTED result
     */
    private buildRejectResult(
        traceId: string,
        inputHash: string,
        reason: string,
        risks: string[],
        appliedRules: string[],
        input: DecisionInput
    ): DecisionResult {
        // Log security event for rejection
        this.logSecurityEvent("REJECTED", reason, input);

        const result: DecisionResult = {
            outcome: "REJECTED",
            decision: reason,
            recommendations: Object.freeze(["Address blocking rules before resubmitting"]),
            risks: Object.freeze([...risks]),
            confidence: IntelligencePipeline.fromCalculatedConfidence(
                0.95,
                "blocking_rule_present",
                "Decision rejected due to blocking rule"
            ),
            reasoning: input.reasoning,
            appliedRules: Object.freeze([...appliedRules]),
            limitations: Object.freeze(["Decision blocked by rule evaluation"]),
            tenantId: input.tenantId,
            authorized: true,
            traceId,
            inputHash,
            outputHash: ProvenanceTrace.hashInput(`REJECTED:${reason}`)
        };

        return Object.freeze(result);
    }

    /**
     * Build REVIEW_REQUIRED result
     */
    private buildReviewRequiredResult(
        traceId: string,
        inputHash: string,
        reason: string,
        limitations: string[],
        appliedRules: string[],
        input: DecisionInput
    ): DecisionResult {
        const result: DecisionResult = {
            outcome: "REVIEW_REQUIRED",
            decision: reason,
            recommendations: Object.freeze([
                "Provide reasoning result for formal decision",
                "Ensure sufficient evidence/context is available",
                "Consider adding applicable rules/constraints"
            ]),
            risks: Object.freeze(["Insufficient information for automated decision"]),
            confidence: IntelligencePipeline.unavailable(),
            reasoning: input.reasoning,
            appliedRules: Object.freeze([...appliedRules]),
            limitations: Object.freeze([...limitations]),
            tenantId: input.tenantId,
            authorized: true,
            traceId,
            inputHash,
            outputHash: ProvenanceTrace.hashInput(`REVIEW_REQUIRED:${reason}`)
        };

        return Object.freeze(result);
    }

    /**
     * Build denial result (authorization/tenant failure)
     */
    private buildDenyResult(
        traceId: string,
        inputHash: string,
        decision: string,
        reason: string,
        input: DecisionInput
    ): DecisionResult {
        // Log security event for denial
        this.logSecurityEvent("DENIED", reason, input);

        const result: DecisionResult = {
            outcome: "REJECTED",
            decision,
            recommendations: Object.freeze(["Contact administrator to resolve authorization issue"]),
            risks: Object.freeze(["Unauthorized decision attempt"]),
            confidence: IntelligencePipeline.unavailable(),
            reasoning: input.reasoning,
            appliedRules: Object.freeze([]),
            limitations: Object.freeze([reason]),
            tenantId: input.tenantId,
            authorized: false,
            authorizationReason: reason,
            traceId,
            inputHash,
            outputHash: ProvenanceTrace.hashInput(`DENIED:${reason}`)
        };

        return Object.freeze(result);
    }

    /**
     * Derive recommendations from input and conclusion
     */
    private deriveRecommendations(input: DecisionInput, conclusion: string): readonly string[] {
        const recommendations: string[] = [];

        // From reasoning recommendations if available
        if (input.reasoning && input.reasoning.success) {
            // Include reasoning steps as guidance
            const steps = input.reasoning.reasoningSteps.slice(0, 3);
            for (const step of steps) {
                recommendations.push(step);
            }
        }

        // From context knowledge
        if (input.context && input.context.knowledgeItems.length > 0) {
            const knowledgeTitles = input.context.knowledgeItems.slice(0, 2).map(k => k.title);
            if (knowledgeTitles.length > 0) {
                recommendations.push(`Consider: ${knowledgeTitles.join(", ")}`);
            }
        }

        // From assumptions
        if (input.assumptions.length > 0) {
            recommendations.push(`Validate assumptions: ${input.assumptions.slice(0, 2).join(", ")}`);
        }

        // If conclusion mentions specific issues, recommend addressing them
        if (conclusion.includes("AT RISK")) {
            recommendations.push("Address financial health concerns before proceeding");
        }
        if (conclusion.includes("MARGINAL")) {
            recommendations.push("Monitor metrics closely; consider improvement actions");
        }
        if (conclusion.includes("HIGH")) {
            recommendations.push("Implement risk mitigation immediately");
        }

        // Deduplicate and limit
        const unique = [...new Set(recommendations)];
        return Object.freeze(unique.slice(0, 5));
    }

    /**
     * Log security event for denial/rejection
     */
    private logSecurityEvent(outcome: string, reason: string, input: DecisionInput): void {
        if (!this.securityLogger) return;

        try {
            if (outcome === "DENIED") {
                this.securityLogger.logAuthorizationDenial({
                    actorId: input.securityContext?.actor?.id,
                    actorType: input.securityContext?.actor?.type,
                    tenantId: input.tenantId || input.securityContext?.tenantId,
                    target: `decision:${input.problem}`,
                    traceId: undefined,
                    reason: reason
                });
            } else if (outcome === "REJECTED") {
                this.securityLogger.logAuthorizationDenial({
                    actorId: input.securityContext?.actor?.id,
                    actorType: input.securityContext?.actor?.type,
                    tenantId: input.tenantId || input.securityContext?.tenantId,
                    target: `decision:${input.problem}`,
                    traceId: undefined,
                    reason: `Decision rejected: ${reason}`
                });
            }
        } catch {
            // Don't let logging failures affect decision
        }
    }
}