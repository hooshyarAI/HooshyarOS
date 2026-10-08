/**
 * Phase 05C-E1 - Audit Event Contract
 *
 * Defines the canonical audit event schema for HooshyarOS.
 *
 * Design principles:
 * - Every auditable event has a canonical form
 * - actorId, actorType, tenantId are always present for tenant-scoped events
 * - action, target, result, traceId provide operational context
 * - authorization result and reason provide security context
 * - No fabrication: fields are undefined when unavailable, not fake
 * - Immutable after creation: Object.freeze()
 *
 * Audit event contract fields:
 * - actorId: WHO performed the action (principal id)
 * - actorType: WHAT TYPE of actor (HumanUser, ServiceIdentity, AutonomousOperation, ExternalIntegration)
 * - tenantId: WHICH tenant (undefined for global/system events)
 * - timestamp: WHEN (ISO 8601)
 * - action: WHAT action (READ, WRITE, EXECUTE, APPROVE, ACCESS_EVIDENCE, ADMINISTER)
 * - target: WHAT resource was affected
 * - result: What happened (SUCCESS, FAILURE, DENIED, ERROR)
 * - traceId: Correlation ID for tracing
 * - authorizationResult: PERMITTED, DENIED, FORBIDDEN, MISSING_CONTEXT
 * - reason: Why the authorization result occurred
 */

import { AuthorizationResult } from "../Security/Authorization";
import { PrincipalType } from "../Security/Principals";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";

/**
 * Result of an auditable operation
 */
export type AuditEventResult = "SUCCESS" | "FAILURE" | "DENIED" | "ERROR";

/**
 * Audit event action types (mirrors Authorization enum)
 */
export type AuditEventAction =
    | "READ"
    | "WRITE"
    | "EXECUTE"
    | "APPROVE"
    | "ACCESS_EVIDENCE"
    | "ADMINISTER"
    | "CREATE"
    | "DELETE"
    | "ENCRYPT"
    | "DECRYPT"
    | "AUTHENTICATE"
    | "AUTHORIZE"
    | "AUDIT"
    | "BACKUP"
    | "RESTORE";

/**
 * Canonical audit event schema
 */
export interface AuditEvent {
    /** Unique event identifier */
    readonly id: string;
    /** Actor identifier (principal id) */
    readonly actorId: string | undefined;
    /** Actor type */
    readonly actorType: PrincipalType | undefined;
    /** Tenant context (undefined for global/system events) */
    readonly tenantId: string | undefined;
    /** Event timestamp (ISO 8601) */
    readonly timestamp: string;
    /** Action performed */
    readonly action: AuditEventAction | undefined;
    /** Resource/target affected */
    readonly target: string | undefined;
    /** Operation result */
    readonly result: AuditEventResult | undefined;
    /** Correlation trace ID */
    readonly traceId: string | undefined;
    /** Authorization result */
    readonly authorizationResult: AuthorizationResult | undefined;
    /** Reason for authorization result */
    readonly reason: string | undefined;
    /** Optional metadata */
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Audit event factory
 */
export const AuditEvent = {
    /**
     * Create an audit event from a security context and authorization result
     */
    fromSecurityContext(params: {
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        action: AuditEventAction;
        target: string;
        result: AuditEventResult;
        traceId?: string;
        authorizationResult?: AuthorizationResult;
        reason?: string;
        metadata?: Record<string, unknown>;
    }): AuditEvent {
        return Object.freeze({
            id: ProvenanceTrace.createTraceId(),
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            timestamp: new Date().toISOString(),
            action: params.action,
            target: params.target,
            result: params.result,
            traceId: params.traceId,
            authorizationResult: params.authorizationResult,
            reason: params.reason,
            metadata: params.metadata ? Object.freeze({ ...params.metadata }) : undefined
        }) as AuditEvent;
    },

    /**
     * Create a security denial audit event
     */
    denial(params: {
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        action: AuditEventAction;
        target: string;
        traceId?: string;
        reason: string;
    }): AuditEvent {
        return AuditEvent.fromSecurityContext({
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            action: params.action,
            target: params.target,
            result: "DENIED",
            traceId: params.traceId,
            authorizationResult: AuthorizationResult.DENIED,
            reason: params.reason
        });
    },

    /**
     * Create a successful operation audit event
     */
    success(params: {
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        action: AuditEventAction;
        target: string;
        traceId?: string;
        reason?: string;
        metadata?: Record<string, unknown>;
    }): AuditEvent {
        return AuditEvent.fromSecurityContext({
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            action: params.action,
            target: params.target,
            result: "SUCCESS",
            traceId: params.traceId,
            authorizationResult: AuthorizationResult.PERMITTED,
            reason: params.reason,
            metadata: params.metadata
        });
    },

    /**
     * Create an error audit event
     */
    error(params: {
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        action: AuditEventAction;
        target: string;
        traceId?: string;
        reason: string;
        metadata?: Record<string, unknown>;
    }): AuditEvent {
        return AuditEvent.fromSecurityContext({
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            action: params.action,
            target: params.target,
            result: "ERROR",
            traceId: params.traceId,
            authorizationResult: undefined,
            reason: params.reason,
            metadata: params.metadata
        });
    }
};
