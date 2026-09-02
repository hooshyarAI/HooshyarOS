/**
 * Phase 06-F - Governance Enforcement Tests
 *
 * Tests for real governance policy enforcement in GovernanceEngine.
 *
 * Coverage:
 * 1. allowed action
 * 2. blocking policy denial
 * 3. review-required case
 * 4. human-approval requirement
 * 5. autonomous authority restriction
 * 6. conditional policy matching
 * 7. multiple policy application
 * 8. non-blocking policy
 * 9. authorization boundary
 * 10. tenant boundary
 * 11. audit/security evidence
 * 12. truthful confidence
 * 13. offline operation
 * 14. governance decision changes when input/policy changes
 * 15. GovernanceEngine is not merely initialize/health
 * 16. Phase 05/06-D/06-E regression
 */

import { GovernanceEngine, GovernanceRequest, GovernancePolicy, PolicyMatchResult, createAutonomousOperationPolicy, createSensitiveDataPolicy, createCrossTenantPolicy, createProductionDeploymentPolicy } from "../Engines/GovernanceEngine";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal, PrincipalType, HumanUser, AutonomousOperation } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";
import { TenantResource } from "../Security/TenantIsolation";

describe("GovernanceEngine - Real Governance Enforcement", () => {

    let engine: GovernanceEngine;

    // Helper to create human user context
    const humanUserContext = (userId: string, tenantId: string, permissions: Authorization[] = [Authorization.READ]) => {
        return SecurityContext.forHumanUser(Principal.humanUser(userId, tenantId), permissions);
    };

    // Helper to create autonomous operation context
    const autonomousContext = (opId: string, tenantId?: string) => {
        return SecurityContext.forAutonomousOperation(Principal.autonomousOperation(opId, "KiloCode", tenantId));
    };

    beforeEach(() => {
        engine = new GovernanceEngine();
        engine.initialize();
        engine.clearPolicies();
    });

    // ===== Test 1: GovernanceEngine is not merely initialize/health =====

    test("GovernanceEngine performs real evaluation, not just status", () => {
        // Should have real methods beyond initialize/health
        expect(typeof engine.evaluate).toBe("function");
        expect(typeof engine.addPolicy).toBe("function");
        expect(typeof engine.getPolicies).toBe("function");

        // Should be able to evaluate
        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.empty()
        };

        const result = engine.evaluate(request);
        expect(result).toBeDefined();
        expect(result.status).toBeDefined();
    });

    // ===== Test 2: Allowed action =====

    test("Governance ALLOWS action with no matching policies", () => {
        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("ALLOWED");
        expect(result.appliedPolicies).toEqual([]);
    });

    test("Governance ALLOWS action with matching allow policy", () => {
        // Add a policy that allows
        const allowPolicy: GovernancePolicy = {
            id: "ALLOW-POLICY",
            description: "Test allow policy",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "ALLOW", reason: "Test allow" })
        };
        engine.addPolicy(allowPolicy);

        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("ALLOWED");
        expect(result.appliedPolicies).toContain("ALLOW-POLICY");
    });

    // ===== Test 3: Blocking policy denial =====

    test("Governance DENIES action with blocking policy", () => {
        const denyPolicy: GovernancePolicy = {
            id: "DENY-POLICY",
            description: "Test deny policy",
            severity: "HIGH",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "DENY", reason: "Test deny reason" })
        };
        engine.addPolicy(denyPolicy);

        const request: GovernanceRequest = {
            action: "DELETE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("DENIED");
        expect(result.appliedPolicies).toContain("DENY-POLICY");
        expect(result.reasons).toContainEqual(expect.stringContaining("Test deny reason"));
    });

    test("DENY policy blocks even with other ALLOW policies", () => {
        const allowPolicy: GovernancePolicy = {
            id: "ALLOW-POLICY",
            description: "Allow policy",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "ALLOW", reason: "Allow" })
        };
        const denyPolicy: GovernancePolicy = {
            id: "DENY-POLICY",
            description: "Deny policy",
            severity: "HIGH",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "DENY", reason: "Deny wins" })
        };
        engine.addPolicy(allowPolicy);
        engine.addPolicy(denyPolicy);

        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("DENIED");
        expect(result.appliedPolicies).toContain("DENY-POLICY");
    });

    // ===== Test 4: Review-required case =====

    test("Governance returns REVIEW_REQUIRED when policy requires review", () => {
        const reviewPolicy: GovernancePolicy = {
            id: "REVIEW-POLICY",
            description: "Require review",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "REVIEW_REQUIRED", reason: "Review required", requiresHumanApproval: true })
        };
        engine.addPolicy(reviewPolicy);

        const request: GovernanceRequest = {
            action: "APPROVE_SPENDING",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.APPROVE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("REVIEW_REQUIRED");
        expect(result.requiresHumanApproval).toBe(true);
    });

    // ===== Test 5: Human approval requirement =====

    test("Human approval is explicit in REVIEW_REQUIRED result", () => {
        const humanApprovalPolicy: GovernancePolicy = {
            id: "HUMAN-APPROVAL-POLICY",
            description: "Require human approval",
            match: () => ({ matched: true }),
            evaluate: () => ({
                effect: "REVIEW_REQUIRED",
                reason: "Human must approve",
                requiresHumanApproval: true
            })
        };
        engine.addPolicy(humanApprovalPolicy);

        const request: GovernanceRequest = {
            action: "OVERRIDE_DECISION",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.APPROVE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("REVIEW_REQUIRED");
        expect(result.requiresHumanApproval).toBe(true);
        expect(result.limitations).toContainEqual(expect.stringContaining("Human approval"));
    });

    // ===== Test 6: Conditional policy matching =====

    test("Policy with non-matching condition does not affect decision", () => {
        const conditionalPolicy: GovernancePolicy = {
            id: "CONDITIONAL-POLICY",
            description: "Only for sensitive data",
            match: (request: GovernanceRequest): PolicyMatchResult | null => {
                if (request.action !== "ACCESS_SENSITIVE_DATA") {
                    return null; // Does not apply
                }
                const sensitivity = request.parameters?.dataSensitivity as string | undefined;
                if (sensitivity !== "HIGH") {
                    return null; // Does not apply
                }
                return { matched: true };
            },
            evaluate: () => ({ effect: "DENY", reason: "Sensitive data denied" })
        };
        engine.addPolicy(conditionalPolicy);

        // Non-sensitive data request
        const request: GovernanceRequest = {
            action: "ACCESS_SENSITIVE_DATA",
            parameters: { dataSensitivity: "LOW" },
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.ACCESS_EVIDENCE]
            )
        };

        const result = engine.evaluate(request);

        // Policy did not match, so action should be allowed
        expect(result.status).toBe("ALLOWED");
        expect(result.appliedPolicies).not.toContain("CONDITIONAL-POLICY");
    });

    test("Policy with matching condition affects decision", () => {
        const conditionalPolicy: GovernancePolicy = {
            id: "CONDITIONAL-POLICY",
            description: "Only for sensitive data",
            match: (request: GovernanceRequest): PolicyMatchResult | null => {
                if (request.action !== "ACCESS_SENSITIVE_DATA") {
                    return null;
                }
                const sensitivity = request.parameters?.dataSensitivity as string | undefined;
                if (sensitivity !== "HIGH") {
                    return null;
                }
                return { matched: true };
            },
            evaluate: () => ({ effect: "DENY", reason: "Sensitive data denied" })
        };
        engine.addPolicy(conditionalPolicy);

        // Sensitive data request
        const request: GovernanceRequest = {
            action: "ACCESS_SENSITIVE_DATA",
            parameters: { dataSensitivity: "HIGH" },
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.ACCESS_EVIDENCE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("DENIED");
        expect(result.appliedPolicies).toContain("CONDITIONAL-POLICY");
    });

    // ===== Test 7: Multiple policy application =====

    test("Multiple policies can all match and be recorded", () => {
        const policy1: GovernancePolicy = {
            id: "POLICY-1",
            description: "Policy 1",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "ALLOW", reason: "Policy 1 allows" })
        };
        const policy2: GovernancePolicy = {
            id: "POLICY-2",
            description: "Policy 2",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "ALLOW", reason: "Policy 2 allows" })
        };
        engine.addPolicy(policy1);
        engine.addPolicy(policy2);

        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.appliedPolicies).toContain("POLICY-1");
        expect(result.appliedPolicies).toContain("POLICY-2");
        expect(result.appliedPolicies).toHaveLength(2);
    });

    // ===== Test 8: Non-blocking policy =====

    test("ALLOW policy does not cause false denial", () => {
        const allowPolicy: GovernancePolicy = {
            id: "ALLOW-POLICY",
            description: "Allow policy",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "ALLOW", reason: "Allow" })
        };
        engine.addPolicy(allowPolicy);

        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("ALLOWED");
    });

    // ===== Test 9: Authorization boundary =====

    test("Governance denies when AuthorizationGuard denies", () => {
        // Request without proper authorization
        const request: GovernanceRequest = {
            action: "EXECUTE_AUTONOMOUS_OPERATION",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.READ] // Missing EXECUTE
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("DENIED");
        expect(result.reasons).toContainEqual(expect.stringContaining("Permission"));
    });

    test("Governance uses AuthorizationGuard, not custom authorization", () => {
        // Autonomous operation with EXECUTE should pass authorization
        const request: GovernanceRequest = {
            action: "EXECUTE_AUTONOMOUS_OPERATION",
            securityContext: SecurityContext.forAutonomousOperation(
                Principal.autonomousOperation("auto-1", "KiloCode", "tenant-1")
            )
        };

        const result = engine.evaluate(request);

        // Should NOT be denied by authorization (passes AuthorizationGuard.checkAutonomousExecute)
        expect(result.status).not.toBe("DENIED");
    });

    // ===== Test 10: Tenant boundary =====

    test("Governance denies cross-tenant access via TenantIsolation", () => {
        const target: TenantResource = { tenantId: "tenant-2" };

        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            target,
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.status).toBe("DENIED");
        expect(result.reasons).toContainEqual(expect.stringContaining("Tenant"));
    });

    test("Governance allows same-tenant access", () => {
        const target: TenantResource = { tenantId: "tenant-1" };

        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            target,
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        // Should pass tenant check
        expect(result.status).toBe("ALLOWED");
    });

    // ===== Test 11: Truthful confidence =====

    test("Governance confidence is always unavailable", () => {
        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.confidence).toEqual({ source: "unavailable" });
        expect(result.confidence.source).toBe("unavailable");
    });

    test("Governance does not fabricate confidence from policy severity", () => {
        const severityPolicy: GovernancePolicy = {
            id: "SEVERITY-POLICY",
            description: "High severity",
            severity: "CRITICAL",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "DENY", reason: "Critical severity" })
        };
        engine.addPolicy(severityPolicy);

        const request: GovernanceRequest = {
            action: "DELETE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        // Confidence must be unavailable, not derived from severity
        expect(result.confidence).toEqual({ source: "unavailable" });
    });

    // ===== Test 12: Provenance/trace =====

    test("Governance result includes trace information", () => {
        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            traceId: "test-trace-123",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.traceId).toBe("test-trace-123");
        expect(result.inputHash).toBeDefined();
        expect(result.outputHash).toBeDefined();
    });

    test("Governance generates traceId when not provided", () => {
        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result.traceId).toBeDefined();
        expect(result.traceId.length).toBeGreaterThan(0);
    });

    // ===== Test 13: Offline operation =====

    test("Governance works without security logger (offline capable)", () => {
        // No security logger set - should still work
        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);

        expect(result).toBeDefined();
        expect(result.status).toBe("ALLOWED");
    });

    // ===== Test 14: Governance decision changes when input/policy changes =====

    test("Different policies produce different outcomes", () => {
        const allowPolicy: GovernancePolicy = {
            id: "ALLOW-POLICY",
            description: "Allow",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "ALLOW", reason: "Allow" })
        };
        const denyPolicy: GovernancePolicy = {
            id: "DENY-POLICY",
            description: "Deny",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "DENY", reason: "Deny" })
        };

        const request: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        // With allow policy
        engine.clearPolicies();
        engine.addPolicy(allowPolicy);
        const allowResult = engine.evaluate(request);
        expect(allowResult.status).toBe("ALLOWED");

        // With deny policy
        engine.clearPolicies();
        engine.addPolicy(denyPolicy);
        const denyResult = engine.evaluate(request);
        expect(denyResult.status).toBe("DENIED");
    });

    test("Same policy, different actions produce different outcomes", () => {
        const conditionalPolicy: GovernancePolicy = {
            id: "CONDITIONAL-POLICY",
            description: "Only for sensitive data",
            match: (request: GovernanceRequest): PolicyMatchResult | null => {
                if (request.action === "ACCESS_SENSITIVE_DATA") {
                    return { matched: true };
                }
                return null;
            },
            evaluate: () => ({ effect: "DENY", reason: "Sensitive data denied" })
        };
        engine.addPolicy(conditionalPolicy);

        // Non-sensitive action
        const normalRequest: GovernanceRequest = {
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };
        const normalResult = engine.evaluate(normalRequest);
        expect(normalResult.status).toBe("ALLOWED");

        // Sensitive action
        const sensitiveRequest: GovernanceRequest = {
            action: "ACCESS_SENSITIVE_DATA",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.ACCESS_EVIDENCE]
            )
        };
        const sensitiveResult = engine.evaluate(sensitiveRequest);
        expect(sensitiveResult.status).toBe("DENIED");
    });

    // ===== Test 15: Pre-built policy helpers =====

    test("createAutonomousOperationPolicy denies without EXECUTE", () => {
        const policy = createAutonomousOperationPolicy();
        engine.addPolicy(policy);

        const request: GovernanceRequest = {
            action: "EXECUTE_AUTONOMOUS_OPERATION",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.READ] // Missing EXECUTE
            )
        };

        const result = engine.evaluate(request);
        expect(result.status).toBe("DENIED");
    });

    test("createCrossTenantPolicy always denies", () => {
        const policy = createCrossTenantPolicy();
        engine.addPolicy(policy);

        const request: GovernanceRequest = {
            action: "CROSS_TENANT_OPERATION",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.WRITE]
            )
        };

        const result = engine.evaluate(request);
        expect(result.status).toBe("DENIED");
        expect(result.reasons).toContainEqual(expect.stringContaining("prohibited"));
    });

    test("createProductionDeploymentPolicy requires change ticket", () => {
        const policy = createProductionDeploymentPolicy();
        engine.addPolicy(policy);

        const request: GovernanceRequest = {
            action: "DEPLOY_TO_PRODUCTION",
            parameters: { changeTicket: undefined, hasApproval: false },
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.APPROVE]
            )
        };

        const result = engine.evaluate(request);
        expect(result.status).toBe("DENIED");
        expect(result.reasons).toContainEqual(expect.stringContaining("change ticket"));
    });

    test("createProductionDeploymentPolicy allows with proper evidence", () => {
        const policy = createProductionDeploymentPolicy();
        engine.addPolicy(policy);

        const request: GovernanceRequest = {
            action: "DEPLOY_TO_PRODUCTION",
            parameters: { changeTicket: "TICKET-123", hasApproval: true },
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.APPROVE]
            )
        };

        const result = engine.evaluate(request);
        expect(result.status).toBe("ALLOWED");
    });

    test("createSensitiveDataPolicy requires human approval for HIGH sensitivity", () => {
        const policy = createSensitiveDataPolicy();
        engine.addPolicy(policy);

        const request: GovernanceRequest = {
            action: "ACCESS_SENSITIVE_DATA",
            parameters: { dataSensitivity: "HIGH" },
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("user-1", "tenant-1"),
                [Authorization.ACCESS_EVIDENCE]
            )
        };

        const result = engine.evaluate(request);
        expect(result.status).toBe("REVIEW_REQUIRED");
        expect(result.requiresHumanApproval).toBe(true);
    });

    // ===== Test 16: Regression - other phases remain green =====

    test("REGRESSION: Phase 05/06 security infrastructure still works", () => {
        // Verify SecurityContext works
        const ctx = SecurityContext.forHumanUser(
            Principal.humanUser("user-1", "tenant-1"),
            [Authorization.READ, Authorization.WRITE]
        );
        expect(ctx.actor?.id).toBe("user-1");

        // Verify GovernanceEngine has required methods
        expect(typeof engine.initialize).toBe("function");
        expect(typeof engine.health).toBe("function");
        expect(typeof engine.evaluate).toBe("function");
    });
});
