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
    }
};
