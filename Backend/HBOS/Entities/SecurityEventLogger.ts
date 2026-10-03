/**
 * Phase 05C-E3 - Security Event Schema and Logger
 *
 * Captures security-relevant events:
 * - Authorization denials (including tenant boundary violations)
 * - Authentication failures
 * - Evidence access attempts
 * - Encryption/decryption operations
 * - Tenant isolation violations
 *
 * Design principles:
 * - Security events are distinct from general audit events
 * - Security events capture DENIAL, VIOLATION, FAILURE scenarios
 * - Events are logged even when operations are blocked
 * - No suppression of security failures
 * - Offline capable: local SQLite storage
 */

import { AuditStore } from "./AuditStore";
import { AuditEvent, AuditEventAction, AuditEventResult } from "./AuditEvent";
import { AuthorizationResult } from "../Security/Authorization";
import { PrincipalType } from "../Security/Principals";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";

/**
 * Security event types
 */
export type SecurityEventType =
    | "AUTHORIZATION_DENIAL"
    | "AUTHORIZATION_PERMISSION"
    | "TENANT_VIOLATION"
    | "AUTHENTICATION_FAILURE"
    | "EVIDENCE_ACCESS_DENIAL"
    | "ENCRYPTION_FAILURE"
    | "DECRYPTION_FAILURE"
    | "INTEGRITY_VIOLATION"
    | "KEY_FAILURE"
    | "UNAUTHORIZED_ACCESS"
    | "SECURITY_CONFIG_CHANGE";

/**
 * Security event severity
 */
export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Security event schema
 */
export interface SecurityEvent {
    readonly id: string;
    readonly eventType: SecurityEventType;
    readonly severity: SecuritySeverity;
    readonly timestamp: string;
    readonly actorId: string | undefined;
    readonly actorType: PrincipalType | undefined;
    readonly tenantId: string | undefined;
    readonly target: string;
    readonly traceId: string | undefined;
    readonly authorizationResult: AuthorizationResult;
    readonly reason: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Security event logger - captures security-relevant events
 */
export class SecurityEventLogger {
    private auditStore: AuditStore | undefined;

    constructor(databasePath?: string) {
        if (databasePath) {
            this.auditStore = new AuditStore(databasePath);
            this.auditStore.initialize();
        }
    }

    /**
     * Log an authorization denial
     */
    logAuthorizationDenial(params: {
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        target: string;
        traceId?: string;
        reason: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent {
        const event = this.createEvent({
            eventType: "AUTHORIZATION_DENIAL",
            severity: "HIGH",
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            target: params.target,
            traceId: params.traceId,
            authorizationResult: AuthorizationResult.DENIED,
            reason: params.reason,
            metadata: params.metadata
        });

        this.append(event);
        return event;
    }

    /**
     * Log a tenant boundary violation
     */
    logTenantViolation(params: {
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        requestedTenantId: string;
        target: string;
        traceId?: string;
        reason: string;
    }): SecurityEvent {
        const event = this.createEvent({
            eventType: "TENANT_VIOLATION",
            severity: "CRITICAL",
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            target: params.target,
            traceId: params.traceId,
            authorizationResult: AuthorizationResult.DENIED,
            reason: `${params.reason}: attempted access to tenant ${params.requestedTenantId}`,
            metadata: { requestedTenantId: params.requestedTenantId }
        });

        this.append(event);
        return event;
    }

    /**
     * Log an evidence access denial
     */
    logEvidenceAccessDenial(params: {
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        target: string;
        traceId?: string;
        reason: string;
    }): SecurityEvent {
        const event = this.createEvent({
            eventType: "EVIDENCE_ACCESS_DENIAL",
            severity: "HIGH",
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            target: params.target,
            traceId: params.traceId,
            authorizationResult: AuthorizationResult.FORBIDDEN,
            reason: params.reason
        });

        this.append(event);
        return event;
    }

    /**
     * Log an authentication failure
     */
    logAuthenticationFailure(params: {
        actorId?: string;
        target: string;
        reason: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent {
        const event = this.createEvent({
            eventType: "AUTHENTICATION_FAILURE",
            severity: "HIGH",
            actorId: params.actorId,
            actorType: undefined,
            tenantId: undefined,
            target: params.target,
            traceId: undefined,
            authorizationResult: AuthorizationResult.MISSING_CONTEXT,
            reason: params.reason,
            metadata: params.metadata
        });

        this.append(event);
        return event;
    }

    /**
     * Log an encryption failure
     */
    logEncryptionFailure(params: {
        actorId?: string;
        tenantId?: string;
        target: string;
        reason: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent {
        const event = this.createEvent({
            eventType: "ENCRYPTION_FAILURE",
            severity: "MEDIUM",
            actorId: params.actorId,
            actorType: PrincipalType.ServiceIdentity,
            tenantId: params.tenantId,
            target: params.target,
            traceId: undefined,
            authorizationResult: AuthorizationResult.PERMITTED,
            reason: params.reason,
            metadata: params.metadata
        });

        this.append(event);
        return event;
    }

    /**
     * Log an integrity violation (detected tampering)
     */
    logIntegrityViolation(params: {
        target: string;
        reason: string;
        traceId?: string;
        details?: string;
    }): SecurityEvent {
        const event = this.createEvent({
            eventType: "INTEGRITY_VIOLATION",
            severity: "CRITICAL",
            actorId: undefined,
            actorType: undefined,
            tenantId: undefined,
            target: params.target,
            traceId: params.traceId,
            authorizationResult: AuthorizationResult.MISSING_CONTEXT,
            reason: params.reason,
            metadata: params.details ? { details: params.details } : undefined
        });

        this.append(event);
        return event;
    }

    /**
     * Log an authorization permission (successful access)
     */
    logAuthorizationPermission(params: {
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        target: string;
        traceId?: string;
        reason?: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent {
        const event = this.createEvent({
            eventType: "AUTHORIZATION_PERMISSION",
            severity: "LOW",
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            target: params.target,
            traceId: params.traceId,
            authorizationResult: AuthorizationResult.PERMITTED,
            reason: params.reason ?? "Access permitted",
            metadata: params.metadata
        });

        this.append(event);
        return event;
    }

    /**
     * Log a key failure
     */
    logKeyFailure(params: {
        tenantId?: string;
        target: string;
        reason: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent {
        const event = this.createEvent({
            eventType: "KEY_FAILURE",
            severity: "CRITICAL",
            actorId: undefined,
            actorType: PrincipalType.ServiceIdentity,
            tenantId: params.tenantId,
            target: params.target,
            traceId: undefined,
            authorizationResult: AuthorizationResult.MISSING_CONTEXT,
            reason: params.reason,
            metadata: params.metadata
        });

        this.append(event);
        return event;
    }

    /**
     * Log an unauthorized access attempt
     */
    logUnauthorizedAccess(params: {
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        target: string;
        traceId?: string;
        reason: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent {
        const event = this.createEvent({
            eventType: "UNAUTHORIZED_ACCESS",
            severity: "HIGH",
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            target: params.target,
            traceId: params.traceId,
            authorizationResult: AuthorizationResult.FORBIDDEN,
            reason: params.reason,
            metadata: params.metadata
        });

        this.append(event);
        return event;
    }

    /**
     * Get security events by tenant
     */
    getEventsByTenant(tenantId: string, limit = 100): SecurityEvent[] {
        if (!this.auditStore) return [];
        return this.auditStore.queryByTenant(tenantId, limit) as unknown as SecurityEvent[];
    }

    /**
     * Get security events by trace
     */
    getEventsByTraceId(traceId: string): SecurityEvent[] {
        if (!this.auditStore) return [];
        return this.auditStore.queryByTraceId(traceId) as unknown as SecurityEvent[];
    }

    /**
     * Verify audit store integrity
     */
    verifyIntegrity(): { valid: boolean; reason?: string; eventId?: string; details?: string } {
        if (!this.auditStore) return { valid: true, reason: "No audit store configured" };
        return this.auditStore.verifyChain();
    }

    /**
     * Close the logger
     */
    close(): void {
        this.auditStore?.close();
    }

    private createEvent(params: {
        eventType: SecurityEventType;
        severity: SecuritySeverity;
        actorId?: string;
        actorType?: PrincipalType;
        tenantId?: string;
        target: string;
        traceId?: string;
        authorizationResult: AuthorizationResult;
        reason: string;
        metadata?: Record<string, unknown>;
    }): SecurityEvent {
        return Object.freeze({
            id: ProvenanceTrace.createTraceId(),
            eventType: params.eventType,
            severity: params.severity,
            timestamp: new Date().toISOString(),
            actorId: params.actorId,
            actorType: params.actorType,
            tenantId: params.tenantId,
            target: params.target,
            traceId: params.traceId,
            authorizationResult: params.authorizationResult,
            reason: params.reason,
            metadata: params.metadata ? Object.freeze({ ...params.metadata }) : undefined
        }) as SecurityEvent;
    }

    private append(event: SecurityEvent): void {
        if (!this.auditStore) return;

        // Convert SecurityEvent to AuditEvent for storage
        const auditEvent = AuditEvent.fromSecurityContext({
            actorId: event.actorId,
            actorType: event.actorType,
            tenantId: event.tenantId,
            action: "AUDIT" as AuditEventAction,
            target: event.target,
            result: this.severityToResult(event.severity),
            traceId: event.traceId,
            authorizationResult: event.authorizationResult,
            reason: `[${event.eventType}] ${event.reason}`,
            metadata: {
                securityEventType: event.eventType,
                severity: event.severity,
                ...event.metadata
            }
        });

        try {
            this.auditStore.append(auditEvent);
        } catch (error) {
            // SECURITY CRITICAL: Do not silently discard security events
            // Log to console as fallback when audit persistence fails
            console.error(JSON.stringify({
                type: "SECURITY_EVENT_LOG_FAILURE",
                event,
                error: String(error),
                timestamp: new Date().toISOString()
            }));
        }
    }

    private severityToResult(severity: SecuritySeverity): AuditEventResult {
        switch (severity) {
            case "CRITICAL":
            case "HIGH":
                return "DENIED";
            case "MEDIUM":
                return "FAILURE";
            case "LOW":
                return "SUCCESS";
        }
    }
}
