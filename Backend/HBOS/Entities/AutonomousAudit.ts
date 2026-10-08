/**
 * Phase 05C-E4 - Autonomous Operation Audit Contract
 *
 * Ensures autonomous operations have:
 * - Attributable identity (operator type, operation ID, tenant context)
 * - Authorization evidence (EXECUTE permission verified)
 * - Provenance chain (traceId linking to reasoning/decision)
 * - Security event logging for all autonomous actions
 *
 * Design principles:
 * - Autonomous operations are principals (from Principals.ts)
 * - Every autonomous operation must have EXECUTE authorization
 * - Autonomous operations are logged with full security context
 * - No anonymous autonomous operations
 */

import { AutonomousOperation, PrincipalType } from "../Security/Principals";
import { Authorization, AuthorizationResult } from "../Security/Authorization";
import { SecurityContext } from "../Security/SecurityContext";
import { AuthorizationGuard } from "../Security/AuthorizationGuard";
import { SecurityEventLogger, SecurityEvent } from "./SecurityEventLogger";
import { AuditEvent, AuditEventAction } from "./AuditEvent";

/**
 * Autonomous operation audit record
 */
export interface AutonomousAuditRecord {
    /** Operation identity */
    readonly operationId: string;
    readonly operatorType: string;
    readonly tenantId: string | undefined;
    /** Authorization evidence */
    readonly authorized: boolean;
    readonly authorizationResult: AuthorizationResult;
    readonly reason: string;
    /** Provenance */
    readonly traceId: string | undefined;
    /** Action performed */
    readonly action: AuditEventAction;
    readonly target: string;
    readonly result: "SUCCESS" | "FAILURE" | "DENIED" | "ERROR";
    /** Timestamp */
    readonly timestamp: string;
}

/**
 * Result of autonomous operation authorization check
 */
export interface AutonomyAuthorizationResult {
    authorized: boolean;
    context: SecurityContext;
    reason: string;
}

/**
 * Autonomous operation auditor
 *
 * Intercepts and audits all autonomous operations to ensure:
 * 1. Identity is established and attributable
 * 2. EXECUTE authorization is verified
 * 3. All actions are logged with security context
 */
export class AutonomousOperationAuditor {
    private securityLogger: SecurityEventLogger;

    constructor(databasePath?: string) {
        this.securityLogger = new SecurityEventLogger(databasePath);
    }

    /**
     * Authorize an autonomous operation
     * Returns security context with authorization evidence
     */
    authorizeAutonomousOperation(
        operation: AutonomousOperation,
        traceId?: string
    ): AutonomyAuthorizationResult {
        const context = SecurityContext.forAutonomousOperation(operation, traceId);
        const checkResult = AuthorizationGuard.checkAutonomousExecute(context);

        if (checkResult.result === AuthorizationResult.PERMITTED) {
            return {
                authorized: true,
                context,
                reason: checkResult.reason
            };
        }

        // Log authorization denial as security event
        this.securityLogger.logAuthorizationDenial({
            actorId: operation.operationId,
            actorType: PrincipalType.AutonomousOperation,
            tenantId: operation.tenantId,
            target: `autonomous:${operation.operatorType}:${operation.operationId}`,
            traceId,
            reason: checkResult.reason
        });

        return {
            authorized: false,
            context,
            reason: checkResult.reason
        };
    }

    /**
     * Audit an autonomous action after execution
     */
    auditAutonomousAction(params: {
        operation: AutonomousOperation;
        traceId?: string;
        action: AuditEventAction;
        target: string;
        success: boolean;
        error?: string;
    }): AutonomousAuditRecord {
        const record: AutonomousAuditRecord = {
            operationId: params.operation.operationId,
            operatorType: params.operation.operatorType,
            tenantId: params.operation.tenantId,
            authorized: true,
            authorizationResult: AuthorizationResult.PERMITTED,
            reason: "Autonomous operation executed",
            traceId: params.traceId,
            action: params.action,
            target: params.target,
            result: params.success ? "SUCCESS" : (params.error ? "ERROR" : "FAILURE"),
            timestamp: new Date().toISOString()
        };

        // Log to security events
        if (params.success) {
            this.securityLogger.logAuthorizationPermission({
                actorId: params.operation.operationId,
                actorType: PrincipalType.AutonomousOperation,
                tenantId: params.operation.tenantId,
                target: params.target,
                traceId: params.traceId,
                reason: `Autonomous ${params.action} completed`,
                metadata: { operatorType: params.operation.operatorType }
            });
        } else {
            this.securityLogger.logAuthorizationDenial({
                actorId: params.operation.operationId,
                actorType: PrincipalType.AutonomousOperation,
                tenantId: params.operation.tenantId,
                target: params.target,
                traceId: params.traceId,
                reason: params.error ?? "Autonomous operation failed",
                metadata: { operatorType: params.operation.operatorType }
            });
        }

        return record;
    }

    /**
     * Verify autonomous operation identity
     */
    verifyAutonomousIdentity(operation: AutonomousOperation): boolean {
        // Autonomous operation must have:
        // - Non-empty operationId
        // - Non-empty operatorType
        // - operatorType must be a known type
        const knownOperatorTypes = ["KiloCode", "AutonomousDaemon", "BuildAgent", "RepairAgent"];
        return Boolean(
            operation.operationId?.trim() &&
            operation.operatorType?.trim() &&
            knownOperatorTypes.includes(operation.operatorType)
        );
    }

    /**
     * Get security events for autonomous operations
     */
    getAutonomousSecurityEvents(tenantId?: string, limit = 100): SecurityEvent[] {
        const events = tenantId
            ? this.securityLogger.getEventsByTenant(tenantId, limit)
            : [];
        return events.filter(e =>
            e.actorType === PrincipalType.AutonomousOperation
        );
    }

    /**
     * Close the auditor
     */
    close(): void {
        this.securityLogger.close();
    }
}

/**
 * Helper to create an autonomous operation principal for auditing
 */
export function createAutonomousAuditPrincipal(
    operationId: string,
    operatorType: string,
    tenantId?: string
): AutonomousOperation {
    return {
        id: operationId,
        type: PrincipalType.AutonomousOperation,
        operationId,
        operatorType,
        tenantId
    };
}
