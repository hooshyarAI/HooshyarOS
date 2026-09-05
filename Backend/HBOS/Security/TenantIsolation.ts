/**
 * Phase 05C-C - Tenant Resource Contract
 *
 * Interface for resources that are tenant-scoped.
 * Resources implementing this interface require tenant boundary enforcement.
 *
 * Global/system resources should NOT implement this interface.
 */

import { SecurityContext } from "./SecurityContext";
import { Authorization, AuthorizationResult } from "./Authorization";

/**
 * Interface for tenant-scoped resources
 * Resources that hold tenant-sensitive data must implement this.
 *
 * IMPORTANT: Global/system resources should NOT implement this interface.
 * Resources with undefined or empty tenantId are treated as global.
 */
export interface TenantResource {
    /** The tenant that owns this resource. undefined/empty means global. */
    readonly tenantId?: string;
}

/**
 * Type guard to check if a resource is tenant-scoped
 * Returns true only if tenantId is a non-empty string.
 */
export function isTenantResource(value: unknown): value is TenantResource {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const tenantId = (value as TenantResource).tenantId;
    return typeof tenantId === "string" && tenantId.length > 0;
}

/**
 * Result type for authorization guard
 */
export interface TenantIsolationResult {
    readonly result: AuthorizationResult;
    readonly reason: string;
    readonly traceId?: string;
}

/**
 * Tenant Isolation Guard
 * Enforces tenant boundaries for tenant-scoped resources.
 */
export const TenantIsolation = {
    /**
     * Check if an actor can access a tenant-scoped resource.
     * Rejects if:
     * - Context has no actor (missing actor - rejected)
     * - Context has no tenantId (missing context - rejected)
     * - Context tenant doesn't match resource tenant (mismatch - rejected)
     *
     * Allows if:
     * - Resource has no tenantId (global resource - allowed)
     */
    checkAccess(
        context: SecurityContext,
        resource: TenantResource,
        action: Authorization
    ): TenantIsolationResult {
        // Missing actor => reject
        if (!context.actor) {
            return {
                result: AuthorizationResult.MISSING_CONTEXT,
                reason: "No actor in security context",
                traceId: context.traceId
            };
        }

        // If resource has no tenantId, it's a global resource - allow
        if (!resource.tenantId) {
            return {
                result: AuthorizationResult.PERMITTED,
                reason: "Global resource access permitted"
            };
        }

        // Resource is tenant-scoped - check tenant context
        if (!context.tenantId) {
            return {
                result: AuthorizationResult.MISSING_CONTEXT,
                reason: "Tenant context required for tenant-scoped resource",
                traceId: context.traceId
            };
        }

        // Tenant mismatch => reject
        if (context.tenantId !== resource.tenantId) {
            return {
                result: AuthorizationResult.DENIED,
                reason: "Tenant mismatch - cross-tenant access denied",
                traceId: context.traceId
            };
        }

        return {
            result: AuthorizationResult.PERMITTED,
            reason: "Tenant-scoped access permitted",
            traceId: context.traceId
        };
    },

    /**
     * Verify a resource is accessible to the given context for a given action.
     */
    canAccess(
        context: SecurityContext,
        resource: TenantResource,
        action: Authorization
    ): boolean {
        const result = this.checkAccess(context, resource, action);
        return result.result === AuthorizationResult.PERMITTED;
    }
};
