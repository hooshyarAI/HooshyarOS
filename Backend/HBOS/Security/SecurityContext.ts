/**
 * Phase 05C-B - Security Context Contract
 *
 * Security context that flows through all operations.
 * Carries identity and authorization information.
 *
 * Rules:
 * - Missing actor => reject
 * - Missing/invalid tenant context for tenant-scoped resource => reject
 * - Tenant mismatch => reject
 * - Authorization defaults to deny
 */

import { Authorization } from "./Authorization";
import { Principal, PrincipalType, HumanUser, ServiceIdentity, AutonomousOperation, ExternalIntegration } from "./Principals";

/**
 * Security context for an operation
 */
export interface SecurityContext {
    /** The actor performing the action */
    readonly actor: Principal | undefined;
    /** Tenant context - required for tenant-scoped operations */
    readonly tenantId: string | undefined;
    /** Timestamp of the operation */
    readonly timestamp: string;
    /** Trace ID for correlating operations */
    readonly traceId: string | undefined;
    /** Requested permissions/claims */
    readonly permissions: readonly Authorization[];
}

/**
 * Security context factory
 */
export const SecurityContext = {
    /**
     * Create a security context for a human user
     * Starts with minimal permissions - deny by default
     */
    forHumanUser(user: HumanUser, permissions: Authorization[] = [Authorization.READ], traceId?: string): SecurityContext {
        return {
            actor: user,
            tenantId: user.tenantId,
            timestamp: new Date().toISOString(),
            traceId,
            permissions
        };
    },

    /**
     * Create a security context for a service
     */
    forService(service: ServiceIdentity, permissions: Authorization[], traceId?: string): SecurityContext {
        return {
            actor: service,
            tenantId: service.tenantId,
            timestamp: new Date().toISOString(),
            traceId,
            permissions
        };
    },

    /**
     * Create a security context for an autonomous operation
     * Autonomous operations require EXECUTE permission
     */
    forAutonomousOperation(op: AutonomousOperation, traceId?: string): SecurityContext {
        return {
            actor: op,
            tenantId: op.tenantId,
            timestamp: new Date().toISOString(),
            traceId,
            permissions: [Authorization.EXECUTE]
        };
    },

    /**
     * Create a security context for an external integration
     */
    forExternalIntegration(integration: ExternalIntegration, permissions: Authorization[], traceId?: string): SecurityContext {
        return {
            actor: integration,
            tenantId: integration.tenantId,
            timestamp: new Date().toISOString(),
            traceId,
            permissions
        };
    },

    /**
     * Create an empty/invalid context (for testing rejection)
     */
    empty(): SecurityContext {
        return {
            actor: undefined,
            tenantId: undefined,
            timestamp: new Date().toISOString(),
            traceId: undefined,
            permissions: []
        };
    }
};
