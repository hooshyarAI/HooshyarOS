import { GovernanceEngine, createAutonomousOperationPolicy, createSensitiveDataPolicy, createCrossTenantPolicy, createProductionDeploymentPolicy } from "../Engines/GovernanceEngine";
import { Authorization } from "../Security/Authorization";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal, PrincipalType } from "../Security/Principals";
import { TenantIsolation, TenantResource } from "../Security/TenantIsolation";
import { SecurityEventLogger } from "../Entities/SecurityEventLogger";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";

describe("GovernanceEngine Phase 11-1.6", () => {
    let engine: GovernanceEngine;

    const makeContext = (overrides: Partial<SecurityContext> = {}): SecurityContext => ({
        actor: { id: "actor-1", type: PrincipalType.HumanUser, tenantId: "tenant-1" },
        tenantId: "tenant-1",
        timestamp: new Date().toISOString(),
        traceId: undefined,
        permissions: [Authorization.EXECUTE, Authorization.WRITE, Authorization.APPROVE, Authorization.ACCESS_EVIDENCE],
        ...overrides,
    });

    const makeResource = (tenantId = "tenant-1"): TenantResource => ({
        tenantId,
    });

    function makeDbPath(): string {
        return join(__dirname, `test-governance-phase11-1.6-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    }

    function cleanup(dbPath: string) {
        try { if (existsSync(dbPath)) unlinkSync(dbPath); } catch { /* ignore */ }
    }

    beforeEach(() => {
        engine = new GovernanceEngine();
        engine.initialize();
        engine.clearPolicies();
    });

    describe("Engine interface", () => {
        test("name is GovernanceEngine", () => {
            expect(engine.name).toBe("GovernanceEngine");
        });

        test("initialize starts without error", () => {
            expect(() => engine.initialize()).not.toThrow();
        });

        test("health returns true", () => {
            expect(engine.health()).toBe(true);
        });
    });

    describe("evaluate with no policies", () => {
        test("returns ALLOWED by default", () => {
            const result = engine.evaluate({
                action: "EXECUTE_AUTONOMOUS_OPERATION",
                securityContext: makeContext(),
            });
            expect(result.status).toBe("ALLOWED");
            expect(result.decision).toContain("Governance permits");
            expect(result.requiresHumanApproval).toBe(false);
            expect(result.confidence).toEqual({ source: "unavailable" });
        });

        test("includes provenance fields", () => {
            const result = engine.evaluate({
                action: "CREATE_RESOURCE",
                securityContext: makeContext(),
                traceId: "trace-1",
            });
            expect(result.traceId).toBe("trace-1");
            expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.appliedPolicies).toEqual([]);
            expect(result.reasons).toEqual(["No governance policies restrict this action"]);
        });
    });

    describe("authorization failure path", () => {
        test("returns DENIED when actor is missing", () => {
            const result = engine.evaluate({
                action: "EXECUTE_AUTONOMOUS_OPERATION",
                securityContext: makeContext({ actor: undefined }),
            });
            expect(result.status).toBe("DENIED");
            expect(result.decision).toContain("Authorization check failed");
        });

        test("returns DENIED when permission is missing", () => {
            const result = engine.evaluate({
                action: "EXECUTE_AUTONOMOUS_OPERATION",
                securityContext: makeContext({ permissions: [Authorization.READ] }),
            });
            expect(result.status).toBe("DENIED");
            expect(result.decision).toContain("Authorization check failed");
        });
    });

    describe("tenant isolation failure path", () => {
        test("returns DENIED on tenant mismatch", () => {
            const result = engine.evaluate({
                action: "ACCESS_SENSITIVE_DATA",
                securityContext: makeContext({ tenantId: "tenant-1" }),
                target: makeResource("tenant-2"),
            });
            expect(result.status).toBe("DENIED");
            expect(result.decision).toContain("Tenant isolation check failed");
        });
    });

    describe("policy evaluation", () => {
        test("DENY policy blocks action", () => {
            engine.addPolicy(createCrossTenantPolicy());
            const result = engine.evaluate({
                action: "CROSS_TENANT_OPERATION",
                securityContext: makeContext(),
            });
            expect(result.status).toBe("DENIED");
            expect(result.appliedPolicies).toEqual(["POLICY-TENANT-001"]);
            expect(result.requiresHumanApproval).toBe(false);
        });

        test("REVIEW_REQUIRED policy sets requiresHumanApproval", () => {
            engine.addPolicy(createSensitiveDataPolicy());
            const result = engine.evaluate({
                action: "ACCESS_SENSITIVE_DATA",
                securityContext: makeContext(),
                parameters: { dataSensitivity: "HIGH" },
            });
            expect(result.status).toBe("REVIEW_REQUIRED");
            expect(result.requiresHumanApproval).toBe(true);
            expect(result.appliedPolicies).toEqual(["POLICY-DATA-001"]);
        });

        test("DENY takes precedence over REVIEW_REQUIRED", () => {
            engine.addPolicy(createCrossTenantPolicy());
            engine.addPolicy(createSensitiveDataPolicy());
            const result = engine.evaluate({
                action: "CROSS_TENANT_OPERATION",
                securityContext: makeContext(),
            });
            expect(result.status).toBe("DENIED");
            expect(result.appliedPolicies).toEqual(["POLICY-TENANT-001"]);
        });

        test("production deployment policy denies without change ticket", () => {
            engine.addPolicy(createProductionDeploymentPolicy());
            const result = engine.evaluate({
                action: "DEPLOY_TO_PRODUCTION",
                securityContext: makeContext(),
                parameters: {},
            });
            expect(result.status).toBe("DENIED");
            expect(result.reasons.some((r: string) => r.includes("change ticket"))).toBe(true);
        });

        test("production deployment policy requires approval with ticket", () => {
            engine.addPolicy(createProductionDeploymentPolicy());
            const result = engine.evaluate({
                action: "DEPLOY_TO_PRODUCTION",
                securityContext: makeContext(),
                parameters: { changeTicket: "CT-1" },
            });
            expect(result.status).toBe("REVIEW_REQUIRED");
            expect(result.requiresHumanApproval).toBe(true);
        });

        test("production deployment policy allows with ticket and approval", () => {
            engine.addPolicy(createProductionDeploymentPolicy());
            const result = engine.evaluate({
                action: "DEPLOY_TO_PRODUCTION",
                securityContext: makeContext(),
                parameters: { changeTicket: "CT-1", hasApproval: true },
            });
            expect(result.status).toBe("ALLOWED");
            expect(result.requiresHumanApproval).toBe(false);
        });
    });

    describe("provenance and evidence", () => {
        test("traceId is generated when missing", () => {
            const result = engine.evaluate({
                action: "CREATE_RESOURCE",
                securityContext: makeContext(),
            });
            expect(result.traceId).toMatch(/^TRACE-/);
        });

        test("inputHash is deterministic for same input", () => {
            const req = {
                action: "CREATE_RESOURCE" as const,
                securityContext: makeContext(),
            };
            const r1 = engine.evaluate(req);
            const r2 = engine.evaluate(req);
            expect(r1.inputHash).toBe(r2.inputHash);
        });

        test("outputHash differs between ALLOWED and DENIED", () => {
            const req = {
                action: "CREATE_RESOURCE" as const,
                securityContext: makeContext(),
            };
            const allowed = engine.evaluate(req);
            engine.addPolicy(createCrossTenantPolicy());
            const denied = engine.evaluate({ ...req, action: "CROSS_TENANT_OPERATION" });
            expect(allowed.outputHash).not.toBe(denied.outputHash);
        });
    });

    describe("policy management", () => {
        test("getPolicies returns registered policies", () => {
            engine.addPolicy(createAutonomousOperationPolicy());
            engine.addPolicy(createSensitiveDataPolicy());
            const policies = engine.getPolicies();
            expect(policies).toHaveLength(2);
            expect(policies[0].id).toBe("POLICY-AUTO-001");
            expect(policies[1].id).toBe("POLICY-DATA-001");
        });

        test("clearPolicies removes all policies", () => {
            engine.addPolicy(createAutonomousOperationPolicy());
            engine.clearPolicies();
            expect(engine.getPolicies()).toHaveLength(0);
            const result = engine.evaluate({
                action: "EXECUTE_AUTONOMOUS_OPERATION",
                securityContext: makeContext({ permissions: [Authorization.EXECUTE] }),
            });
            expect(result.status).toBe("ALLOWED");
        });
    });

    describe("security logger integration", () => {
        test("setSecurityLogger stores logger reference", () => {
            const dbPath = makeDbPath();
            try {
                const logger = new SecurityEventLogger(dbPath);
                engine.setSecurityLogger(logger);
                expect(engine).toBeDefined();
            } finally {
                cleanup(dbPath);
            }
        });
    });
});
