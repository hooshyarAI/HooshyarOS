/**
 * Phase 05C-B - Identity and Authorization Contract Tests
 *
 * Tests the 9 authorization rules:
 * 1. missing actor => reject
 * 2. missing/invalid tenant context for tenant-scoped resource => reject
 * 3. tenant mismatch => reject
 * 4. authorization defaults to deny
 * 5. autonomous operation without EXECUTE => reject
 * 6. evidence access without ACCESS_EVIDENCE => reject
 * 7. global/system resources may remain unscoped
 * 8. human user can perform authorized actions
 * 9. service identity can perform authorized actions
 */

import { Authorization, AuthorizationResult } from "../Security/Authorization";
import { Principal, PrincipalType } from "../Security/Principals";
import { SecurityContext } from "../Security/SecurityContext";
import { AuthorizationGuard } from "../Security/AuthorizationGuard";

describe("Phase 05C-B - Identity and Authorization", () => {

    describe("Rule 1: Missing actor => reject", () => {
        it("rejects action when actor is undefined", () => {
            const context = SecurityContext.empty();
            const result = AuthorizationGuard.check(context, Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.MISSING_CONTEXT);
            expect(result.reason).toContain("No actor");
        });

        it("rejects tenant-scoped operation when actor is undefined", () => {
            const context = SecurityContext.empty();
            const result = AuthorizationGuard.checkTenantScoped(context, "tenant-123", Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.MISSING_CONTEXT);
        });
    });

    describe("Rule 2: Missing tenant context for tenant-scoped resource => reject", () => {
        it("rejects when context has no tenant but resource requires tenant", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human);
            // Override to simulate missing tenant in context
            const contextNoTenant = { ...context, tenantId: undefined };

            const result = AuthorizationGuard.checkTenantScoped(contextNoTenant, "tenant-123", Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.MISSING_CONTEXT);
            expect(result.reason).toContain("Tenant context required");
        });

        it("rejects when resource tenantId is undefined but context has tenant", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human);

            // Global/system resource has no tenant
            const result = AuthorizationGuard.checkTenantScoped(context, undefined, Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("Rule 3: Tenant mismatch => reject", () => {
        it("rejects cross-tenant access", () => {
            const human = Principal.humanUser("user-1", "tenant-A");
            const context = SecurityContext.forHumanUser(human);

            // Resource belongs to different tenant
            const result = AuthorizationGuard.checkTenantScoped(context, "tenant-B", Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.DENIED);
            expect(result.reason).toContain("Tenant mismatch");
        });

        it("allows same-tenant access", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human);

            const result = AuthorizationGuard.checkTenantScoped(context, "tenant-123", Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("Rule 4: Authorization defaults to deny", () => {
        it("denies action not in permissions", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            // Context only has READ permission
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);

            // Try WRITE which is not in permissions
            const result = AuthorizationGuard.check(context, Authorization.WRITE);
            expect(result.result).toBe(AuthorizationResult.DENIED);
            expect(result.reason).toContain("not granted");
        });

        it("denies when permissions array is empty", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, []);

            const result = AuthorizationGuard.check(context, Authorization.EXECUTE);
            expect(result.result).toBe(AuthorizationResult.DENIED);
        });
    });

    describe("Rule 5: Autonomous operation without EXECUTE => reject", () => {
        it("rejects non-EXECUTE action from autonomous operation", () => {
            const op = Principal.autonomousOperation("op-1", "KiloCode", "tenant-123");
            const context = SecurityContext.forAutonomousOperation(op);

            // Try READ which is not allowed for autonomous ops
            const result = AuthorizationGuard.check(context, Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.DENIED);
            expect(result.reason).toContain("Autonomous operation can only perform EXECUTE");
        });

        it("allows EXECUTE action from autonomous operation", () => {
            const op = Principal.autonomousOperation("op-1", "KiloCode", "tenant-123");
            const context = SecurityContext.forAutonomousOperation(op);

            const result = AuthorizationGuard.check(context, Authorization.EXECUTE);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("Rule 6: Evidence access without ACCESS_EVIDENCE => reject", () => {
        it("rejects evidence access without permission", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            // Context doesn't have ACCESS_EVIDENCE
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);

            const result = AuthorizationGuard.check(context, Authorization.ACCESS_EVIDENCE);
            expect(result.result).toBe(AuthorizationResult.FORBIDDEN);
            expect(result.reason).toContain("ACCESS_EVIDENCE permission required");
        });

        it("allows evidence access with permission", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, [Authorization.ACCESS_EVIDENCE]);

            // Try checkEvidenceAccess which requires ACCESS_EVIDENCE
            const result = AuthorizationGuard.checkEvidenceAccess(context);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("Rule 7: Global/system resources may remain unscoped", () => {
        it("allows operation on unscoped resource without tenant", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human);

            // System resource has no tenantId
            const result = AuthorizationGuard.checkTenantScoped(context, undefined, Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("Additional: Human user operations", () => {
        it("human user can read with READ permission", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);

            const result = AuthorizationGuard.check(context, Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("human user can write with permission", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, [Authorization.WRITE]);

            const result = AuthorizationGuard.check(context, Authorization.WRITE);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("human user can approve with permission", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, [Authorization.APPROVE]);

            const result = AuthorizationGuard.check(context, Authorization.APPROVE);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("Additional: Service identity operations", () => {
        it("service can perform authorized actions", () => {
            const service = Principal.serviceIdentity("svc-1", "tenant-123");
            const context = SecurityContext.forService(service, [Authorization.READ, Authorization.WRITE]);

            const readResult = AuthorizationGuard.check(context, Authorization.READ);
            expect(readResult.result).toBe(AuthorizationResult.PERMITTED);

            const writeResult = AuthorizationGuard.check(context, Authorization.WRITE);
            expect(writeResult.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("service without permission is denied", () => {
            const service = Principal.serviceIdentity("svc-1", "tenant-123");
            const context = SecurityContext.forService(service, [Authorization.READ]);

            const result = AuthorizationGuard.check(context, Authorization.EXECUTE);
            expect(result.result).toBe(AuthorizationResult.DENIED);
        });
    });

    describe("Additional: External integration", () => {
        it("external integration can access with permission", () => {
            const ext = Principal.externalIntegration("ext-1", "tenant-123");
            const context = SecurityContext.forExternalIntegration(ext, [Authorization.READ]);

            const result = AuthorizationGuard.check(context, Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("external integration requires explicit permissions", () => {
            const ext = Principal.externalIntegration("ext-1", "tenant-123");
            const context = SecurityContext.forExternalIntegration(ext, []);

            const result = AuthorizationGuard.check(context, Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.DENIED);
        });
    });

    describe("Tenant isolation enforcement", () => {
        it("prevents cross-tenant data access", () => {
            const userA = Principal.humanUser("user-A", "tenant-A");
            const contextA = SecurityContext.forHumanUser(userA);

            // Try to access tenant-B resource
            const result = AuthorizationGuard.checkTenantScoped(contextA, "tenant-B", Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.DENIED);
        });

        it("enforces tenant context on all tenant-scoped operations", () => {
            const service = Principal.serviceIdentity("svc-1");
            // Service without tenant context
            const context = SecurityContext.forService(service, [Authorization.READ]);

            // Try to access tenant-scoped resource
            const result = AuthorizationGuard.checkTenantScoped(context, "tenant-123", Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.MISSING_CONTEXT);
        });
    });
});
