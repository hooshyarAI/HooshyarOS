/**
 * Phase 06-D - Real Decision Authority (CORRECTED)
 *
 * DecisionEngine is the canonical decision authority that transforms:
 * - Reasoning results (from IntelligenceEngine)
 * - Evidence
 * - Applicable rules/constraints
 * - Security context
 *
 * Into explicit decisions: APPROVE, REJECT, or REVIEW_REQUIRED
 *
 * Design principles:
 * - Decisions transform reasoning/evidence, not echo status
 * - No fabrication: confidence from actual sources only
 * - Authorization enforcement via canonical AuthorizationGuard
 * - Tenant isolation via canonical TenantIsolation
 * - Rules must match/condition to be effective
 * - Knowledge informs but does not replace formal reasoning
 * - Provenance/evidence preserved through pipeline
 * - Security events logged for denials/rejections
 * - Offline-capable (no network dependency)
 */

import { Authorization, AuthorizationResult } from "../Security/Authorization";
import { AuthorizationGuard, AuthorizationGuardResult } from "../Security/AuthorizationGuard";
import { PrincipalType } from "../Security/Principals";
import { SecurityContext } from "../Security/SecurityContext";
import { TenantIsolation, TenantResource } from "../Security/TenantIsolation";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { IntelligenceResult, TruthfulConfidence, IntelligencePipeline } from "../Core/IntelligenceContract";
import { IntelligenceContext } from "../Core/IntelligenceContract";
import { SecurityEventLogger } from "../Entities/SecurityEventLogger";

/**
 * Decision outcome states
 */
export type DecisionOutcome = "APPROVED" | "REJECTED" | "REVIEW_REQUIRED";

/**
 * Rule condition result
 */
export interface RuleMatchResult {
    readonly matched: boolean;
    readonly reason?: string;
}

/**
 * A decision rule or constraint with explicit matching condition
 */
export interface DecisionRule {
    readonly id: string;
    readonly description: string;
    readonly blocking: boolean; // If true, matching this rule REJECTS the decision
    readonly severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    /**
     * Evaluate if this rule applies to the given input
     * Only rules where match() returns { matched: true } are effective
     */
    readonly match: (input: DecisionInput) => RuleMatchResult;
}

/**
 * Extended decision input with reasoning/evidence
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
    /** Optional evidence items (e.g., financial data, knowledge) */
    readonly evidence?: readonly EvidenceItem[];
    /** Optional applicable rules/constraints */
    readonly rules?: readonly DecisionRule[];
    /** Optional security context for authorization */
    readonly securityContext?: SecurityContext;
    /** Tenant context for tenant-scoped decisions */
    readonly tenantId?: string;
}

/**
 * Evidence item for decision
 */
export interface EvidenceItem {
    readonly id: string;
    readonly type: string;
    readonly summary: string;
    readonly sourceRef: string;
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
 * Transforms reasoning/evidence into explicit decisions.
 * Not a placeholder - performs actual decision transformation.
 */
export class DecisionEngine {
    private securityLogger: SecurityEventLogger | undefined;

    initialize(): void {
        console.log("Decision Engine Ready.");
    }

    /**
     * Evaluate a decision with reasoning/evidence
     *
     * Decision logic:
     * 1. Check authorization via canonical AuthorizationGuard
     * 2. Check tenant isolation via canonical TenantIsolation
     * 3. Evaluate matching blocking rules
     * 4. Evaluate reasoning quality (reasoning required, not just knowledge)
     * 5. Derive outcome, risks, recommendations
     */
    evaluate(input: DecisionInput): DecisionResult {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(input.problem);

        // Step 1: Authorization check via canonical AuthorizationGuard
        const authResult = this.checkAuthorization(input);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return this.buildDenyResult(
                traceId,
                inputHash,
                "Authorization denied",
                authResult.reason,
                input
            );
        }

        // Step 2: Tenant isolation check via canonical TenantIsolation
        const tenantResult = this.checkTenantIsolation(input);
        if (tenantResult.result !== AuthorizationResult.PERMITTED) {
            return this.buildDenyResult(
                traceId,
                inputHash,
                "Tenant isolation violation",
                tenantResult.reason,
                input
            );
        }

        // Step 3: Evaluate blocking rules (only matching rules are effective)
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

        // Step 4: Evaluate reasoning quality (FORMAL REASONING REQUIRED for APPROVED)
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

        // Sufficient evidence and formal reasoning - APPROVE
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
     * Check authorization via canonical AuthorizationGuard
     */
    private checkAuthorization(input: DecisionInput): AuthorizationGuardResult {
        if (!input.securityContext) {
            // No security context = permit (defer to caller responsibility)
            return {
                result: AuthorizationResult.PERMITTED,
                reason: "No security context provided"
            };
        }

        // Use canonical AuthorizationGuard.check() with EXECUTE action
        // Decision execution requires EXECUTE permission
        return AuthorizationGuard.check(input.securityContext, Authorization.EXECUTE);
    }

    /**
     * Check tenant isolation via canonical TenantIsolation
     */
    private checkTenantIsolation(input: DecisionInput): { result: AuthorizationResult; reason?: string } {
        if (!input.tenantId || !input.securityContext) {
            return { result: AuthorizationResult.PERMITTED };
        }

        // Create a TenantResource from the tenantId
        const resource: TenantResource = { tenantId: input.tenantId };

        // Use canonical TenantIsolation.checkAccess()
        const result = TenantIsolation.checkAccess(
            input.securityContext,
            resource,
            Authorization.EXECUTE
        );

        return result;
    }

    /**
     * Evaluate blocking rules (only matching rules are effective)
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
            // Evaluate if rule matches/applies to this input
            const matchResult = rule.match(input);

            if (matchResult.matched) {
                // Rule is effective - add to applied rules
                appliedRules.push(rule.id);

                if (rule.blocking) {
                    blockingRules.push(rule.description);
                    risks.push(`Blocking rule matched: ${rule.description}`);
                    if (matchResult.reason) {
                        risks.push(`  Reason: ${matchResult.reason}`);
                    }
                }
            }
        }

        if (blockingRules.length > 0) {
            return {
                rejected: true,
                reason: `Blocked by ${blockingRules.length} matching rule(s): ${blockingRules.join("; ")}`,
                risks,
                appliedRules
            };
        }

        return { rejected: false, risks, appliedRules };
    }

    /**
     * Evaluate reasoning quality and sufficiency
     *
     * IMPORTANT: Formal reasoning (IntelligenceResult with success=true) is REQUIRED
     * for APPROVED. Knowledge/evidence alone is insufficient.
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

        // Formal reasoning is REQUIRED for any decision
        // No reasoning = insufficient
        if (!reasoning) {
            return {
                insufficient: true,
                reason: "No formal reasoning result provided",
                risks: ["Insufficient evidence: formal reasoning required"],
                appliedRules: [],
                confidence: IntelligencePipeline.unavailable(),
                limitations: ["Cannot make decision without formal reasoning from IntelligenceEngine"]
            };
        }

        // Reasoning failed = insufficient
        if (!reasoning.success) {
            return {
                insufficient: true,
                reason: `Reasoning failed: ${reasoning.status}`,
                risks: [`Reasoning failed: ${reasoning.status}`],
                appliedRules: [],
                confidence: IntelligencePipeline.unavailable(),
                limitations: [...reasoning.limitations]
            };
        }

        // Reasoning succeeded - evaluate confidence
        const confidenceValue = IntelligencePipeline.getConfidenceValue(reasoning.confidence);
        const risks: string[] = [];
        const limitations: string[] = [];

        // Very low confidence = flagged but still sufficient for decision
        if (confidenceValue !== undefined && confidenceValue < 0.3) {
            limitations.push("Very low reasoning confidence");
            risks.push("Low confidence in reasoning result");
        }

        return {
            insufficient: false,
            conclusion: reasoning.conclusion,
            risks,
            appliedRules: [],
            confidence: reasoning.confidence,
            limitations: [...reasoning.limitations]
        };
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
            limitations: Object.freeze(["Decision based on formal reasoning"]),
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
     *
     * IMPORTANT: Confidence is NOT fabricated for rejections.
     * We use unavailable() because a blocking rule doesn't provide
     * evidence about the correctness of the decision - it only
     * indicates the decision cannot be made.
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
            // FINDING 1 FIX: No fabricated confidence for rejections
            confidence: IntelligencePipeline.unavailable(),
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
                "Provide formal reasoning result from IntelligenceEngine",
                "Ensure reasoning has succeeded (success=true)",
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

/**
 * Create a simple blocking rule with a condition function
 */
export function createBlockingRule(
    id: string,
    description: string,
    condition: (input: DecisionInput) => boolean,
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
): DecisionRule {
    return {
        id,
        description,
        blocking: true,
        severity,
        match: (input: DecisionInput) => ({
            matched: condition(input),
            reason: condition(input) ? `Condition met: ${description}` : undefined
        })
    };
}

/**
 * Create a non-blocking advisory rule with a condition function
 */
export function createAdvisoryRule(
    id: string,
    description: string,
    condition: (input: DecisionInput) => boolean
): DecisionRule {
    return {
        id,
        description,
        blocking: false,
        match: (input: DecisionInput) => ({
            matched: condition(input),
            reason: condition(input) ? `Condition met: ${description}` : undefined
        })
    };
}
