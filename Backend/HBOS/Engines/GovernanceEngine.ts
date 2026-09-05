/**
 * Phase 06-F - Governance Enforcement
 *
 * GovernanceEngine provides real governance policy enforcement.
 *
 * Responsibilities:
 * - evaluate governance policies
 * - enforce policy constraints
 * - approve/deny governance-sensitive actions
 * - identify human-approval requirements
 * - produce explicit governance decisions
 * - preserve reason/evidence/provenance
 *
 * NOT responsible for:
 * - authentication
 * - authorization (uses AuthorizationGuard)
 * - tenant isolation (uses TenantIsolation)
 * - decision authority (uses DecisionEngine)
 * - reasoning authority (uses IntelligenceEngine)
 * - model provider
 */

import { Engine } from "../Core/Engine";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { AuthorizationGuard } from "../Security/AuthorizationGuard";
import { TenantIsolation, TenantResource } from "../Security/TenantIsolation";
import { SecurityContext } from "../Security/SecurityContext";
import { Authorization, AuthorizationResult } from "../Security/Authorization";
import { SecurityEventLogger } from "../Entities/SecurityEventLogger";

/**
 * Governance policy - defines a governance constraint
 */
export interface GovernancePolicy {
    /** Unique policy identifier */
    readonly id: string;
    /** Human-readable policy description */
    readonly description: string;
    /** Policy severity for audit logging */
    readonly severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    /**
     * Check if this policy applies to the given governance request
     * Returns null if policy does not apply
     * Returns match result if policy applies
     */
    readonly match: (request: GovernanceRequest) => PolicyMatchResult | null;
    /**
     * Evaluate the enforcement effect of this policy
     */
    readonly evaluate: (request: GovernanceRequest) => PolicyEffect;
}

/**
 * Policy match result
 */
export interface PolicyMatchResult {
    readonly matched: boolean;
    readonly reason?: string;
}

/**
 * Policy enforcement effect
 */
export interface PolicyEffect {
    readonly effect: "ALLOW" | "DENY" | "REVIEW_REQUIRED";
    readonly reason: string;
    readonly requiresHumanApproval?: boolean;
}

/**
 * Governance request - input to governance evaluation
 */
export interface GovernanceRequest {
    /** The governance-sensitive action being requested */
    readonly action: GovernanceAction;
    /** Security context (actor, tenant, permissions) */
    readonly securityContext: SecurityContext;
    /** Target resource (if applicable) */
    readonly target?: TenantResource;
    /** Action-specific parameters/evidence */
    readonly parameters?: Record<string, unknown>;
    /** Trace ID for correlation */
    readonly traceId?: string;
}

/**
 * Governance action types
 */
export type GovernanceAction =
    | "EXECUTE_AUTONOMOUS_OPERATION"
    | "CREATE_RESOURCE"
    | "DELETE_RESOURCE"
    | "MODIFY_SECURITY_CONFIG"
    | "ACCESS_SENSITIVE_DATA"
    | "CROSS_TENANT_OPERATION"
    | "OVERRIDE_DECISION"
    | "APPROVE_SPENDING"
    | "DEPLOY_TO_PRODUCTION";

/**
 * Governance result - output from governance evaluation
 */
export interface GovernanceResult {
    /** Governance decision status */
    readonly status: "ALLOWED" | "DENIED" | "REVIEW_REQUIRED";
    /** Human-readable decision message */
    readonly decision: string;
    /** Applied policies */
    readonly appliedPolicies: readonly string[];
    /** Reasons for the decision */
    readonly reasons: readonly string[];
    /** Whether human approval is required */
    readonly requiresHumanApproval: boolean;
    /** Limitations of this governance decision */
    readonly limitations: readonly string[];
    /** Governance confidence (always unavailable for governance - no model) */
    readonly confidence: { source: "unavailable" };
    /** Trace ID for correlation */
    readonly traceId: string;
    /** Input hash for integrity */
    readonly inputHash: string;
    /** Output hash for integrity */
    readonly outputHash: string;
}

/**
 * Governance engine - real governance enforcement
 *
 * Evaluates governance policies and produces explicit governance decisions.
 * Does NOT bypass AuthorizationGuard or TenantIsolation.
 */
export class GovernanceEngine implements Engine {
    name = "GovernanceEngine";

    private securityLogger: SecurityEventLogger | undefined;
    private policies: GovernancePolicy[] = [];

    initialize(): void {
        console.log("Governance Engine Started");
    }

    health(): boolean {
        return true;
    }

    /**
     * Add a governance policy
     */
    addPolicy(policy: GovernancePolicy): void {
        this.policies.push(policy);
    }

    /**
     * Get all registered policies
     */
    getPolicies(): GovernancePolicy[] {
        return [...this.policies];
    }

    /**
     * Clear all policies (for testing)
     */
    clearPolicies(): void {
        this.policies = [];
    }

    /**
     * Evaluate governance for a request
     *
     * Governance evaluation:
     * 1. Check authorization via AuthorizationGuard
     * 2. Check tenant isolation via TenantIsolation
     * 3. Evaluate all matching governance policies
     * 4. Produce ALLOWED/DENIED/REVIEW_REQUIRED outcome
     * 5. Log governance-sensitive events
     */
    evaluate(request: GovernanceRequest): GovernanceResult {
        const traceId = request.traceId ?? ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(JSON.stringify(request));

        // Step 1: Check authorization via canonical AuthorizationGuard
        const authResult = this.checkAuthorization(request);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            this.logAuthDenial(request, authResult.reason);
            return this.buildDeniedResult(
                traceId,
                inputHash,
                `Authorization check failed: ${authResult.reason}`,
                [authResult.reason],
                request
            );
        }

        // Step 2: Check tenant isolation via canonical TenantIsolation
        if (request.target) {
            const tenantResult = this.checkTenantIsolation(request);
            if (tenantResult.result !== AuthorizationResult.PERMITTED) {
                this.logTenantViolationEvent(request, tenantResult.reason);
                return this.buildDeniedResult(
                    traceId,
                    inputHash,
                    `Tenant isolation check failed: ${tenantResult.reason}`,
                    [tenantResult.reason],
                    request
                );
            }
        }

        // Step 3: Evaluate governance policies
        const policyResults = this.evaluatePolicies(request);

        // Step 4: Determine final outcome
        const result = this.determineOutcome(policyResults, request);

        // Step 5: Log governance-sensitive events
        this.logGovernanceEvent(result, request);

        return result;
    }

    /**
     * Check authorization via canonical AuthorizationGuard
     */
    private checkAuthorization(request: GovernanceRequest): { result: AuthorizationResult; reason: string } {
        // Map governance action to required authorization
        const requiredAuth = this.getRequiredAuthorization(request.action);

        const authCheck = AuthorizationGuard.check(request.securityContext, requiredAuth);

        return {
            result: authCheck.result,
            reason: authCheck.reason
        };
    }

    /**
     * Check tenant isolation via canonical TenantIsolation
     */
    private checkTenantIsolation(request: GovernanceRequest): { result: AuthorizationResult; reason: string } {
        if (!request.target) {
            return { result: AuthorizationResult.PERMITTED, reason: "No target resource" };
        }

        const tenantCheck = TenantIsolation.checkAccess(
            request.securityContext,
            request.target,
            this.getRequiredAuthorization(request.action)
        );

        return {
            result: tenantCheck.result,
            reason: tenantCheck.reason
        };
    }

    /**
     * Map governance action to required authorization
     */
    private getRequiredAuthorization(action: GovernanceAction): Authorization {
        switch (action) {
            case "EXECUTE_AUTONOMOUS_OPERATION":
                return Authorization.EXECUTE;
            case "CREATE_RESOURCE":
            case "DELETE_RESOURCE":
            case "MODIFY_SECURITY_CONFIG":
                return Authorization.WRITE;
            case "ACCESS_SENSITIVE_DATA":
                return Authorization.ACCESS_EVIDENCE;
            case "CROSS_TENANT_OPERATION":
                return Authorization.WRITE;
            case "OVERRIDE_DECISION":
            case "APPROVE_SPENDING":
                return Authorization.APPROVE;
            case "DEPLOY_TO_PRODUCTION":
                return Authorization.APPROVE;
            default:
                return Authorization.READ;
        }
    }

    /**
     * Evaluate all applicable governance policies
     */
    private evaluatePolicies(request: GovernanceRequest): PolicyEffect[] {
        const effects: PolicyEffect[] = [];

        for (const policy of this.policies) {
            const matchResult = policy.match(request);
            if (matchResult && matchResult.matched) {
                const effect = policy.evaluate(request);
                effects.push(effect);
            }
        }

        return effects;
    }

    /**
     * Determine final governance outcome from policy effects
     */
    private determineOutcome(effects: PolicyEffect[], request: GovernanceRequest): GovernanceResult {
        const traceId = request.traceId ?? ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(JSON.stringify(request));

        // No policies matched - action is allowed by default
        if (effects.length === 0) {
            return this.buildAllowedResult(traceId, inputHash, request);
        }

        // Check for DENY effects
        const denyEffects = effects.filter(e => e.effect === "DENY");
        if (denyEffects.length > 0) {
            const reasons = denyEffects.map(e => e.reason);
            return this.buildDeniedResult(traceId, inputHash, "Governance policy denies action", reasons, request);
        }

        // Check for REVIEW_REQUIRED effects
        const reviewEffects = effects.filter(e => e.effect === "REVIEW_REQUIRED");
        if (reviewEffects.length > 0) {
            const requiresHumanApproval = reviewEffects.some(e => e.requiresHumanApproval);
            const reasons = reviewEffects.map(e => e.reason);
            return this.buildReviewRequiredResult(traceId, inputHash, "Human review required by governance policy", reasons, request, requiresHumanApproval);
        }

        // All effects are ALLOW - action is allowed
        return this.buildAllowedResult(traceId, inputHash, request);
    }

    /**
     * Build ALLOWED result
     */
    private buildAllowedResult(traceId: string, inputHash: string, request: GovernanceRequest): GovernanceResult {
        const outputHash = ProvenanceTrace.hashInput("ALLOWED");
        const appliedPolicies = this.getAppliedPolicyIds(request);

        return {
            status: "ALLOWED",
            decision: `Governance permits ${request.action}`,
            appliedPolicies,
            reasons: appliedPolicies.length > 0
                ? [`${appliedPolicies.length} governance policy(ies) evaluated and allow action`]
                : ["No governance policies restrict this action"],
            requiresHumanApproval: false,
            limitations: [
                "Governance evaluation is based on registered policies",
                "Policies must be explicitly registered to be evaluated"
            ],
            confidence: { source: "unavailable" },
            traceId,
            inputHash,
            outputHash
        };
    }

    /**
     * Build DENIED result
     */
    private buildDeniedResult(
        traceId: string,
        inputHash: string,
        decision: string,
        reasons: readonly string[],
        request: GovernanceRequest
    ): GovernanceResult {
        const outputHash = ProvenanceTrace.hashInput("DENIED");
        const appliedPolicies = this.getAppliedPolicyIds(request);

        return {
            status: "DENIED",
            decision,
            appliedPolicies,
            reasons: [...reasons, `Governance denies ${request.action}`],
            requiresHumanApproval: false,
            limitations: [
                "Governance policy explicitly denies this action",
                "Action cannot proceed without policy modification"
            ],
            confidence: { source: "unavailable" },
            traceId,
            inputHash,
            outputHash
        };
    }

    /**
     * Build REVIEW_REQUIRED result
     */
    private buildReviewRequiredResult(
        traceId: string,
        inputHash: string,
        decision: string,
        reasons: readonly string[],
        request: GovernanceRequest,
        requiresHumanApproval: boolean
    ): GovernanceResult {
        const outputHash = ProvenanceTrace.hashInput("REVIEW_REQUIRED");
        const appliedPolicies = this.getAppliedPolicyIds(request);

        return {
            status: "REVIEW_REQUIRED",
            decision,
            appliedPolicies,
            reasons: [...reasons, `Governance requires review for ${request.action}`],
            requiresHumanApproval,
            limitations: [
                "Human approval may be required before action can proceed",
                "Review policy documentation for specific requirements"
            ],
            confidence: { source: "unavailable" },
            traceId,
            inputHash,
            outputHash
        };
    }

    /**
     * Get IDs of all policies that match this request
     */
    private getAppliedPolicyIds(request: GovernanceRequest): readonly string[] {
        const applied: string[] = [];
        for (const policy of this.policies) {
            const matchResult = policy.match(request);
            if (matchResult && matchResult.matched) {
                applied.push(policy.id);
            }
        }
        return Object.freeze(applied);
    }

    /**
     * Log governance event to security logger
     */
    private logGovernanceEvent(result: GovernanceResult, request: GovernanceRequest): void {
        if (!this.securityLogger) return;

        switch (result.status) {
            case "DENIED":
                this.securityLogger.logAuthorizationDenial({
                    actorId: request.securityContext.actor?.id,
                    actorType: request.securityContext.actor?.type,
                    tenantId: request.securityContext.tenantId,
                    target: request.action,
                    traceId: result.traceId,
                    reason: result.decision,
                    metadata: {
                        governancePolicies: result.appliedPolicies,
                        reasons: result.reasons
                    }
                });
                break;

            case "REVIEW_REQUIRED":
                // Log review-required governance decisions
                if (result.requiresHumanApproval) {
                    this.securityLogger.logAuthorizationDenial({
                        actorId: request.securityContext.actor?.id,
                        actorType: request.securityContext.actor?.type,
                        tenantId: request.securityContext.tenantId,
                        target: request.action,
                        traceId: result.traceId,
                        reason: `Human approval required: ${result.decision}`,
                        metadata: {
                            governancePolicies: result.appliedPolicies,
                            reasons: result.reasons
                        }
                    });
                }
                break;

            case "ALLOWED":
                // Only log if there are applied policies (non-trivial governance)
                if (result.appliedPolicies.length > 0) {
                    this.securityLogger.logAuthorizationPermission({
                        actorId: request.securityContext.actor?.id,
                        actorType: request.securityContext.actor?.type,
                        tenantId: request.securityContext.tenantId,
                        target: request.action,
                        traceId: result.traceId,
                        reason: `Governance allows: ${result.decision}`,
                        metadata: {
                            governancePolicies: result.appliedPolicies
                        }
                    });
                }
                break;
        }
    }

    /**
     * Set security logger
     */
    setSecurityLogger(logger: SecurityEventLogger): void {
        this.securityLogger = logger;
    }

    private logAuthDenial(request: GovernanceRequest, reason: string): void {
        if (!this.securityLogger) return;
        this.securityLogger.logAuthorizationDenial({
            actorId: request.securityContext.actor?.id,
            actorType: request.securityContext.actor?.type,
            tenantId: request.securityContext.tenantId,
            target: request.action,
            traceId: request.traceId,
            reason: `Authorization check failed: ${reason}`,
            metadata: {
                governanceAction: request.action
            }
        });
    }

    private logTenantViolationEvent(request: GovernanceRequest, reason: string): void {
        if (!this.securityLogger) return;
        this.securityLogger.logTenantViolation({
            actorId: request.securityContext.actor?.id,
            actorType: request.securityContext.actor?.type,
            tenantId: request.securityContext.tenantId,
            requestedTenantId: request.target?.tenantId ?? "unknown",
            target: request.action,
            traceId: request.traceId,
            reason: `Tenant isolation check failed: ${reason}`
        });
    }
}

/**
 * Create a governance policy that denies autonomous operations without proper authority
 */
export function createAutonomousOperationPolicy(): GovernancePolicy {
    return {
        id: "POLICY-AUTO-001",
        description: "Autonomous operations require EXECUTE authority",
        severity: "HIGH",
        match: (request: GovernanceRequest): PolicyMatchResult | null => {
            if (request.action !== "EXECUTE_AUTONOMOUS_OPERATION") {
                return null; // Policy does not apply
            }
            return {
                matched: true,
                reason: "Autonomous operation policy applies"
            };
        },
        evaluate: (request: GovernanceRequest): PolicyEffect => {
            // Check if actor is autonomous operation without EXECUTE
            const actor = request.securityContext.actor;
            if (!actor) {
                return {
                    effect: "DENY",
                    reason: "No actor in security context"
                };
            }

            // If we get here, authorization already passed - EXECUTE is present
            // But governance may require additional human oversight for certain operations
            if (request.parameters?.requiresHumanApproval) {
                return {
                    effect: "REVIEW_REQUIRED",
                    reason: "Operation requires human approval per governance policy",
                    requiresHumanApproval: true
                };
            }

            return {
                effect: "ALLOW",
                reason: "Autonomous operation authorized with EXECUTE permission"
            };
        }
    };
}

/**
 * Create a governance policy for sensitive data access
 */
export function createSensitiveDataPolicy(): GovernancePolicy {
    return {
        id: "POLICY-DATA-001",
        description: "Sensitive data access requires explicit governance approval",
        severity: "HIGH",
        match: (request: GovernanceRequest): PolicyMatchResult | null => {
            if (request.action !== "ACCESS_SENSITIVE_DATA") {
                return null;
            }
            // Check if data is marked as sensitive
            const sensitivity = request.parameters?.dataSensitivity as string | undefined;
            if (sensitivity === "HIGH" || sensitivity === "CRITICAL") {
                return {
                    matched: true,
                    reason: "Sensitive data access policy applies"
                };
            }
            return null;
        },
        evaluate: (request: GovernanceRequest): PolicyEffect => {
            return {
                effect: "REVIEW_REQUIRED",
                reason: "Access to sensitive data requires human approval",
                requiresHumanApproval: true
            };
        }
    };
}

/**
 * Create a governance policy for cross-tenant operations
 */
export function createCrossTenantPolicy(): GovernancePolicy {
    return {
        id: "POLICY-TENANT-001",
        description: "Cross-tenant operations are prohibited",
        severity: "CRITICAL",
        match: (request: GovernanceRequest): PolicyMatchResult | null => {
            if (request.action !== "CROSS_TENANT_OPERATION") {
                return null;
            }
            return {
                matched: true,
                reason: "Cross-tenant policy applies"
            };
        },
        evaluate: (request: GovernanceRequest): PolicyEffect => {
            return {
                effect: "DENY",
                reason: "Cross-tenant operations are prohibited by governance policy"
            };
        }
    };
}

/**
 * Create a governance policy for production deployments
 */
export function createProductionDeploymentPolicy(): GovernancePolicy {
    return {
        id: "POLICY-DEPLOY-001",
        description: "Production deployments require explicit approval",
        severity: "CRITICAL",
        match: (request: GovernanceRequest): PolicyMatchResult | null => {
            if (request.action !== "DEPLOY_TO_PRODUCTION") {
                return null;
            }
            return {
                matched: true,
                reason: "Production deployment policy applies"
            };
        },
        evaluate: (request: GovernanceRequest): PolicyEffect => {
            // Check if proper change management evidence exists
            const hasChangeTicket = request.parameters?.changeTicket !== undefined;
            const hasApproval = request.parameters?.hasApproval === true;

            if (!hasChangeTicket) {
                return {
                    effect: "DENY",
                    reason: "Production deployment requires change ticket"
                };
            }

            if (!hasApproval) {
                return {
                    effect: "REVIEW_REQUIRED",
                    reason: "Production deployment requires explicit approval",
                    requiresHumanApproval: true
                };
            }

            return {
                effect: "ALLOW",
                reason: "Production deployment authorized with proper change management"
            };
        }
    };
}
