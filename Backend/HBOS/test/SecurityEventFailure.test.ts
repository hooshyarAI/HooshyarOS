/**
 * Phase 05C-E3 + E5 Tests - Security Event Logger and Failure Semantics
 */
import { SecurityEventLogger } from "../Entities/SecurityEventLogger";
import { AuditFailureHandler } from "../Entities/AuditFailureHandler";
import { PrincipalType } from "../Security/Principals";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";

const DB_PATH = join(__dirname, "test-security-events.sqlite");

function cleanup() {
    try { if (existsSync(DB_PATH)) unlinkSync(DB_PATH); } catch { /* ignore */ }
}

describe("SecurityEventLogger", () => {
    afterEach(() => cleanup());

    it("logs authorization denial", () => {
        const logger = new SecurityEventLogger(DB_PATH);

        const event = logger.logAuthorizationDenial({
            actorId: "user-123",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-abc",
            target: "project:proj-1",
            traceId: "TRACE-deny-001",
            reason: "WRITE permission not granted"
        });

        expect(event.eventType).toBe("AUTHORIZATION_DENIAL");
        expect(event.severity).toBe("HIGH");
        expect(event.actorId).toBe("user-123");
        expect(event.authorizationResult).toBe("DENIED");
        expect(event.reason).toContain("WRITE permission");

        const integrity = logger.verifyIntegrity();
        expect(integrity.valid).toBe(true);

        logger.close();
    });

    it("logs tenant boundary violation as CRITICAL", () => {
        const logger = new SecurityEventLogger(DB_PATH);

        const event = logger.logTenantViolation({
            actorId: "user-cross",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-a",
            requestedTenantId: "tenant-b",
            target: "project:proj-b",
            reason: "Cross-tenant access denied"
        });

        expect(event.eventType).toBe("TENANT_VIOLATION");
        expect(event.severity).toBe("CRITICAL");
        expect(event.metadata).toBeDefined();
        expect((event.metadata as any).requestedTenantId).toBe("tenant-b");

        logger.close();
    });

    it("logs evidence access denial", () => {
        const logger = new SecurityEventLogger(DB_PATH);

        const event = logger.logEvidenceAccessDenial({
            actorId: "user-noevidence",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-ev",
            target: "evidence:audit-001",
            reason: "ACCESS_EVIDENCE permission required"
        });

        expect(event.eventType).toBe("EVIDENCE_ACCESS_DENIAL");
        expect(event.severity).toBe("HIGH");

        logger.close();
    });

    it("logs authentication failure", () => {
        const logger = new SecurityEventLogger(DB_PATH);

        const event = logger.logAuthenticationFailure({
            actorId: "unknown-user",
            target: "auth:login",
            reason: "Invalid credentials",
            metadata: { attemptCount: 3 }
        });

        expect(event.eventType).toBe("AUTHENTICATION_FAILURE");
        expect(event.severity).toBe("HIGH");
        expect(event.tenantId).toBeUndefined();

        logger.close();
    });

    it("logs integrity violation as CRITICAL", () => {
        const logger = new SecurityEventLogger(DB_PATH);

        const event = logger.logIntegrityViolation({
            target: "audit:event-123",
            reason: "Hash chain broken",
            details: "Expected hash did not match computed hash"
        });

        expect(event.eventType).toBe("INTEGRITY_VIOLATION");
        expect(event.severity).toBe("CRITICAL");
        expect(event.actorId).toBeUndefined();

        logger.close();
    });

    it("logs authorization permission at LOW severity", () => {
        const logger = new SecurityEventLogger(DB_PATH);

        const event = logger.logAuthorizationPermission({
            actorId: "user-ok",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-ok",
            target: "project:proj-ok",
            reason: "Access permitted"
        });

        expect(event.eventType).toBe("AUTHORIZATION_PERMISSION");
        expect(event.severity).toBe("LOW");

        logger.close();
    });

    it("returns empty array when no audit store configured", () => {
        const logger = new SecurityEventLogger();
        const events = logger.getEventsByTenant("tenant-xyz");
        expect(events.length).toBe(0);
        logger.close();
    });
});

describe("AuditFailureHandler", () => {
    it("throws on CRITICAL security-critical failure", () => {
        const handler = new AuditFailureHandler({
            throwOnSeverity: "CRITICAL",
            exitOnCriticalFailure: true,
            exitCode: 127
        });

        expect(() => {
            handler.handlePersistenceFailure({
                severity: "CRITICAL",
                eventType: "TENANT_VIOLATION",
                eventId: "evt-123",
                error: "Database write failed",
                isSecurityCritical: true
            });
        }).toThrow("AUDIT_CRITICAL_FAILURE");
    });

    it("logs and continues on HIGH severity failure", () => {
        const handler = new AuditFailureHandler({
            throwOnSeverity: "CRITICAL"
        });

        const result = handler.handlePersistenceFailure({
            severity: "HIGH",
            eventType: "AUTHORIZATION_DENIAL",
            eventId: "evt-456",
            error: "Database unavailable",
            isSecurityCritical: false
        });

        expect(result.success).toBe(false);
        expect(result.persisted).toBe(false);
        expect(result.failureAction).toBe("LOG_CONSOLE");
        expect(result.fallbackLogged).toBe(true);
    });

    it("logs warning on MEDIUM severity failure", () => {
        const handler = new AuditFailureHandler();

        const result = handler.handlePersistenceFailure({
            severity: "MEDIUM",
            eventType: "CONFIG_CHANGE",
            eventId: "evt-789",
            error: "Minor persistence issue",
            isSecurityCritical: false
        });

        expect(result.success).toBe(false);
        expect(result.failureAction).toBe("LOG_CONSOLE");
    });

    it("silently ignores LOW severity failure unless AUDIT_DEBUG is set", () => {
        const handler = new AuditFailureHandler();

        const result = handler.handlePersistenceFailure({
            severity: "LOW",
            eventType: "ROUTINE_EVENT",
            eventId: "evt-low",
            error: "Routine log",
            isSecurityCritical: false
        });

        expect(result.success).toBe(false);
        expect(result.failureAction).toBe("IGNORE");
        expect(result.fallbackLogged).toBe(false);
    });

    it("determines failure action from severity", () => {
        const handler = new AuditFailureHandler({
            throwOnSeverity: "HIGH"
        });

        expect(handler.getFailureAction("CRITICAL")).toBe("LOG_AND_THROW");
        expect(handler.getFailureAction("HIGH")).toBe("LOG_AND_THROW");
        expect(handler.getFailureAction("MEDIUM")).toBe("LOG_CONSOLE");
        expect(handler.getFailureAction("LOW")).toBe("LOG_CONSOLE");
    });
});
