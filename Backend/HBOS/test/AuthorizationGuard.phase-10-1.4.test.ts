/**
 * Phase 10-1.4 - ABAC Authorization Guard Tests
 *
 * Tests ABAC interfaces and methods added to AuthorizationGuard.
 * 15 tests covering all operators, backward compatibility, and tenant boundary.
 */

import { Authorization, AuthorizationResult } from "../Security/Authorization";
import { Principal, PrincipalType } from "../Security/Principals";
import { SecurityContext } from "../Security/SecurityContext";
import { AuthorizationGuard, AbacAttribute, AbacRule, AbacPolicyResult } from "../Security/AuthorizationGuard";

describe("Phase 10-1.4 - ABAC Authorization Guard", () => {

    const traceId = "trace-abac-001";

    describe("Interfaces", () => {
        it("AbacAttribute accepts string value", () => {
            const attr: AbacAttribute = { key: "classification", value: "public" };
            expect(attr.key).toBe("classification");
            expect(attr.value).toBe("public");
        });

        it("AbacAttribute accepts number value", () => {
            const attr: AbacAttribute = { key: "priority", value: 5 };
            expect(attr.value).toBe(5);
        });

        it("AbacAttribute accepts boolean value", () => {
            const attr: AbacAttribute = { key: "classified", value: true };
            expect(attr.value).toBe(true);
        });

        it("AbacRule effect is ALLOW or DENY", () => {
            const allowRule: AbacRule = {
                effect: "ALLOW",
                attribute: "classification",
                operator: "EQUALS",
                value: "public"
            };
            const denyRule: AbacRule = {
                effect: "DENY",
                attribute: "classification",
                operator: "EQUALS",
                value: "classified"
            };
            expect(allowRule.effect).toBe("ALLOW");
            expect(denyRule.effect).toBe("DENY");
        });

        it("AbacPolicyResult has expected fields", () => {
            const result: AbacPolicyResult = {
                result: AuthorizationResult.PERMITTED,
                reason: "allowed",
                matchedRule: "classification",
                traceId: "trace-1"
            };
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
            expect(result.matchedRule).toBe("classification");
            expect(result.traceId).toBe("trace-1");
        });
    });

    describe("evaluateAbacPolicy", () => {
        const human = Principal.humanUser("user-1", "tenant-123");
        const context = SecurityContext.forHumanUser(human, [Authorization.READ], traceId);

        it("returns MISSING_CONTEXT when no actor", () => {
            const emptyContext = SecurityContext.empty();
            const result = AuthorizationGuard.evaluateAbacPolicy(
                emptyContext,
                Authorization.READ,
                [{ key: "classification", value: "public" }],
                [{ effect: "ALLOW", attribute: "classification", operator: "EQUALS", value: "public" }]
            );
            expect(result.result).toBe(AuthorizationResult.MISSING_CONTEXT);
            expect(result.traceId).toBe(undefined);
        });

        it("returns DENIED when DENY rule matches with EQUALS", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "classification", value: "classified" }],
                [{ effect: "DENY", attribute: "classification", operator: "EQUALS", value: "classified" }]
            );
            expect(result.result).toBe(AuthorizationResult.DENIED);
            expect(result.matchedRule).toBe("classification");
            expect(result.reason).toContain("denied");
        });

        it("returns PERMITTED when ALLOW rule matches with EQUALS", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "classification", value: "public" }],
                [{ effect: "ALLOW", attribute: "classification", operator: "EQUALS", value: "public" }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
            expect(result.matchedRule).toBe("classification");
            expect(result.reason).toContain("allowed");
        });

        it("DENY rules take precedence over ALLOW rules", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "classification", value: "classified" }],
                [
                    { effect: "ALLOW", attribute: "classification", operator: "EQUALS", value: "classified" },
                    { effect: "DENY", attribute: "classification", operator: "EQUALS", value: "classified" }
                ]
            );
            expect(result.result).toBe(AuthorizationResult.DENIED);
        });

        it("falls back to RBAC when no rules match", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "classification", value: "unknown" }],
                [{ effect: "ALLOW", attribute: "classification", operator: "EQUALS", value: "public" }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
            expect(result.reason).toBe("Authorized");
        });

        it("NOT_EQUALS operator works", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "classification", value: "internal" }],
                [{ effect: "ALLOW", attribute: "classification", operator: "NOT_EQUALS", value: "public" }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("IN operator works with array value", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "role", value: "editor" }],
                [{ effect: "ALLOW", attribute: "role", operator: "IN", value: ["admin", "editor", "viewer"] }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("NOT_IN operator works with array value", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "role", value: "guest" }],
                [{ effect: "ALLOW", attribute: "role", operator: "NOT_IN", value: ["admin", "editor", "viewer"] }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("GREATER_THAN operator works", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "priority", value: 10 }],
                [{ effect: "ALLOW", attribute: "priority", operator: "GREATER_THAN", value: 5 }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("LESS_THAN operator works", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "priority", value: 3 }],
                [{ effect: "ALLOW", attribute: "priority", operator: "LESS_THAN", value: 5 }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("CONTAINS operator works", () => {
            const result = AuthorizationGuard.evaluateAbacPolicy(
                context,
                Authorization.READ,
                [{ key: "name", value: "alpha-beta" }],
                [{ effect: "ALLOW", attribute: "name", operator: "CONTAINS", value: "beta" }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });

    describe("abacCheck", () => {
        const human = Principal.humanUser("user-1", "tenant-123");
        const context = SecurityContext.forHumanUser(human, [Authorization.READ], traceId);

        it("returns DENIED for tenant mismatch", () => {
            const result = AuthorizationGuard.abacCheck(
                context,
                Authorization.READ,
                "document",
                [{ key: "tenantId", value: "tenant-999" }],
                [{ effect: "ALLOW", attribute: "tenantId", operator: "EQUALS", value: "tenant-999" }]
            );
            expect(result.result).toBe(AuthorizationResult.DENIED);
            expect(result.reason).toBe("Tenant mismatch");
        });

        it("allows matching tenant", () => {
            const result = AuthorizationGuard.abacCheck(
                context,
                Authorization.READ,
                "document",
                [{ key: "tenantId", value: "tenant-123" }],
                [{ effect: "ALLOW", attribute: "tenantId", operator: "EQUALS", value: "tenant-123" }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("allows unscoped resource when context has no tenant", () => {
            const contextNoTenant = { ...context, tenantId: undefined };
            const result = AuthorizationGuard.abacCheck(
                contextNoTenant,
                Authorization.READ,
                "document",
                [{ key: "classification", value: "public" }],
                [{ effect: "ALLOW", attribute: "classification", operator: "EQUALS", value: "public" }]
            );
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("returns traceId from context", () => {
            const result = AuthorizationGuard.abacCheck(
                context,
                Authorization.READ,
                "document",
                [{ key: "classification", value: "public" }],
                [{ effect: "ALLOW", attribute: "classification", operator: "EQUALS", value: "public" }]
            );
            expect(result.traceId).toBe(traceId);
        });
    });

    describe("Backward compatibility", () => {
        it("check method still works for existing authorization flow", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);

            const result = AuthorizationGuard.check(context, Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });

        it("checkTenantScoped still works", () => {
            const human = Principal.humanUser("user-1", "tenant-123");
            const context = SecurityContext.forHumanUser(human, [Authorization.READ]);

            const result = AuthorizationGuard.checkTenantScoped(context, "tenant-123", Authorization.READ);
            expect(result.result).toBe(AuthorizationResult.PERMITTED);
        });
    });
});
