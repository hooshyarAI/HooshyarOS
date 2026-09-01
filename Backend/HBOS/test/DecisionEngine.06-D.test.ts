/**
 * Phase 06-D - Decision Engine Tests
 *
 * Tests for real decision authority implementation.
 * Covers:
 * 1. APPROVE outcome from valid reasoning + sufficient evidence
 * 2. REJECT outcome from blocking risk/rule
 * 3. REVIEW_REQUIRED outcome from missing/insufficient/conflicting evidence
 * 4. Recommendations derived from reasoning/context
 * 5. Risks derived from real conditions
 * 6. Decision changes when reasoning changes
 * 7. Decision changes when evidence changes
 * 8. DecisionEngine does not merely echo project status
 * 9. Provenance/evidence survives into decision result
 * 10. Confidence is not fabricated
 * 11. Unauthorized decision path denied
 * 12. Tenant isolation end-to-end
 * 13. Offline/local path works without network
 */

import { DecisionEngine, DecisionInput, DecisionRule } from "../Decision/DecisionEngine";
import { IntelligenceResult, IntelligencePipeline } from "../Core/IntelligenceContract";
import { SecurityContext } from "../Security/SecurityContext";
import { PrincipalType } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";

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
        const blockingRule: DecisionRule = {
            id: "RULE-001",
            description: "Budget exceeds $1M threshold",
            blocking: true,
            severity: "HIGH"
        };

        const input: DecisionInput = {
            problem: "Approve Q4 budget",
            objective: "Determine if Q4 budget is acceptable",
            assumptions: [],
            rules: [blockingRule]
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.decision).toContain("Budget exceeds $1M threshold");
        expect(result.risks).toContain("Blocking rule: Budget exceeds $1M threshold");
        expect(result.recommendations).toContain("Address blocking rules before resubmitting");
    });

    // ===== Test 3: REVIEW_REQUIRED outcome when evidence is missing =====

    test("REVIEW_REQUIRED outcome is produced when evidence is missing", () => {
        const input: DecisionInput = {
            problem: "Approve project",
            objective: "Make decision",
            assumptions: []
            // No reasoning, no context
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REVIEW_REQUIRED");
        expect(result.decision).toContain("No reasoning result and no context provided");
        expect(result.confidence.source).toBe("unavailable");
    });

    // ===== Test 4: Recommendations derived from reasoning/context =====

    test("Recommendations are derived from reasoning/context", () => {
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
        // Recommendations should include reasoning steps
        expect(result.recommendations.some(r => r.includes("Analyzed") || r.includes("Calculated"))).toBe(true);
    });

    // ===== Test 5: Risks derived from real conditions =====

    test("Risks are derived from real conditions", () => {
        const blockingRule: DecisionRule = {
            id: "RISK-001",
            description: "High debt ratio detected",
            blocking: true,
            severity: "HIGH"
        };

        const input: DecisionInput = {
            problem: "Approve financial plan",
            objective: "Assess financial health",
            assumptions: [],
            rules: [blockingRule]
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

        const badReasoning: IntelligenceResult = {
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
            reasoning: badReasoning
        };

        const result1 = engine.evaluate(input1);
        const result2 = engine.evaluate(input2);

        expect(result1.outcome).toBe("APPROVED");
        expect(result2.outcome).toBe("REVIEW_REQUIRED"); // Failed reasoning leads to review
    });

    // ===== Test 7: Decision changes when evidence changes =====

    test("Decision changes when evidence changes", () => {
        const reasoning: IntelligenceResult = {
            traceId: "test-trace-5",
            conclusion: "Based on knowledge",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.7, "test", "evidence"),
            limitations: [],
            reasoningSteps: [],
            success: true,
            status: "reasoned_knowledge",
            inputHash: "abc123",
            outputHash: "def456"
        };

        // With no context - will need review
        const input1: DecisionInput = {
            problem: "Assess",
            objective: "Decision",
            assumptions: [],
            reasoning
        };

        // With blocking rule
        const blockingRule: DecisionRule = {
            id: "RULE-002",
            description: "Compliance failure",
            blocking: true,
            severity: "CRITICAL"
        };

        const input2: DecisionInput = {
            problem: "Assess",
            objective: "Decision",
            assumptions: [],
            reasoning,
            rules: [blockingRule]
        };

        const result1 = engine.evaluate(input1);
        const result2 = engine.evaluate(input2);

        expect(result1.outcome).toBe("APPROVED");
        expect(result2.outcome).toBe("REJECTED");
    });

    // ===== Test 8: DecisionEngine does not merely echo project status =====

    test("DecisionEngine does not merely echo project status", () => {
        // Input that would have echoed in the old implementation
        const input: DecisionInput = {
            problem: "project status check",
            objective: "evaluate",
            assumptions: []
        };

        const result = engine.evaluate(input);

        // The old implementation would return approved: true with no reasoning
        // The new implementation returns REVIEW_REQUIRED with clear reason
        expect(result.outcome).toBe("REVIEW_REQUIRED");
        expect(result.decision).not.toBe("Maintain current project direction");
        expect(result.limitations.length).toBeGreaterThan(0);
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
        // When reasoning is unavailable
        const input1: DecisionInput = {
            problem: "Test",
            objective: "Check",
            assumptions: []
        };

        const result1 = engine.evaluate(input1);

        expect(result1.confidence.source).toBe("unavailable");
        expect(result1.confidence).toEqual({ source: "unavailable" });

        // When reasoning provides confidence
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
        // Empty security context (no actor)
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
        // Create security context with different tenant
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
            tenantId: "tenant-B", // Different tenant
            securityContext: context
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.authorized).toBe(false);
        expect(result.authorizationReason).toContain("Tenant mismatch");
    });

    // ===== Test 13: Offline/local path works without network dependency =====

    test("Offline/local path works without network dependency", () => {
        // Reasoning with calculated confidence (no network)
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
            // No securityContext, no tenantId - pure local decision
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("APPROVED");
        expect(result.authorized).toBe(true);
        // No network dependency - everything computed locally
    });

    // ===== Additional: Multiple blocking rules =====
    test("Multiple blocking rules are all reported", () => {
        const rules: DecisionRule[] = [
            { id: "R1", description: "Rule 1 violation", blocking: true, severity: "HIGH" },
            { id: "R2", description: "Rule 2 violation", blocking: true, severity: "MEDIUM" }
        ];

        const input: DecisionInput = {
            problem: "Multi-rule decision",
            objective: "Test",
            assumptions: [],
            rules
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("REJECTED");
        expect(result.risks.length).toBeGreaterThanOrEqual(2);
    });

    // ===== Additional: Non-blocking rules do not reject =====
    test("Non-blocking rules do not cause rejection", () => {
        const rules: DecisionRule[] = [
            { id: "R1", description: "Advisory rule", blocking: false, severity: "LOW" }
        ];

        const reasoning: IntelligenceResult = {
            traceId: "advisory-trace",
            conclusion: "Good decision",
            confidence: IntelligencePipeline.fromCalculatedConfidence(0.8, "test", "test"),
            limitations: [],
            reasoningSteps: [],
            success: true,
            status: "test",
            inputHash: "abc",
            outputHash: "def"
        };

        const input: DecisionInput = {
            problem: "Advisory rule test",
            objective: "Test",
            assumptions: [],
            reasoning,
            rules
        };

        const result = engine.evaluate(input);

        expect(result.outcome).toBe("APPROVED");
        expect(result.appliedRules).toContain("R1");
    });
});
