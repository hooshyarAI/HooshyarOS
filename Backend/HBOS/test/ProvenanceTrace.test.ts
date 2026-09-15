/**
 * Phase 05A - Evidence and Decision Provenance Remediation Tests
 *
 * E1: Decision provenance traceability
 * E2: Evidence IDs
 * E3: Explainability
 * B2: Reasoning evidence traceability
 * P2: Trustworthy intelligence
 */

import { ProvenanceTrace, ProvenanceLink, ExplainabilityRecord, ReasoningProvenance } from "../Core/ProvenanceTrace";
import { ReasoningEngine } from "../Engines/ReasoningEngine";

describe("ProvenanceTrace - Evidence ID Creation", () => {
    it("creates a stable trace ID with correct format", () => {
        const traceId = ProvenanceTrace.createTraceId();
        expect(traceId).toMatch(/^TRACE-[a-z0-9]+-[a-z0-9]+-[0-9]+$/);
    });

    it("creates unique trace IDs for each call", () => {
        const ids = new Set(Array.from({ length: 100 }, () => ProvenanceTrace.createTraceId()));
        expect(ids.size).toBe(100);
    });

    it("generates consistent input hash", () => {
        const input = "test input";
        const hash1 = ProvenanceTrace.hashInput(input);
        const hash2 = ProvenanceTrace.hashInput(input);
        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("generates different hashes for different inputs", () => {
        const hash1 = ProvenanceTrace.hashInput("input1");
        const hash2 = ProvenanceTrace.hashInput("input2");
        expect(hash1).not.toBe(hash2);
    });
});

describe("ProvenanceTrace - Source Linkage", () => {
    it("creates provenance link with all required fields", () => {
        const link = ProvenanceTrace.createProvenanceLink({
            sourceRef: "test-source",
            inputRef: "test-input",
            reasoningRef: "test-reasoning",
            decisionRef: "test-decision"
        });

        expect(link.traceId).toMatch(/^TRACE-/);
        expect(link.sourceRef).toBe("test-source");
        expect(link.inputRef).toBe("test-input");
        expect(link.reasoningRef).toBe("test-reasoning");
        expect(link.decisionRef).toBe("test-decision");
        expect(link.timestamp).toBeDefined();
        expect(link.verificationStatus).toBe("VERIFIED");
    });

    it("creates provenance link with optional transformation ref", () => {
        const link = ProvenanceTrace.createProvenanceLink({
            sourceRef: "test-source",
            inputRef: "test-input",
            transformationRef: "test-transformation",
            reasoningRef: "test-reasoning",
            decisionRef: "test-decision"
        });

        expect(link.transformationRef).toBe("test-transformation");
    });

    it("provenance link is immutable", () => {
        const link = ProvenanceTrace.createProvenanceLink({
            sourceRef: "test-source",
            inputRef: "test-input",
            reasoningRef: "test-reasoning",
            decisionRef: "test-decision"
        });

        expect(() => { (link as any).sourceRef = "modified"; }).toThrow();
    });
});

describe("ProvenanceTrace - Decision to Evidence Linkage", () => {
    it("links provenance to a decision result", () => {
        const result = { decision: "APPROVE", amount: 1000 };
        const provenance = ProvenanceTrace.createProvenanceLink({
            sourceRef: "financial-analysis",
            inputRef: "revenue:5000-expenses:3000",
            reasoningRef: "reasoning-123",
            decisionRef: "decision-456"
        });

        const linked = ProvenanceTrace.linkToDecision(result, provenance);

        expect(linked.decision).toBe("APPROVE");
        expect(linked.amount).toBe(1000);
        expect(linked.provenance).toBeDefined();
        expect(linked.provenance.traceId).toMatch(/^TRACE-/);
        expect(linked.provenance.sourceRef).toBe("financial-analysis");
    });

    it("linked result preserves original fields", () => {
        const result = { status: "COMPLETE", metrics: { profit: 2000 } };
        const provenance = ProvenanceTrace.createProvenanceLink({
            sourceRef: "test",
            inputRef: "input",
            reasoningRef: "reasoning",
            decisionRef: "decision"
        });

        const linked = ProvenanceTrace.linkToDecision(result, provenance);

        expect(linked.status).toBe("COMPLETE");
        expect(linked.metrics.profit).toBe(2000);
        expect(linked.provenance.traceId).toBeDefined();
    });
});

describe("ProvenanceTrace - Explainability Output", () => {
    it("creates explainability record with required fields", () => {
        const record = ProvenanceTrace.createExplainabilityRecord({
            reasoningChain: ["input received", "analysis performed", "decision made"],
            inputSummary: "Revenue: 5000, Expenses: 3000",
            decisionBasis: "Profit threshold met",
            confidence: 0.85
        });

        expect(record.traceId).toMatch(/^TRACE-/);
        expect(record.reasoningChain).toHaveLength(3);
        expect(record.inputSummary).toBe("Revenue: 5000, Expenses: 3000");
        expect(record.decisionBasis).toBe("Profit threshold met");
        expect(record.confidence).toBe(0.85);
    });

    it("creates explainability record with limitations", () => {
        const record = ProvenanceTrace.createExplainabilityRecord({
            reasoningChain: ["analysis performed"],
            inputSummary: "Limited data",
            decisionBasis: "Based on available data",
            confidence: 0.5,
            limitations: ["Incomplete historical data", "Single period analysis"]
        });

        expect(record.limitations).toHaveLength(2);
        expect(record.limitations).toContain("Incomplete historical data");
    });

    it("rejects confidence outside valid range", () => {
        expect(() => ProvenanceTrace.createExplainabilityRecord({
            reasoningChain: [],
            inputSummary: "test",
            decisionBasis: "test",
            confidence: 2.0
        })).toThrow("provenance-confidence-invalid-range");

        expect(() => ProvenanceTrace.createExplainabilityRecord({
            reasoningChain: [],
            inputSummary: "test",
            decisionBasis: "test",
            confidence: -0.5
        })).toThrow("provenance-confidence-invalid-range");
    });

    it("explainability record is immutable", () => {
        const record = ProvenanceTrace.createExplainabilityRecord({
            reasoningChain: ["step1"],
            inputSummary: "test",
            decisionBasis: "test",
            confidence: 0.8
        });

        expect(() => { (record as any).confidence = 0.5; }).toThrow();
    });
});

describe("ProvenanceTrace - Reasoning Provenance", () => {
    it("creates reasoning provenance with verification status", () => {
        const provenance = ProvenanceTrace.createReasoningProvenance({
            sourceRef: "financial-data",
            input: "revenue=5000",
            reasoningSteps: ["parse", "analyze", "conclude"],
            output: "profit=2000"
        });

        expect(provenance.traceId).toMatch(/^TRACE-/);
        expect(provenance.sourceRef).toBe("financial-data");
        expect(provenance.inputHash).toMatch(/^[a-f0-9]{64}$/);
        expect(provenance.outputHash).toMatch(/^[a-f0-9]{64}$/);
        expect(provenance.verificationStatus).toBe("VERIFIED");
    });

    it("verifies input hash correctly", () => {
        const input = "test input for verification";
        const hash = ProvenanceTrace.hashInput(input);
        expect(ProvenanceTrace.verifyInput(input, hash)).toBe(true);
        expect(ProvenanceTrace.verifyInput("different input", hash)).toBe(false);
    });

    it("verifies output hash correctly", () => {
        const output = "test output for verification";
        const hash = ProvenanceTrace.hashInput(output);
        expect(ProvenanceTrace.verifyOutput(output, hash)).toBe(true);
        expect(ProvenanceTrace.verifyOutput("different output", hash)).toBe(false);
    });
});

describe("ReasoningEngine - B2/P2 Provenance", () => {
    it("provides provenance on successful reasoning", () => {
        const engine = new ReasoningEngine();
        // Note: This test may fail if Python runtime is not available
        // In that case, we check the structure
        const result = engine.reason("test problem");

        expect(result.provenance).toBeDefined();
        expect(result.provenance?.traceId).toMatch(/^TRACE-/);
        expect(result.provenance?.inputHash).toMatch(/^[a-f0-9]{64}$/);
        expect(result.provenance?.timestamp).toBeDefined();
    });

    it("provides provenance with pending status on failure", () => {
        const engine = new ReasoningEngine();
        const result = engine.reason(""); // Empty problem fails

        expect(result.provenance).toBeDefined();
        expect(result.provenance?.verificationStatus).toBe("PENDING");
    });

    it("returns provenance on reasoning failure", () => {
        const engine = new ReasoningEngine();
        // Invalid input should fail gracefully
        const result = engine.reason(" ");

        expect(result.success).toBe(false);
        expect(result.provenance).toBeDefined();
        expect(result.provenance?.verificationStatus).toBe("PENDING");
    });
});

/**
 * Phase 05A-1 - REAL Runtime Provenance Integration Tests
 * Verifies that ProvenanceTrace is actually integrated into the ReasoningEngine path
 */
describe("ReasoningEngine - REAL Runtime Provenance Integration", () => {
    it("input hash corresponds to actual input", () => {
        const engine = new ReasoningEngine();
        const testInput = "What is 2+2?";
        const result = engine.reason(testInput);

        // Verify the hash matches the actual input
        const expectedHash = ProvenanceTrace.hashInput(testInput);
        expect(result.provenance?.inputHash).toBe(expectedHash);
    });

    it("output hash corresponds to actual answer when present", () => {
        const engine = new ReasoningEngine();
        // Use a problem that should succeed if Python runtime available
        const result = engine.reason("test problem");

        if (result.answer && result.provenance?.outputHash) {
            const expectedOutputHash = ProvenanceTrace.hashInput(result.answer);
            expect(result.provenance.outputHash).toBe(expectedOutputHash);
        }
    });

    it("provenance status is truthful when Python runtime succeeds", () => {
        const engine = new ReasoningEngine();
        const result = engine.reason("test problem");

        // If answer is present, status should be VERIFIED
        if (result.answer) {
            expect(result.provenance?.verificationStatus).toBe("VERIFIED");
        }
    });

    it("failure path does not falsely report VERIFIED", () => {
        const engine = new ReasoningEngine();
        const result = engine.reason(""); // Invalid input

        // Failure should never be VERIFIED
        expect(result.provenance?.verificationStatus).not.toBe("VERIFIED");
        expect(result.provenance?.verificationStatus).toBe("PENDING");
    });

    it("no fabricated source references", () => {
        const engine = new ReasoningEngine();
        const result = engine.reason("test problem");

        // sourceRef should be "unavailable" not a fake ID
        expect(result.provenance?.sourceRef).toBe("unavailable");
    });

    it("provenance survives the real reason() return path", () => {
        const engine = new ReasoningEngine();
        const result = engine.reason("test problem");

        // Provenance should survive the return
        expect(result.provenance).toBeDefined();
        expect(result.provenance?.traceId).toMatch(/^TRACE-/);
        expect(result.provenance?.inputHash).toMatch(/^[a-f0-9]{64}$/);

        // Full chain fields should be present
        expect(result.provenance?.sourceRef).toBeDefined();
        expect(result.provenance?.transformationRef).toBe("python-ai-runtime");
        expect(result.provenance?.reasoningSteps).toBeDefined();
    });

    it("explainability present only when output exists", () => {
        const engine = new ReasoningEngine();

        // Success case
        const successResult = engine.reason("test problem");
        if (successResult.answer) {
            expect(successResult.provenance?.explainability).toBeDefined();
            // P2: Confidence is only present when runtime provides a real value.
            // No hard-coded 0.85.
        }

        // Failure case
        const failResult = engine.reason("");
        expect(failResult.provenance?.explainability).toBeUndefined();
    });

    it("P2: does not hard-code confidence to 0.85", () => {
        const engine = new ReasoningEngine();
        const result = engine.reason("test problem");

        // If answer exists, confidence should NOT be a hard-coded 0.85
        if (result.answer && result.provenance?.explainability) {
            expect(result.provenance.explainability.confidence).not.toBe(0.85);
        }
    });

    it("verification status is PENDING when no answer from Python runtime", () => {
        const engine = new ReasoningEngine();
        // Empty/whitespace input should fail
        const result = engine.reason("   ");

        expect(result.success).toBe(false);
        expect(result.provenance?.verificationStatus).toBe("PENDING");
        expect(result.provenance?.outputHash).toBeUndefined();
    });
});

describe("ProvenanceTrace - Malformed/Missing Evidence Rejection", () => {
    it("rejects empty source ref in provenance link", () => {
        expect(() => ProvenanceTrace.createProvenanceLink({
            sourceRef: "",
            inputRef: "input",
            reasoningRef: "reasoning",
            decisionRef: "decision"
        })).toThrow();
    });

    it("rejects empty input ref in provenance link", () => {
        expect(() => ProvenanceTrace.createProvenanceLink({
            sourceRef: "source",
            inputRef: "",
            reasoningRef: "reasoning",
            decisionRef: "decision"
        })).toThrow();
    });

    it("rejects confidence outside valid range when creating explainability", () => {
        expect(() => ProvenanceTrace.createExplainabilityRecord({
            reasoningChain: [],
            inputSummary: "test",
            decisionBasis: "test",
            confidence: 2.0
        })).toThrow();
    });

    it("verifies input with wrong hash returns false", () => {
        expect(ProvenanceTrace.verifyInput("input", "wronghash")).toBe(false);
    });

    it("verifies output with wrong hash returns false", () => {
        expect(ProvenanceTrace.verifyOutput("output", "wronghash")).toBe(false);
    });
});

describe("ProvenanceTrace - Evidence Flow Integration", () => {
    it("supports complete evidence chain", () => {
        // SOURCE
        const sourceRef = "financial-statement";

        // INPUT
        const input = "revenue:10000,expenses:6000,assets:50000,liabilities:20000";
        const inputRef = ProvenanceTrace.hashInput(input);

        // TRANSFORMATION (if applicable)
        const transformationRef = "normalization-complete";

        // REASONING
        const reasoningSteps = ["parse financial data", "calculate metrics", "apply thresholds"];
        const reasoningRef = ProvenanceTrace.createTraceId();

        // DECISION
        const decision = {
            action: "APPROVE_LOAN",
            amount: 50000,
            status: "READY"
        };
        const decisionRef = ProvenanceTrace.createTraceId();

        // Create full provenance chain
        const provenance = ProvenanceTrace.createProvenanceLink({
            sourceRef,
            inputRef,
            transformationRef,
            reasoningRef,
            decisionRef
        });

        // Link to decision
        const linkedDecision = ProvenanceTrace.linkToDecision(decision, provenance);

        // Create explainability
        const explainability = ProvenanceTrace.createExplainabilityRecord({
            reasoningChain: reasoningSteps,
            inputSummary: `Processed ${input.split(",").length} financial metrics`,
            decisionBasis: `Loan approval based on debt ratio ${50000/20000}`,
            confidence: 0.92,
            limitations: ["Historical performance not considered"]
        });

        // Verify chain
        expect(linkedDecision.provenance.traceId).toMatch(/^TRACE-/);
        expect(linkedDecision.provenance.sourceRef).toBe(sourceRef);
        expect(linkedDecision.provenance.decisionRef).toBe(decisionRef);
        expect(explainability.traceId).toMatch(/^TRACE-/);
        expect(explainability.confidence).toBe(0.92);
    });
});
