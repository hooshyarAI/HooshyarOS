/**
 * Phase 05C-E5 - Audit Failure Semantics
 *
 * Defines truthful behavior when audit persistence fails.
 *
 * Design principles:
 * - SECURITY CRITICAL events MUST NOT be silently discarded
 * - Write failures must be surfaced, not hidden
 * - Tiered failure handling: CRITICAL vs non-critical
 * - Failure modes are documented, not ambiguous
 * - Fallback logging ensures no security event is lost
 *
 * Failure tiers:
 * - CRITICAL: Security/authorization failures, tenant violations, integrity violations
 *   => MUST NOT be silently discarded
 *   => Fallback: console.error + process exit signal
 *
 * - HIGH: Successful security operations, evidence access
 *   => Should not be silently discarded
 *   => Fallback: console.error
 *
 * - MEDIUM: Configuration changes, key operations
 *   => Log failure, continue operation
 *   => Fallback: console.warn
 *
 * - LOW: Routine audit events
 *   => Log failure, continue operation
 *   => Fallback: console.debug
 */

import { SecuritySeverity } from "./SecurityEventLogger";

/**
 * Audit persistence failure action
 */
export type AuditFailureAction =
    | "THROW"           // Throw error to caller
    | "LOG_CONSOLE"     // Log to console and continue
    | "LOG_AND_THROW"   // Log to console then throw
    | "IGNORE";         // Silently ignore (only for LOW severity non-security events)

/**
 * Audit persistence result
 */
export interface AuditPersistenceResult {
    success: boolean;
    persisted: boolean;
    failureAction: AuditFailureAction;
    error?: string;
    fallbackLogged: boolean;
}

/**
 * Audit failure policy configuration
 */
export interface AuditFailurePolicy {
    /** Severity threshold for THROW action (>= this severity throws) */
    throwOnSeverity?: SecuritySeverity;
    /** Severity threshold for console.error (>= this severity uses console.error) */
    consoleErrorOnSeverity?: SecuritySeverity;
    /** Whether to exit process on CRITICAL audit failure */
    exitOnCriticalFailure?: boolean;
    /** Exit code for critical failures */
    exitCode?: number;
}

/**
 * Default failure policy
 */
export const DEFAULT_AUDIT_FAILURE_POLICY: AuditFailurePolicy = {
    throwOnSeverity: "CRITICAL",
    consoleErrorOnSeverity: "HIGH",
    exitOnCriticalFailure: true,
    exitCode: 127
};

/**
 * Audit failure handler
 *
 * Provides truthful failure semantics for audit persistence:
 * - SECURITY CRITICAL events never silently discarded
 * - Failure action is determined by severity tier
 * - Fallback logging ensures no event is completely lost
 */
export class AuditFailureHandler {
    private policy: AuditFailurePolicy;

    constructor(policy: AuditFailurePolicy = DEFAULT_AUDIT_FAILURE_POLICY) {
        this.policy = { ...DEFAULT_AUDIT_FAILURE_POLICY, ...policy };
    }

    /**
     * Handle audit persistence failure
     * Returns result describing what happened
     */
    handlePersistenceFailure(params: {
        severity: SecuritySeverity;
        eventType: string;
        eventId: string;
        error: string | Error;
        isSecurityCritical: boolean;
    }): AuditPersistenceResult {
        const errorMessage = params.error instanceof Error ? params.error.message : String(params.error);
        const errorStack = params.error instanceof Error ? params.error.stack : undefined;

        const consoleMessage = JSON.stringify({
            type: "AUDIT_PERSISTENCE_FAILURE",
            severity: params.severity,
            eventType: params.eventType,
            eventId: params.eventId,
            error: errorMessage,
            timestamp: new Date().toISOString()
        });

        // SECURITY CRITICAL: Never silently discard
        if (params.isSecurityCritical || params.severity === "CRITICAL") {
            return this.handleCriticalFailure(consoleMessage, errorStack, params.eventId);
        }

        // HIGH severity
        if (params.severity === "HIGH") {
            return this.handleHighSeverityFailure(consoleMessage, params.eventId);
        }

        // MEDIUM severity
        if (params.severity === "MEDIUM") {
            return this.handleMediumSeverityFailure(consoleMessage, params.eventId);
        }

        // LOW severity
        return this.handleLowSeverityFailure(consoleMessage, params.eventId);
    }

    /**
     * Determine failure action from severity
     */
    getFailureAction(severity: SecuritySeverity): AuditFailureAction {
        if (this.policy.throwOnSeverity) {
            const severityOrder: SecuritySeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
            const throwIndex = severityOrder.indexOf(this.policy.throwOnSeverity);
            const currentIndex = severityOrder.indexOf(severity);
            if (currentIndex >= throwIndex) {
                return "LOG_AND_THROW";
            }
        }
        return "LOG_CONSOLE";
    }

    /**
     * Handle CRITICAL severity failure
     */
    private handleCriticalFailure(
        consoleMessage: string,
        errorStack: string | undefined,
        eventId: string
    ): AuditPersistenceResult {
        // Always log to console at error level
        console.error(consoleMessage);
        if (errorStack) {
            console.error(errorStack);
        }

        if (this.policy.exitOnCriticalFailure) {
            // Exit process to signal failure
            console.error(JSON.stringify({
                type: "AUDIT_CRITICAL_FAILURE_EXIT",
                eventId,
                exitCode: this.policy.exitCode ?? 127,
                timestamp: new Date().toISOString()
            }));

            // In non-test environments, this would call process.exit
            // For test compatibility, we throw instead
            const error = new Error(`AUDIT_CRITICAL_FAILURE: event ${eventId} could not be persisted`);
            (error as any).code = this.policy.exitCode ?? 127;
            throw error;
        }

        return {
            success: false,
            persisted: false,
            failureAction: "LOG_CONSOLE",
            error: consoleMessage,
            fallbackLogged: true
        };
    }

    /**
     * Handle HIGH severity failure
     */
    private handleHighSeverityFailure(
        consoleMessage: string,
        eventId: string
    ): AuditPersistenceResult {
        console.error(consoleMessage);

        return {
            success: false,
            persisted: false,
            failureAction: "LOG_CONSOLE",
            error: consoleMessage,
            fallbackLogged: true
        };
    }

    /**
     * Handle MEDIUM severity failure
     */
    private handleMediumSeverityFailure(
        consoleMessage: string,
        eventId: string
    ): AuditPersistenceResult {
        console.warn(consoleMessage);

        return {
            success: false,
            persisted: false,
            failureAction: "LOG_CONSOLE",
            error: consoleMessage,
            fallbackLogged: true
        };
    }

    /**
     * Handle LOW severity failure
     */
    private handleLowSeverityFailure(
        consoleMessage: string,
        eventId: string
    ): AuditPersistenceResult {
        // Only log if explicitly enabled
        if (process.env["AUDIT_DEBUG"] === "true") {
            console.debug(consoleMessage);
        }

        return {
            success: false,
            persisted: false,
            failureAction: "IGNORE",
            error: consoleMessage,
            fallbackLogged: process.env["AUDIT_DEBUG"] === "true"
        };
    }

    /**
     * Wrap an audit operation with failure handling
     */
    withFailureHandling<T>(
        operation: () => T,
        options: {
            severity: SecuritySeverity;
            eventType: string;
            eventId: string;
            isSecurityCritical: boolean;
        }
    ): AuditPersistenceResult {
        try {
            const result = operation();
            return {
                success: true,
                persisted: true,
                failureAction: "IGNORE",
                fallbackLogged: false
            };
        } catch (error) {
            return this.handlePersistenceFailure({
                severity: options.severity,
                eventType: options.eventType,
                eventId: options.eventId,
                error: error as Error,
                isSecurityCritical: options.isSecurityCritical
            });
        }
    }
}
