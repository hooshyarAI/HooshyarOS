import { GovernanceEngine } from "../Engines/GovernanceEngine";
import { DecisionEngine } from "../Engines/DecisionEngine";
import { SecurityEventLogger } from "../Entities/SecurityEventLogger";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";
import { TenantResource } from "../Security/TenantIsolation";
import { Project } from "../Entities/Project";
import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

function makeDbPath(): string {
    return join(__dirname, `test-security-events-phase10-1.3-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

function cleanup(dbPath: string) {
    try { if (existsSync(dbPath)) unlinkSync(dbPath); } catch { /* ignore */ }
}

function queryEvents(dbPath: string): any[] {
    const db = new DatabaseSync(dbPath);
    return db.prepare("SELECT metadata_json, reason FROM audit_events ORDER BY sequence ASC").all() as any[];
}

describe("SecurityEventLogger Phase 10-1.3 -- Runtime Security Event Emission", () => {

    describe("GovernanceEngine emits security events", () => {
        it("governance denial emits a security event", () => {
            const dbPath = makeDbPath();
            const logger = new SecurityEventLogger(dbPath);
            const engine = new GovernanceEngine();
            engine.setSecurityLogger(logger);
            engine.initialize();

            const denyPolicy = {
                id: "DENY-POLICY",
                description: "Test deny",
                match: () => ({ matched: true }),
                evaluate: (): { effect: "DENY"; reason: string } => ({ effect: "DENY", reason: "Test deny" })
            };
            engine.addPolicy(denyPolicy);

            const request = {
                action: "CREATE_RESOURCE" as const,
                securityContext: SecurityContext.forHumanUser(
                    Principal.humanUser("user-1", "tenant-1"),
                    [Authorization.WRITE]
                )
            };

            const result = engine.evaluate(request);
            expect(result.status).toBe("DENIED");

            const events = queryEvents(dbPath);
            expect(events.length).toBeGreaterThanOrEqual(1);
            const metadata = JSON.parse(events[0].metadata_json);
            expect(metadata.securityEventType).toBe("AUTHORIZATION_DENIAL");
            expect(events[0].reason).toContain("Governance policy denies action");

            logger.close();
            cleanup(dbPath);
        });

        it("tenant mismatch emits a security event", () => {
            const dbPath = makeDbPath();
            const logger = new SecurityEventLogger(dbPath);
            const engine = new GovernanceEngine();
            engine.setSecurityLogger(logger);
            engine.initialize();

            const request = {
                action: "CREATE_RESOURCE" as const,
                target: { tenantId: "tenant-2" } as TenantResource,
                securityContext: SecurityContext.forHumanUser(
                    Principal.humanUser("user-1", "tenant-1"),
                    [Authorization.WRITE]
                )
            };

            const result = engine.evaluate(request);
            expect(result.status).toBe("DENIED");

            const events = queryEvents(dbPath);
            expect(events.length).toBeGreaterThanOrEqual(1);
            const metadata = JSON.parse(events[0].metadata_json);
            expect(metadata.securityEventType).toBe("TENANT_VIOLATION");
            expect(events[0].reason).toContain("Tenant isolation");

            logger.close();
            cleanup(dbPath);
        });
    });

    describe("DecisionEngine wires security logger", () => {
        it("DecisionEngine accepts security logger without error", () => {
            const dbPath = makeDbPath();
            const logger = new SecurityEventLogger(dbPath);
            const engine = new DecisionEngine();
            engine.setSecurityLogger(logger);
            engine.initialize();

            const project = new Project("test-project");
            const decision = engine.decide(project);
            expect(decision).toBeDefined();

            logger.close();
            cleanup(dbPath);
        });
    });

    describe("CommercialRuntimeServer emits security events on auth failure", () => {
        it("CommercialRuntimeServer auth failure emits a security event", async () => {
            const dbPath = makeDbPath();
            const logger = new SecurityEventLogger(dbPath);
            const server = createCommercialRuntimeServer({
                databasePath: ":memory:",
                reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true }) },
                securityEventLogger: logger
            });

            await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
            try {
                const address = server.address();
                if (!address || typeof address === "string") throw new Error("server-not-listening");
                const response = await fetch(`http://127.0.0.1:${address.port}/api/analyze`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: "{}"
                });
                expect(response.status).toBe(401);

                const db = new DatabaseSync(dbPath);
                const row = db.prepare("SELECT COUNT(*) as count FROM audit_events").get() as { count: number };
                expect(row.count).toBeGreaterThanOrEqual(1);

                const events = db.prepare("SELECT reason FROM audit_events ORDER BY sequence ASC").all() as { reason: string }[];
                expect(events.some(e => e.reason && e.reason.includes("AUTHENTICATION_FAILURE"))).toBe(true);
            } finally {
                await new Promise<void>((resolve) => server.close(() => resolve()));
                logger.close();
                cleanup(dbPath);
            }
        });
    });
});
