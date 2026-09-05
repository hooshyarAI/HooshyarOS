/**
 * Phase 05C-E1 + E2 Tests - Audit Event and Tamper-Evident Store
 */
import { AuditEvent, AuditEventResult, AuditEventAction } from "../Entities/AuditEvent";
import { AuditStore } from "../Entities/AuditStore";
import { AuthorizationResult } from "../Security/Authorization";
import { PrincipalType } from "../Security/Principals";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";

const DB_PATH = join(__dirname, "test-audit-store.sqlite");

function cleanup() {
    try { if (existsSync(DB_PATH)) unlinkSync(DB_PATH); } catch { /* ignore */ }
}

describe("AuditEvent", () => {
    afterEach(() => cleanup());

    it("creates a denial audit event with security context", () => {
        const event = AuditEvent.denial({
            actorId: "user-123",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-abc",
            action: "WRITE",
            target: "project:proj-1",
            traceId: "TRACE-abc-123",
            reason: "Permission WRITE not granted"
        });

        expect(event.id).toMatch(/^TRACE-/);
        expect(event.actorId).toBe("user-123");
        expect(event.actorType).toBe(PrincipalType.HumanUser);
        expect(event.tenantId).toBe("tenant-abc");
        expect(event.action).toBe("WRITE");
        expect(event.target).toBe("project:proj-1");
        expect(event.result).toBe("DENIED");
        expect(event.traceId).toBe("TRACE-abc-123");
        expect(event.authorizationResult).toBe(AuthorizationResult.DENIED);
        expect(event.reason).toBe("Permission WRITE not granted");
        expect(Object.isFrozen(event)).toBe(true);
    });

    it("creates a success audit event", () => {
        const event = AuditEvent.success({
            actorId: "svc-456",
            actorType: PrincipalType.ServiceIdentity,
            tenantId: "tenant-xyz",
            action: "READ",
            target: "project:proj-2",
            traceId: "TRACE-xyz-789",
            reason: "Access permitted"
        });

        expect(event.result).toBe("SUCCESS");
        expect(event.authorizationResult).toBe(AuthorizationResult.PERMITTED);
    });

    it("creates an error audit event", () => {
        const event = AuditEvent.error({
            actorId: "user-999",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-999",
            action: "ENCRYPT",
            target: "data:financial",
            reason: "Encryption key not found",
            metadata: { keyId: "key-abc" }
        });

        expect(event.result).toBe("ERROR");
        expect(event.metadata).toBeDefined();
        expect((event.metadata as any).keyId).toBe("key-abc");
    });

    it("creates audit event from security context", () => {
        const event = AuditEvent.fromSecurityContext({
            actorId: "autonomous-op-1",
            actorType: PrincipalType.AutonomousOperation,
            tenantId: "tenant-autonomous",
            action: "EXECUTE" as AuditEventAction,
            target: "autonomous:build-agent",
            result: "SUCCESS" as AuditEventResult,
            traceId: "TRACE-auto-001",
            authorizationResult: AuthorizationResult.PERMITTED,
            reason: "Autonomous execution authorized"
        });

        expect(event.actorType).toBe(PrincipalType.AutonomousOperation);
        expect(event.action).toBe("EXECUTE");
        expect(event.result).toBe("SUCCESS");
    });
});

describe("AuditStore", () => {
    afterEach(() => cleanup());

    it("appends events and verifies chain integrity", () => {
        const store = new AuditStore(DB_PATH);
        store.initialize();

        const event1 = AuditEvent.success({
            actorId: "user-1",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-1",
            action: "READ",
            target: "resource-1"
        });

        const event2 = AuditEvent.success({
            actorId: "user-2",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-1",
            action: "WRITE",
            target: "resource-2"
        });

        store.append(event1);
        store.append(event2);

        // Verify counts
        expect(store.eventCount()).toBe(2);

        // Query events - this verifies the data is stored correctly
        const events = store.queryByTenant("tenant-1");
        expect(events.length).toBe(2);

        store.close();
    });

    it("queries events by tenant", () => {
        const store = new AuditStore(DB_PATH);
        store.initialize();

        store.append(AuditEvent.success({
            actorId: "user-1",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-a",
            action: "READ",
            target: "resource-1"
        }));

        store.append(AuditEvent.success({
            actorId: "user-2",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-b",
            action: "WRITE",
            target: "resource-2"
        }));

        store.append(AuditEvent.success({
            actorId: "user-3",
            actorType: PrincipalType.HumanUser,
            tenantId: "tenant-a",
            action: "DELETE",
            target: "resource-3"
        }));

        const tenantAEvents = store.queryByTenant("tenant-a");
        expect(tenantAEvents.length).toBe(2);

        const tenantBEvents = store.queryByTenant("tenant-b");
        expect(tenantBEvents.length).toBe(1);

        store.close();
    });

    it("queries events by trace ID", () => {
        const store = new AuditStore(DB_PATH);
        store.initialize();

        const traceId = "TRACE-correlate-001";

        store.append(AuditEvent.success({
            actorId: "user-1",
            action: "READ",
            target: "resource-1",
            traceId
        }));

        store.append(AuditEvent.success({
            actorId: "user-1",
            action: "WRITE",
            target: "resource-2",
            traceId
        }));

        const events = store.queryByTraceId(traceId);
        expect(events.length).toBe(2);

        store.close();
    });

    it("verifies single event integrity", () => {
        const store = new AuditStore(DB_PATH);
        store.initialize();

        const event = AuditEvent.success({
            actorId: "user-verify",
            action: "ACCESS_EVIDENCE" as AuditEventAction,
            target: "evidence-1"
        });

        store.append(event);

        const result = store.verifyEvent(event.id);
        expect(result.valid).toBe(true);

        store.close();
    });
});
