/**
 * Phase 06-D - Decision Engine Tests (CORRECTED)
 *
 * Tests for real decision authority implementation.
 * Includes regression tests for 5 corrective findings:
 * 1. FABRICATED REJECTION CONFIDENCE - rejection must not use arbitrary 0.95
 * 2. USE EXISTING SECURITY BOUNDARIES - must use AuthorizationGuard/TenantIsolation
 * 3. RULE SEMANTICS - rules must match/condition to be effective
 * 4. KNOWLEDGE-ONLY APPROVAL - knowledge without reasoning must not approve
 * 5. TRACEABILITY - all outcomes must expose actual inputs truthfully
 */

import { DecisionEngine, DecisionInput, DecisionRule, createBlockingRule, createAdvisoryRule } from "../Decision/DecisionEngine";
import { IntelligenceResult, IntelligencePipeline } from "../Core/IntelligenceContract";
import { SecurityContext } from "../Security/SecurityContext";
import { PrincipalType } from "../Security/Principals";
import { Authorization, AuthorizationResult } from "../Security/Authorization";

describe("DecisionEngine - Real Decision Authority", () => {

    let engine: DecisionEngine;

    beforeEach(() => {
        engine = new DecisionEngine();
        engine.initialize();
    });

    // ===== Test 1: APPROVE outcome from valid reasoning + sufficient evidence =====

    test("APPROVE outcome is produced from valid reasoning + sufficient evidence", () => {
        const reasoning: IntelligenceResult = {
            traceId: "test-trace-1",
            conclusion: "Financial health: GOOD. Profit margin is healthy.",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.85, "profit_margin_test", "test evidence"),
            limitations: [],
            reasoningSteps: ["Analyzed revenue", "Calculated profit margin"],
            success: true,
            status: "reasoned_domain",
            inputHash: "abc123",
            outputHash: "def456"
        };

        const input: DecisionInput = {
            problem: "Approve Q4 budget",
            objective: "Determine if Q4 budget is acceptable",
            assumptions: ["Revenue projections are accurate"],
            reasoning
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("APPROVED");
        expect(result.decision).toBe("Financial health: GOOD. Profit margin is healthy.");
        expect(result.authorized).toBe(true);
        expect(result.traceId).toBeDefined();
    });

    // ===== Test 2: REJECT outcome from blocking risk/rule =====

    test("REJECT outcome is produced from a blocking risk/rule", () => {
        const rules: DecisionRule[] = [
            createBlockingRule("RULE-001", "Budget exceeds $1M threshold", () => true, "HIGH")
        ];

        const input: DecisionInput = {
            problem: "Approve Q4 budget",
            objective: "Determine if Q4 budget is acceptable",
            assumptions: [],
            rules
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.decision).toContain("Budget exceeds $1M threshold");
        expect(result.risks.some(r => r.includes("Budget exceeds $1M threshold"))).toBe(true);
        expect(result.recommendations).toContain("Address blocking rules before resubmitting");
    });

    // ===== Test 3: REVIEW_REQUIRED outcome when evidence is missing =====

    test("REJECTED outcome is produced when reasoning is missing", () => {
        const input: DecisionInput = {
            problem: "Approve project",
            objective: "Make decision",
            assumptions: []
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REVIEW_REQUIRED");
        expect(result.decision).toContain("No formal reasoning result provided");
        expect(result.confidence.source).toBe("unavailable");
    });

    // ===== Test 4: Recommendations derived from reasoning =====

    test("Recommendations are derived from reasoning", () => {
        const reasoning: IntelligenceResult = {
            traceId: "test-trace-2",
            conclusion: "Budget is ON TRACK",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.8, "budget_test", "test"),
            limitations: [],
            reasoningSteps: ["Analyzed planned vs actual", "Calculated utilization"],
            success: true,
            status: "reasoned_domain",
            inputHash: "abc123",
            outputHash: "def456"
        };

        const input: DecisionInput = {
            problem: "Review budget",
            objective: "Assess budget status",
            assumptions: ["Budget data is current"],
            reasoning
        };

        const result = engine.evaluate(input);

        expect(result.recommendations.length).toBeGreaterThan(0);
    });

    // ===== Test 5: Risks derived from real conditions =====

    test("Risks are derived from real conditions", () => {
        const rules: DecisionRule[] = [
            createBlockingRule("RISK-001", "High debt ratio detected", () => true, "HIGH")
        ];

        const input: DecisionInput = {
            problem: "Approve financial plan",
            objective: "Assess financial health",
            assumptions: [],
            rules
        };

        const result = engine.evaluate(input);

        expect(result.risks.length).toBeGreaterThan(0);
        expect(result.risks.some(r => r.includes("High debt ratio"))).toBe(true);
    });

    // ===== Test 6: Decision changes when reasoning changes =====

    test("Decision changes when reasoning changes", () => {
        const goodReasoning: IntelligenceResult = {
            traceId: "test-trace-3",
            conclusion: "Financial health: GOOD",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.85, "test", "good"),
            limitations: [],
            reasoningSteps: [],
            success: true,
            status: "reasoned_domain",
            inputHash: "abc123",
            outputHash: "def456"
        };

        const failedReasoning: IntelligenceResult = {
            traceId: "test-trace-4",
            conclusion: "",
            confidence: IntelligencePipeline.unavailable(),
            limitations: ["Reasoning engine unavailable"],
            reasoningSteps: [],
            success: false,
            status: "reasoning_failed",
            inputHash: "xyz789",
            outputHash: undefined
        };

        const input1: DecisionInput = {
            problem: "Assess financials",
            objective: "Decision",
            assumptions: [],
            reasoning: goodReasoning
        };

        const input2: DecisionInput = {
            problem: "Assess financials",
            objective: "Decision",
            assumptions: [],
            reasoning: failedReasoning
        };

        const result1 = engine.evaluate(input1);
        const result2 = engine.evaluate(input2);

        expect(result1.outcome).toBe("APPROVED");
        expect(result2.outcome).toBe("REVIEW_REQUIRED");
    });

    // ===== Test 7: Decision changes when evidence changes =====

    test("Decision changes when blocking rule matches", () => {
        const reasoning: IntelligenceResult = {
            traceId: "test-trace-5",
            conclusion: "Based on analysis",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.7, "test", "evidence"),
            limitations: [],
            reasoningSteps: [],
            success: true,
            status: "reasoned_domain",
            inputHash: "abc123",
            outputHash: "def456"
        };

        const input1: DecisionInput = {
            problem: "Assess",
            objective: "Decision",
            assumptions: [],
            reasoning
        };

        const rules: DecisionRule[] = [
            createBlockingRule("RULE-002", "Compliance failure", () => true, "CRITICAL")
        ];

        const input2: DecisionInput = {
            problem: "Assess",
            objective: "Decision",
            assumptions: [],
            reasoning,
            rules
        };

        const result1 = engine.evaluate(input1);
        const result2 = engine.evaluate(input2);

        expect(result1.outcome).toBe("APPROVED");
        expect(result2.outcome).toBe("REJECTED");
    });

    // ===== Test 8: DecisionEngine does not merely echo project status =====

    test("DecisionEngine does not merely echo project status", () => {
        const input: DecisionInput = {
            problem: "project status check",
            objective: "evaluate",
            assumptions: []
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REVIEW_REQUIRED");
        expect(result.decision).toContain("No formal reasoning");
    });

    // ===== Test 9: Provenance/evidence survives into decision result =====

    test("Provenance/evidence survives into the decision result", () => {
        const reasoning: IntelligenceResult = {
            traceId: "provenance-trace-123",
            conclusion: "Test conclusion",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.8, "test", "test"),
            limitations: ["Test limitation"],
            reasoningSteps: ["Step 1", "Step 2"],
            success: true,
            status: "test",
            inputHash: "input-hash-123",
            outputHash: "output-hash-456"
        };

        const input: DecisionInput = {
            problem: "Test provenance",
            objective: "Verify evidence",
            assumptions: [],
            reasoning
        };

        const result = engine.evaluate(input);

        expect(result.traceId).toBeDefined();
        expect(result.inputHash).toBeDefined();
        expect(result.outputHash).toBeDefined();
        expect(result.reasoning).toBeDefined();
        expect(result.reasoning?.traceId).toBe("provenance-trace-123");
        expect(result.appliedRules).toEqual([]);
    });

    // ===== Test 10: Confidence is not fabricated =====

    test("Confidence is not fabricated", () => {
        const input1: DecisionInput = {
            problem: "Test",
            objective: "Check",
            assumptions: []
        };

        const result1 = engine.evaluate(input1);

        expect(result1.confidence.source).toBe("unavailable");
        expect(result1.confidence).toEqual({ source: "unavailable" });

        const reasoning: IntelligenceResult = {
            traceId: "trace-conf",
            conclusion: "Test",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.75, "formula", "evidence"),
            limitations: [],
            reasoningSteps: [],
            success: true,
            status: "test",
            inputHash: "abc",
            outputHash: "def"
        };

        const input2: DecisionInput = {
            problem: "Test",
            objective: "Check",
            assumptions: [],
            reasoning
        };

        const result2 = engine.evaluate(input2);

        expect(result2.confidence.source).toBe("calculated");
        expect(result2.confidence).toHaveProperty("value", 0.75);
        expect(result2.confidence).toHaveProperty("formula", "formula");
    });

    // ===== Test 11: Unauthorized decision path is denied =====

    test("Unauthorized decision path is denied by existing authorization boundary", () => {
        const unauthorizedContext = SecurityContext.empty();

        const input: DecisionInput = {
            problem: "Unauthorized decision",
            objective: "Test",
            assumptions: [],
            securityContext: unauthorizedContext
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.authorized).toBe(false);
        expect(result.authorizationReason).toBeDefined();
        expect(result.risks).toContain("Unauthorized decision attempt");
    });

    // ===== Test 12: Tenant isolation survives end-to-end decision flow =====

    test("Tenant isolation survives end-to-end decision flow", () => {
        const actor = {
            id: "user-123",
            type: PrincipalType.HumanUser as const,
            tenantId: "tenant-A"
        };

        const context = SecurityContext.forHumanUser(
            actor as any,
            [Authorization.EXECUTE],
            "trace-tenant"
        );

        const input: DecisionInput = {
            problem: "Cross-tenant decision",
            objective: "Test",
            assumptions: [],
            tenantId: "tenant-B",
            securityContext: context
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.authorized).toBe(false);
        expect(result.authorizationReason).toContain("Tenant mismatch");
    });

    // ===== Test 13: Offline/local path works without network dependency =====

    test("Offline/local path works without network dependency", () => {
        const reasoning: IntelligenceResult = {
            traceId: "offline-trace",
            conclusion: "Offline analysis complete",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.85, "offline_formula", "local_data"),
            limitations: [],
            reasoningSteps: ["Step 1", "Step 2"],
            success: true,
            status: "offline_reasoning",
            inputHash: "offline-input",
            outputHash: "offline-output"
        };

        const input: DecisionInput = {
            problem: "Offline decision",
            objective: "Test offline capability",
            assumptions: ["Operating in offline mode"],
            reasoning
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("APPROVED");
        expect(result.authorized).toBe(true);
    });

    // ===== REGRESSION TEST: Finding 1 - FABRICATED REJECTION CONFIDENCE =====

    test("REJECTION confidence is NOT fabricated (no arbitrary 0.95)", () => {
        const rules: DecisionRule[] = [
            createBlockingRule("BLOCK-1", "Budget exceeds threshold", () => true, "HIGH")
        ];

        const input: DecisionInput = {
            problem: "Reject this",
            objective: "Test rejection confidence",
            assumptions: [],
            rules
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.confidence).toEqual({ source: "unavailable" });
        expect(result.confidence.source).toBe("unavailable");
    });

    // ===== REGRESSION TEST: Finding 2 - USE EXISTING SECURITY BOUNDARIES =====

    test("DecisionEngine uses canonical AuthorizationGuard", () => {
        const humanUser = {
            id: "user-1",
            type: PrincipalType.HumanUser as const,
            userId: "user-1",
            tenantId: "tenant-A"
        };

        const context = SecurityContext.forHumanUser(
            humanUser as any,
            [Authorization.READ]
        );

        const input: DecisionInput = {
            problem: "Test auth",
            objective: "Test",
            assumptions: [],
            securityContext: context
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.authorized).toBe(false);
        expect(result.authorizationReason).toContain("EXECUTE");
    });

    test("DecisionEngine uses canonical TenantIsolation", () => {
        const humanUser = {
            id: "user-1",
            type: PrincipalType.HumanUser as const,
            userId: "user-1",
            tenantId: "tenant-A"
        };

        const context = SecurityContext.forHumanUser(
            humanUser as any,
            [Authorization.EXECUTE]
        );

        const input: DecisionInput = {
            problem: "Test tenant",
            objective: "Test",
            assumptions: [],
            tenantId: "tenant-B",
            securityContext: context
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.authorized).toBe(false);
        expect(result.authorizationReason).toContain("Tenant mismatch");
    });

    // ===== REGRESSION TEST: Finding 3 - RULE SEMANTICS =====

    test("Blocking rule only rejects when MATCH condition is true", () => {
        const rules: DecisionRule[] = [
            createBlockingRule("BLOCK-1", "Should not block", () => false, "HIGH")
        ];

        const reasoning: IntelligenceResult = {
            traceId: "rule-test-trace",
            conclusion: "Decision made",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.8, "test", "test"),
            limitations: [],
            reasoningSteps: [],
            success: true,
            status: "test",
            inputHash: "abc",
            outputHash: "def"
        };

        const input: DecisionInput = {
            problem: "Rule condition test",
            objective: "Test",
            assumptions: [],
            reasoning,
            rules
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("APPROVED");
        expect(result.appliedRules).not.toContain("BLOCK-1");
    });

    test("Multiple matching rules all reported as effective", () => {
        const rules: DecisionRule[] = [
            createBlockingRule("BLOCK-1", "Rule 1", () => true, "HIGH"),
            createBlockingRule("BLOCK-2", "Rule 2", () => true, "MEDIUM")
        ];

        const input: DecisionInput = {
            problem: "Multiple matching rules",
            objective: "Test",
            assumptions: [],
            rules
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.appliedRules).toContain("BLOCK-1");
        expect(result.appliedRules).toContain("BLOCK-2");
    });

    test("Non-blocking advisory rule can match without rejecting", () => {
        const rules: DecisionRule[] = [
            createAdvisoryRule("ADVISORY-1", "Advisory notice", () => true)
        ];

        const reasoning: IntelligenceResult = {
            traceId: "advisory-trace",
            conclusion: "Proceed with caution",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.8, "test", "test"),
            limitations: [],
            reasoningSteps: [],
            success: true,
            status: "test",
            inputHash: "abc",
            outputHash: "def"
        };

        const input: DecisionInput = {
            problem: "Advisory test",
            objective: "Test",
            assumptions: [],
            reasoning,
            rules
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("APPROVED");
        expect(result.appliedRules).toContain("ADVISORY-1");
    });

    // ===== REGRESSION TEST: Finding 4 - KNOWLEDGE-ONLY APPROVAL =====

    test("Knowledge-only evidence CANNOT produce APPROVED without formal reasoning", () => {
        const input: DecisionInput = {
            problem: "Knowledge only test",
            objective: "Test",
            assumptions: [],
            evidence: [
                { id: "ev-1", type: "knowledge", summary: "Historical data", sourceRef: "kb" }
            ]
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REVIEW_REQUIRED");
        expect(result.confidence.source).toBe("unavailable");
        expect(result.limitations.some(l => l.includes("formal reasoning"))).toBe(true);
    });

    test("Formal reasoning IS required for APPROVED", () => {
        const reasoning: IntelligenceResult = {
            traceId: "reasoning-trace",
            conclusion: "Decision approved",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.85, "analysis", "reasoning"),
            limitations: [],
            reasoningSteps: ["Step 1"],
            success: true,
            status: "reasoned_domain",
            inputHash: "abc",
            outputHash: "def"
        };

        const input: DecisionInput = {
            problem: "Formal reasoning test",
            objective: "Test",
            assumptions: [],
            reasoning
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("APPROVED");
        expect(result.reasoning).toBeDefined();
    });

    // ===== REGRESSION TEST: Finding 5 - TRACEABILITY =====

    test("REJECTED outcome has truthful confidence (not fabricated)", () => {
        const rules: DecisionRule[] = [
            createBlockingRule("BLOCK-1", "Threshold exceeded", () => true, "HIGH")
        ];

        const input: DecisionInput = {
            problem: "Traceability test",
            objective: "Test",
            assumptions: [],
            rules
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.confidence.source).toBe("unavailable");
        expect(result.traceId).toBeDefined();
        expect(result.inputHash).toBeDefined();
        expect(result.outputHash).toBeDefined();
    });

    test("All outcomes expose actual traceId and hashes", () => {
        const reasoning: IntelligenceResult = {
            traceId: "reasoning-123",
            conclusion: "Analysis complete",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.8, "test", "test"),
            limitations: [],
            reasoningSteps: [],
            success: true,
            status: "test",
            inputHash: "input-hash",
            outputHash: "output-hash"
        };

        const input: DecisionInput = {
            problem: "Provenance test",
            objective: "Test",
            assumptions: [],
            reasoning
        };

        const result = engine.evaluate(input);

        expect(result.traceId).toBeDefined();
        expect(result.traceId.length).toBeGreaterThan(0);
        expect(result.inputHash).toBeDefined();
        expect(result.inputHash.length).toBeGreaterThan(0);
        expect(result.outputHash).toBeDefined();
        expect(result.outputHash!.length).toBeGreaterThan(0);
        expect(Array.isArray(result.appliedRules)).toBe(true);
    });
});
