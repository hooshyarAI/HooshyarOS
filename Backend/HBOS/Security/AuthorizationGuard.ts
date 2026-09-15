/**
 * Phase 05C-B - Authorization Guard
 *
 * Enforces authorization rules:
 * - missing actor => reject
 * - missing/invalid tenant context for tenant-scoped resource => reject
 * - tenant mismatch => reject
 * - authorization defaults to deny
 * - autonomous operation without EXECUTE => reject
 * - evidence access without ACCESS_EVIDENCE => reject
 * - global/system resources may remain unscoped
 */

import { Authorization, AuthorizationResult } from "./Authorization";
import { PrincipalType } from "./Principals";
import { SecurityContext } from "./SecurityContext";

/**
 * Authorization guard result
 */
export interface AuthorizationGuardResult {
    readonly result: AuthorizationResult;
    readonly reason: string;
    readonly traceId?: string;
}

/**
 * ABAC attribute
 */
export interface AbacAttribute {
    readonly key: string;
    readonly value: string | number | boolean;
}

/**
 * ABAC rule
 */
export interface AbacRule {
    readonly effect: "ALLOW" | "DENY";
    readonly attribute: string;
    readonly operator: "EQUALS" | "NOT_EQUALS" | "IN" | "NOT_IN" | "GREATER_THAN" | "LESS_THAN" | "CONTAINS";
    readonly value: string | number | boolean | Array<string | number | boolean>;
}

/**
 * ABAC policy result
 */
export interface AbacPolicyResult {
    readonly result: AuthorizationResult;
    readonly reason: string;
    readonly matchedRule?: string;
    readonly traceId?: string;
}

/**
 * Authorization guard - enforces security rules
 */
export const AuthorizationGuard = {
    /**
     * Check if an action is permitted
     */
    check(context: SecurityContext, action: Authorization): AuthorizationGuardResult {
        // Rule 1: Missing actor => reject
        if (!context.actor) {
            return {
                result: AuthorizationResult.MISSING_CONTEXT,
                reason: "No actor in security context",
                traceId: context.traceId
            };
        }

        // Rule 2: Autonomous operation without EXECUTE => reject
        if (context.actor.type === PrincipalType.AutonomousOperation && action !== Authorization.EXECUTE) {
            return {
                result: AuthorizationResult.DENIED,
                reason: "Autonomous operation can only perform EXECUTE",
                traceId: context.traceId
            };
        }

        // Rule 3: Evidence access requires ACCESS_EVIDENCE permission
        if (action === Authorization.ACCESS_EVIDENCE) {
            if (!context.permissions.includes(Authorization.ACCESS_EVIDENCE)) {
                return {
                    result: AuthorizationResult.FORBIDDEN,
                    reason: "ACCESS_EVIDENCE permission required",
                    traceId: context.traceId
                };
            }
        }

        // Rule 4: ADMINISTER requires explicit permission
        if (action === Authorization.ADMINISTER) {
            if (!context.permissions.includes(Authorization.ADMINISTER)) {
                return {
                    result: AuthorizationResult.FORBIDDEN,
                    reason: "ADMINISTER permission required",
                    traceId: context.traceId
                };
            }
        }

        // Rule 5: APPROVE requires explicit permission
        if (action === Authorization.APPROVE) {
            if (!context.permissions.includes(Authorization.APPROVE)) {
                return {
                    result: AuthorizationResult.FORBIDDEN,
                    reason: "APPROVE permission required",
                    traceId: context.traceId
                };
            }
        }

        // Rule 6: Default to deny - check if permission exists
        if (!context.permissions.includes(action)) {
            return {
                result: AuthorizationResult.DENIED,
                reason: `Permission ${action} not granted`,
                traceId: context.traceId
            };
        }

        return {
            result: AuthorizationResult.PERMITTED,
            reason: "Authorized",
            traceId: context.traceId
        };
    },

    /**
     * Check if a tenant-scoped operation is allowed
     * Rule: missing/invalid tenant context for tenant-scoped resource => reject
     * Rule: tenant mismatch => reject
     */
    checkTenantScoped(
        context: SecurityContext,
        resourceTenantId: string | undefined,
        action: Authorization
    ): AuthorizationGuardResult {
        // First check basic authorization
        const authResult = this.check(context, action);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return authResult;
        }

        // If resource has no tenant (global/system resource), allow
        if (!resourceTenantId) {
            return authResult;
        }

        // Resource has tenant - context must also have tenant
        if (!context.tenantId) {
            return {
                result: AuthorizationResult.MISSING_CONTEXT,
                reason: "Tenant context required for tenant-scoped resource",
                traceId: context.traceId
            };
        }

        // Tenant mismatch => reject
        if (context.tenantId !== resourceTenantId) {
            return {
                result: AuthorizationResult.DENIED,
                reason: "Tenant mismatch - cross-tenant access denied",
                traceId: context.traceId
            };
        }

        return authResult;
    },

    /**
     * Check if autonomous operation with EXECUTE authority
     */
    checkAutonomousExecute(context: SecurityContext): AuthorizationGuardResult {
        // Missing actor => reject
        if (!context.actor) {
            return {
                result: AuthorizationResult.MISSING_CONTEXT,
                reason: "No actor in security context",
                traceId: context.traceId
            };
        }

        // Must be autonomous operation
        if (context.actor.type !== PrincipalType.AutonomousOperation) {
            return {
                result: AuthorizationResult.DENIED,
                reason: "Only autonomous operations require this check",
                traceId: context.traceId
            };
        }

        // Must have EXECUTE permission
        if (!context.permissions.includes(Authorization.EXECUTE)) {
            return {
                result: AuthorizationResult.FORBIDDEN,
                reason: "EXECUTE permission required for autonomous operations",
                traceId: context.traceId
            };
        }

        return {
            result: AuthorizationResult.PERMITTED,
            reason: "Autonomous execution authorized",
            traceId: context.traceId
        };
    },

    /**
     * Check if evidence can be accessed
     */
    checkEvidenceAccess(context: SecurityContext): AuthorizationGuardResult {
        // Missing actor => reject
        if (!context.actor) {
            return {
                result: AuthorizationResult.MISSING_CONTEXT,
                reason: "No actor in security context",
                traceId: context.traceId
            };
        }

        // Must have ACCESS_EVIDENCE permission
        if (!context.permissions.includes(Authorization.ACCESS_EVIDENCE)) {
            return {
                result: AuthorizationResult.FORBIDDEN,
                reason: "ACCESS_EVIDENCE permission required to access evidence",
                traceId: context.traceId
            };
        }

        return {
            result: AuthorizationResult.PERMITTED,
            reason: "Evidence access authorized",
            traceId: context.traceId
        };
    },

    /**
     * Evaluate ABAC policy against resource attributes
     */
    evaluateAbacPolicy(
        context: SecurityContext,
        action: Authorization,
        resourceAttributes: AbacAttribute[],
        rules: AbacRule[]
    ): AbacPolicyResult {
        // No context => reject
        if (!context.actor) {
            return {
                result: AuthorizationResult.MISSING_CONTEXT,
                reason: "No actor in security context",
                traceId: context.traceId
            };
        }

        const attributeMap = new Map<string, string | number | boolean>();
        for (const attr of resourceAttributes) {
            attributeMap.set(attr.key, attr.value);
        }

        let matchedAllowRule: string | undefined;
        const denyReasons: string[] = [];

        for (const rule of rules) {
            const attrValue = attributeMap.get(rule.attribute);
            if (attrValue === undefined) {
                continue;
            }

            let matches = false;
            switch (rule.operator) {
                case "EQUALS":
                    matches = attrValue === rule.value;
                    break;
                case "NOT_EQUALS":
                    matches = attrValue !== rule.value;
                    break;
                case "IN":
                    if (Array.isArray(rule.value)) {
                        matches = (rule.value as Array<string | number | boolean>).includes(attrValue);
                    }
                    break;
                case "NOT_IN":
                    if (Array.isArray(rule.value)) {
                        matches = !(rule.value as Array<string | number | boolean>).includes(attrValue);
                    }
                    break;
                case "GREATER_THAN":
                    matches = Number(attrValue) > Number(rule.value);
                    break;
                case "LESS_THAN":
                    matches = Number(attrValue) < Number(rule.value);
                    break;
                case "CONTAINS":
                    matches = String(attrValue).includes(String(rule.value));
                    break;
            }

            if (!matches) {
                continue;
            }

            if (rule.effect === "DENY") {
                return {
                    result: AuthorizationResult.DENIED,
                    reason: `ABAC policy denied: rule ${rule.attribute} ${rule.operator} ${String(rule.value)}`,
                    matchedRule: rule.attribute,
                    traceId: context.traceId
                };
            }

            if (rule.effect === "ALLOW") {
                matchedAllowRule = rule.attribute;
            }
        }

        if (matchedAllowRule) {
            return {
                result: AuthorizationResult.PERMITTED,
                reason: "ABAC policy allowed",
                matchedRule: matchedAllowRule,
                traceId: context.traceId
            };
        }

        return this.check(context, action);
    },

    /**
     * ABAC check with tenant boundary enforcement
     */
    abacCheck(
        context: SecurityContext,
        action: Authorization,
        resourceType: string,
        resourceAttributes: AbacAttribute[],
        rules: AbacRule[]
    ): AbacPolicyResult {
        // Tenant boundary check
        if (context.tenantId) {
            const tenantAttr = resourceAttributes.find(a => a.key === "tenantId");
            if (tenantAttr && tenantAttr.value !== context.tenantId) {
                return {
                    result: AuthorizationResult.DENIED,
                    reason: "Tenant mismatch",
                    traceId: context.traceId
                };
            }
        }

        return this.evaluateAbacPolicy(context, action, resourceAttributes, rules);
    }
};
