/**
 * Phase 05C-C - Tenant Isolation Tests
 *
 * Tests tenant boundary enforcement:
 * 1. tenant-scoped resource with matching tenant is accepted
 * 2. tenant-scoped resource with missing context tenant is rejected
 * 3. tenant-scoped resource with mismatched tenant is rejected
 * 4. global/system resource can remain unscoped
 * 5. cross-tenant READ is rejected
 * 6. cross-tenant WRITE is rejected
 * 7. cross-tenant EXECUTE is rejected where applicable
 * 8. autonomous operation cannot cross tenant boundary
 * 9. tenant-scoped evidence cannot cross tenant boundary
 * 10. existing Phase 05C-B authorization behavior remains green
 * 11. existing Phase 05A/05B provenance behavior remains green
 */

import { Authorization, AuthorizationResult } from "../Security/Authorization";
import { Principal, PrincipalType } from "../Security/Principals";
import { SecurityContext } from "../Security/SecurityContext";
import { TenantIsolation, TenantResource, isTenantResource } from "../Security/TenantIsolation";

/**
 * Mock tenant-scoped resource
 */
class MockTenantProject implements TenantResource {
    constructor(readonly tenantId: string, readonly name: string) {}
}

/**
 * Mock global/system resource (not implementing TenantResource)
 */
class MockSystemConfig {
    constructor(readonly key: string, readonly value: string) {}
}

describe("Phase 05C-C - Tenant Isolation", () => {

    describe("Rule 1: tenant-scoped resource with matching tenant is accepted", () => {
        it("allows access when tenant matches", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);
            const resource = new MockTenantProject("tenant-A", "Project A");

            const result = TenantIsolation.checkAccess(context, resource, Authorization.READ);

            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("allows write when tenant matches", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.WRITE]);
            const resource = new MockTenantProject("tenant-A", "Project A");

            const result = TenantIsolation.checkAccess(context, resource, Authorization.WRITE);

            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("Rule 2: tenant-scoped resource with missing context tenant is rejected", () => {
        it("rejects when context has no tenant", () => {
            // System service without tenant
            const service = Principal.serviceIdentity("system-svc");
            const context = SecurityContext.forService(service, [Authorization.READ]);
            const resource = new MockTenantProject("tenant-A", "Project A");

            const result = TenantIsolation.checkAccess(context, resource, Authorization.READ);

            expect(result.result).toBe(AuthorizationResult.MISSING_CONTEXT);
            expect(result.reason).toContain("Tenant context required");
        });

        it("rejects when context tenant is undefined", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);
            // Override tenant to simulate missing
            const contextNoTenant = { ...context, tenantId: undefined };
            const resource = new MockTenantProject("tenant-A", "Project A");

            const result = TenantIsolation.checkAccess(contextNoTenant, resource, Authorization.READ);

            expect(result.result).toBe(AuthorizationResult.MISSING_CONTEXT);
        });
    });

    describe("Rule 3: tenant-scoped resource with mismatched tenant is rejected", () => {
        it("rejects cross-tenant access", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);
            const resource = new MockTenantProject("tenant-B", "Project B");

            const result = TenantIsolation.checkAccess(context, resource, Authorization.READ);

            expect(result.result).toBe(AuthorizationResult.DENIED);
            expect(result.reason).toContain("Tenant mismatch");
        });
    });

    describe("Rule 4: global/system resource can remain unscoped", () => {
        it("allows access to non-tenant resource", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);
            // Global resource - tenantId is undefined (not set)
            const globalResource: TenantResource = { tenantId: undefined };

            const result = TenantIsolation.checkAccess(context, globalResource, Authorization.READ);

            expect(result.result).toBe(AuthorizationResult.PERMITTED);
            expect(result.reason).toContain("Global resource");
        });

        it("isTenantResource returns false for non-tenant resources", () => {
            const globalResource = { key: "system.config", value: "true" };
            expect(isTenantResource(globalResource)).toBe(false);
        });

        it("isTenantResource returns true for tenant resources", () => {
            const resource = new MockTenantProject("tenant-A", "Project");
            expect(isTenantResource(resource)).toBe(true);
        });
    });

    describe("Rule 5: cross-tenant READ is rejected", () => {
        it("rejects cross-tenant READ", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);
            const tenantBResource = new MockTenantProject("tenant-B", "Tenant B Project");

            const result = TenantIsolation.checkAccess(context, tenantBResource, Authorization.READ);

            expect(result.result).toBe(AuthorizationResult.DENIED);
        });
    });

    describe("Rule 6: cross-tenant WRITE is rejected", () => {
        it("rejects cross-tenant WRITE", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.WRITE]);
            const tenantBResource = new MockTenantProject("tenant-B", "Tenant B Project");

            const result = TenantIsolation.checkAccess(context, tenantBResource, Authorization.WRITE);

            expect(result.result).toBe(AuthorizationResult.DENIED);
        });
    });

    describe("Rule 7: cross-tenant EXECUTE is rejected where applicable", () => {
        it("rejects cross-tenant EXECUTE for human users", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.EXECUTE]);
            const tenantBResource = new MockTenantProject("tenant-B", "Tenant B Project");

            const result = TenantIsolation.checkAccess(context, tenantBResource, Authorization.EXECUTE);

            expect(result.result).toBe(AuthorizationResult.DENIED);
        });
    });

    describe("Rule 8: autonomous operation cannot cross tenant boundary", () => {
        it("rejects cross-tenant autonomous operation on tenant-scoped resource", () => {
            const op = Principal.autonomousOperation("op-1", "KiloCode", "tenant-A");
            const context = SecurityContext.forAutonomousOperation(op);
            const tenantBResource = new MockTenantProject("tenant-B", "Tenant B Project");

            const result = TenantIsolation.checkAccess(context, tenantBResource, Authorization.EXECUTE);

            expect(result.result).toBe(AuthorizationResult.DENIED);
            expect(result.reason).toContain("Tenant mismatch");
        });

        it("allows autonomous operation within same tenant", () => {
            const op = Principal.autonomousOperation("op-1", "KiloCode", "tenant-A");
            const context = SecurityContext.forAutonomousOperation(op);
            const tenantAResource = new MockTenantProject("tenant-A", "Tenant A Project");

            const result = TenantIsolation.checkAccess(context, tenantAResource, Authorization.EXECUTE);

            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("autonomous operation on global resource is permitted", () => {
            const op = Principal.autonomousOperation("op-1", "KiloCode", "tenant-A");
            const context = SecurityContext.forAutonomousOperation(op);
            // Undefined tenantId = global resource
            const globalResource: TenantResource = { tenantId: undefined };

            const result = TenantIsolation.checkAccess(context, globalResource, Authorization.EXECUTE);

            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("Rule 9: tenant-scoped evidence cannot cross tenant boundary", () => {
        it("rejects cross-tenant ACCESS_EVIDENCE", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.ACCESS_EVIDENCE]);
            // Evidence belongs to tenant B
            const evidence = { tenantId: "tenant-B", traceId: "TRACE-123" } as TenantResource;

            const result = TenantIsolation.checkAccess(context, evidence, Authorization.ACCESS_EVIDENCE);

            expect(result.result).toBe(AuthorizationResult.DENIED);
        });

        it("allows same-tenant ACCESS_EVIDENCE", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human, [Authorization.ACCESS_EVIDENCE]);
            const evidence = { tenantId: "tenant-A", traceId: "TRACE-123" } as TenantResource;

            const result = TenantIsolation.checkAccess(context, evidence, Authorization.ACCESS_EVIDENCE);

            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("Rule 10: existing Phase 05C-B authorization behavior remains green", () => {
        it("missing actor still rejected by tenant isolation", () => {
            const context = SecurityContext.empty();
            const resource = new MockTenantProject("tenant-A", "Project A");

            const result = TenantIsolation.checkAccess(context, resource, Authorization.READ);

            expect(result.result).toBe(AuthorizationResult.MISSING_CONTEXT);
        });

        it("deny-by-default works when combined with AuthorizationGuard", () => {
            const { AuthorizationGuard } = require("../Security/AuthorizationGuard");
            const human = Principal.humanUser("user-1", "tenant-A");
            // Only has READ permission
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);
            const resource = new MockTenantProject("tenant-A", "Project A");

            // First check tenant isolation (should pass)
            const isolationResult = TenantIsolation.checkAccess(context, resource, Authorization.WRITE);
            expect(isolationResult.result).toBe(AuthorizationResult.PERMITTED); // Tenant matches

            // Then check authorization (should deny - deny by default)
            const authResult = AuthorizationGuard.check(context, Authorization.WRITE);
            expect(authResult.result).toBe(AuthorizationResult.DENIED); // Deny by default
        });
    });

    describe("Rule 11: existing Phase 05A/05B provenance behavior remains green", () => {
        it("evidence can be created without tenant context (Phase 05B)", () => {
            // In Phase 05B, DecisionContext can be created without tenant
            // This should continue to work
            const { DecisionContext } = require("../Core/DecisionContext");
            const ctx = DecisionContext.unavailable();

            expect(ctx.traceId).toBeUndefined();
            expect(ctx.tenantId).toBeUndefined();
        });

        it("isTenantResource correctly identifies tenant resources", () => {
            const tenantResource = { tenantId: "tenant-A" };
            const nonTenantResource = { name: "Project A" };

            expect(isTenantResource(tenantResource)).toBe(true);
            expect(isTenantResource(nonTenantResource)).toBe(false);
            expect(isTenantResource(null)).toBe(false);
            expect(isTenantResource(undefined)).toBe(false);
        });
    });

    describe("Additional: Multiple tenant scenarios", () => {
        it("service from tenant A can access tenant A resource", () => {
            const service = Principal.serviceIdentity("svc-1", "tenant-A");
            const context = SecurityContext.forService(service, [Authorization.READ, Authorization.WRITE]);
            const resource = new MockTenantProject("tenant-A", "Project A");

            const result = TenantIsolation.checkAccess(context, resource, Authorization.WRITE);

            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("external integration from tenant A cannot access tenant B resource", () => {
            const ext = Principal.externalIntegration("ext-1", "tenant-A");
            const context = SecurityContext.forExternalIntegration(ext, [Authorization.READ]);
            const resource = new MockTenantProject("tenant-B", "Project B");

            const result = TenantIsolation.checkAccess(context, resource, Authorization.READ);

            expect(result.result).toBe(AuthorizationResult.DENIED);
        });
    });
});
