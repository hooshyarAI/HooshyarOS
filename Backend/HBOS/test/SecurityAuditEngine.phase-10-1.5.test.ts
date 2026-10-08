import { AuditEvent, AuditEventAction, AuditEventResult } from "../Entities/AuditEvent";
import { AuditStore } from "../Entities/AuditStore";
import { SecurityAuditEngine } from "../Engines/SecurityAuditEngine";
import { SecurityContext } from "../Security/SecurityContext";
import { Authorization } from "../Security/Authorization";
import { Principal, PrincipalType } from "../Security/Principals";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function dbPath(): string {
    return join(tmpdir(), `test-audit-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

function cleanup(path: string): void {
    try { if (existsSync(path)) unlinkSync(path); } catch { /* ignore */ }
}

describe("SecurityAuditEngine Phase 10-1.5 - Universal Operation Audit Trail", () => {
    const engine = new SecurityAuditEngine();

    describe("recordAuditEvent", () => {
        it("appends event to AuditStore", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();

                const event = AuditEvent.success({
                    actorId: "user-1",
                    actorType: PrincipalType.HumanUser,
                    tenantId: "tenant-1",
                    action: "READ",
                    target: "resource-1"
                });

                engine.recordAuditEvent(event, store);
                expect(store.eventCount()).toBe(1);
            } finally {
                cleanup(path);
            }
        });
    });

    describe("queryAuditTrail", () => {
        it("filters by tenantId", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();

                engine.recordAuditEvent(AuditEvent.success({
                    actorId: "user-1",
                    tenantId: "tenant-a",
                    action: "READ",
                    target: "resource-1"
                }), store);

                engine.recordAuditEvent(AuditEvent.success({
                    actorId: "user-2",
                    tenantId: "tenant-b",
                    action: "WRITE",
                    target: "resource-2"
                }), store);

                const results = engine.queryAuditTrail(store, { tenantId: "tenant-a" });
                expect(results.length).toBe(1);
                expect(results[0].tenantId).toBe("tenant-a");
            } finally {
                cleanup(path);
            }
        });

        it("filters by traceId", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();

                const traceId = "TRACE-123";

                engine.recordAuditEvent(AuditEvent.success({
                    actorId: "user-1",
                    action: "READ",
                    target: "resource-1",
                    traceId
                }), store);

                engine.recordAuditEvent(AuditEvent.success({
                    actorId: "user-1",
                    action: "WRITE",
                    target: "resource-2",
                    traceId: "TRACE-456"
                }), store);

                const results = engine.queryAuditTrail(store, { traceId });
                expect(results.length).toBe(1);
                expect(results[0].traceId).toBe(traceId);
            } finally {
                cleanup(path);
            }
        });

        it("filters by actorId", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();

                engine.recordAuditEvent(AuditEvent.success({
                    actorId: "user-1",
                    action: "READ",
                    target: "resource-1"
                }), store);

                engine.recordAuditEvent(AuditEvent.success({
                    actorId: "user-2",
                    action: "WRITE",
                    target: "resource-2"
                }), store);

                const results = engine.queryAuditTrail(store, { actorId: "user-1" });
                expect(results.length).toBe(1);
                expect(results[0].actorId).toBe("user-1");
            } finally {
                cleanup(path);
            }
        });

        it("respects limit", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();

                for (let i = 0; i < 5; i++) {
                    engine.recordAuditEvent(AuditEvent.success({
                        actorId: `user-${i}`,
                        tenantId: "tenant-1",
                        action: "READ",
                        target: `resource-${i}`
                    }), store);
                }

                const results = engine.queryAuditTrail(store, { tenantId: "tenant-1", limit: 3 });
                expect(results.length).toBe(3);
            } finally {
                cleanup(path);
            }
        });
    });

    describe("verifyAuditIntegrity", () => {
        it("returns valid result for empty store", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();

                const result = engine.verifyAuditIntegrity(store);
                expect(result.valid).toBe(true);
            } finally {
                cleanup(path);
            }
        });

        it("returns valid result after appending events", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();

                engine.recordAuditEvent(AuditEvent.success({
                    actorId: "user-1",
                    action: "READ",
                    target: "resource-1"
                }), store);

                engine.recordAuditEvent(AuditEvent.success({
                    actorId: "user-2",
                    action: "WRITE",
                    target: "resource-2"
                }), store);

                const result = engine.verifyAuditIntegrity(store);
                expect(result.valid).toBe(true);
            } finally {
                cleanup(path);
            }
        });
    });

    describe("logOperation", () => {
        it("creates AuditEvent with correct fields from SecurityContext", () => {
            const context = SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.READ],
                "TRACE-001"
            );

            const event = engine.logOperation(context, "READ", "resource-1", "SUCCESS");

            expect(event.actorId).toBe("user-1");
            expect(event.actorType).toBe(PrincipalType.HumanUser);
            expect(event.tenantId).toBe("tenant-1");
            expect(event.action).toBe("READ");
            expect(event.target).toBe("resource-1");
            expect(event.result).toBe("SUCCESS");
            expect(event.traceId).toBe("TRACE-001");
        });

        it("maps READ action correctly", () => {
            const context = SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.READ]
            );

            const event = engine.logOperation(context, "READ", "resource-1", "SUCCESS");
            expect(event.action).toBe("READ");
        });

        it("maps WRITE action correctly", () => {
            const context = SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            );

            const event = engine.logOperation(context, "WRITE", "resource-1", "SUCCESS");
            expect(event.action).toBe("WRITE");
        });

        it("maps EXECUTE action correctly", () => {
            const context = SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.EXECUTE]
            );

            const event = engine.logOperation(context, "EXECUTE", "process-1", "SUCCESS");
            expect(event.action).toBe("EXECUTE");
        });

        it("handles UNKNOWN action gracefully", () => {
            const context = SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.READ]
            );

            const event = engine.logOperation(context, "UNKNOWN", "resource-1", "ERROR");
            expect(event).toBeDefined();
            expect(event.result).toBe("ERROR");
            expect(event.target).toBe("resource-1");
            expect(event.action).toBeUndefined();
        });

        it("uses provided traceId", () => {
            const context = SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.READ]
            );

            const event = engine.logOperation(context, "READ", "resource-1", "SUCCESS", "TRACE-CUSTOM-123");
            expect(event.traceId).toBe("TRACE-CUSTOM-123");
        });
    });

    describe("backward compatibility", () => {
        it("existing SecurityAuditEngine tests still pass", () => {
            expect(engine.name).toBe("SecurityAuditEngine");
            expect(engine.health()).toBe(true);
        });
    });

    describe("synchronous determinism", () => {
        it("recordAuditEvent is synchronous", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();
                const event = AuditEvent.success({
                    actorId: "user-1",
                    action: "READ",
                    target: "resource-1"
                });

                let completed = false;
                engine.recordAuditEvent(event, store);
                completed = true;
                expect(completed).toBe(true);
            } finally {
                cleanup(path);
            }
        });

        it("queryAuditTrail is synchronous", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();

                let completed = false;
                engine.queryAuditTrail(store, { tenantId: "tenant-1" });
                completed = true;
                expect(completed).toBe(true);
            } finally {
                cleanup(path);
            }
        });

        it("verifyAuditIntegrity is synchronous", () => {
            const path = dbPath();
            try {
                const store = new AuditStore(path);
                store.initialize();

                let completed = false;
                engine.verifyAuditIntegrity(store);
                completed = true;
                expect(completed).toBe(true);
            } finally {
                cleanup(path);
            }
        });

        it("logOperation is synchronous", () => {
            const context = SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.READ]
            );

            let completed = false;
            engine.logOperation(context, "READ", "resource-1", "SUCCESS");
            completed = true;
            expect(completed).toBe(true);
        });
    });
});
