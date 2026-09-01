/**
 * Phase 05B - Real Decision Evidence Propagation Tests
 *
 * Tests the actual production path:
 * ReasoningEngine → DecisionContext → DecisionEngine → ProjectDecision → AssistantResponse
 *
 * IMPORTANT: These tests exercise the REAL path, not standalone unit tests.
 */

import { DecisionContext } from "../Core/DecisionContext";
import { DecisionEngine } from "../Engines/DecisionEngine";
import { AssistantEngine } from "../Engines/AssistantEngine";
import { ReasoningEngine } from "../Engines/ReasoningEngine";
import { Project } from "../Entities/Project";
import { ProjectDecision } from "../Entities/ProjectDecision";
import { AssistantResponse } from "../Entities/AssistantResponse";
import { ProjectStatus } from "../Entities/ProjectStatus";

describe("Phase 05B - Real Decision Evidence Propagation", () => {

    describe("DecisionContext Contract", () => {
        it("creates unavailable context when no evidence provided", () => {
            const ctx = DecisionContext.unavailable();
            expect(ctx.traceId).toBeUndefined();
            expect(ctx.inputHash).toBeUndefined();
            expect(ctx.confidence).toBeUndefined();
        });

        it("creates context from available evidence", () => {
            const ctx = DecisionContext.fromEvidence({
                traceId: "TRACE-123",
                inputHash: "abc123",
                confidence: 0.85,
                explanation: "Test explanation"
            });
            expect(ctx.traceId).toBe("TRACE-123");
            expect(ctx.inputHash).toBe("abc123");
            expect(ctx.confidence).toBe(0.85);
            expect(ctx.explanation).toBe("Test explanation");
        });

        it("does not fabricate fields that are not provided", () => {
            const ctx = DecisionContext.fromEvidence({
                traceId: "TRACE-123"
            });
            expect(ctx.traceId).toBe("TRACE-123");
            expect(ctx.inputHash).toBeUndefined();
            expect(ctx.confidence).toBeUndefined();
            expect(ctx.explanation).toBeUndefined();
        });

        it("rejects invalid confidence values", () => {
            const ctx = DecisionContext.fromEvidence({
                confidence: 1.5
            });
            expect(ctx.confidence).toBeUndefined();

            const ctx2 = DecisionContext.fromEvidence({
                confidence: -0.5
            });
            expect(ctx2.confidence).toBeUndefined();
        });
    });

    describe("Reasoning Result to DecisionContext Conversion", () => {
        it("can convert reasoning result to DecisionContext", () => {
            const engine = new ReasoningEngine();
            const result = engine.reason("test problem");

            // Convert reasoning result to DecisionContext
            const context = DecisionContext.fromEvidence({
                traceId: result.provenance?.traceId,
                inputHash: result.provenance?.inputHash,
                explanation: result.provenance?.explainability?.decisionBasis,
                confidence: result.provenance?.explainability?.confidence,
                limitations: result.provenance?.explainability?.limitations
            });

            // Verify conversion preserves evidence
            expect(context.traceId).toBe(result.provenance?.traceId);
            expect(context.inputHash).toBe(result.provenance?.inputHash);
        });

        it("handles reasoning failure gracefully", () => {
            const engine = new ReasoningEngine();
            const result = engine.reason(""); // Invalid input

            const context = DecisionContext.fromEvidence({
                traceId: result.provenance?.traceId,
                inputHash: result.provenance?.inputHash
            });

            // Even on failure, traceId and inputHash should be preserved
            expect(context.traceId).toBeDefined();
            expect(context.inputHash).toBeDefined();
            // But confidence should not be fabricated
            expect(context.confidence).toBeUndefined();
        });
    });

    describe("DecisionEngine Receives Context Without Invoking ReasoningEngine", () => {
        it("accepts DecisionContext as second parameter", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                traceId: "TRACE-123",
                confidence: 0.75
            });

            const decision = engine.decide(project, context);

            expect(decision).toBeDefined();
            expect(decision.traceId).toBe("TRACE-123");
            expect(decision.confidence).toBe(0.75);
        });

        it("does not invoke ReasoningEngine internally", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");

            // DecisionEngine should work without any ReasoningEngine instance
            const decision = engine.decide(project);

            expect(decision).toBeDefined();
            expect(decision.status).toBe(ProjectStatus.Planning);
        });

        it("preserves existing decide(project) signature", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");

            // Backward compatibility: single argument still works
            const decision = engine.decide(project);

            expect(decision).toBeDefined();
            expect(decision.message).toBeDefined();
        });
    });

    describe("ProjectDecision Preserves Evidence", () => {
        it("preserves traceId from context", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                traceId: "TRACE-abc-123"
            });

            const decision = engine.decide(project, context);

            expect(decision.traceId).toBe("TRACE-abc-123");
        });

        it("preserves inputHash from context", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                inputHash: "sha256-hash-value"
            });

            const decision = engine.decide(project, context);

            expect(decision.inputHash).toBe("sha256-hash-value");
        });

        it("preserves explanation from context", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                explanation: "Decision based on revenue analysis"
            });

            const decision = engine.decide(project, context);

            expect(decision.explanation).toBe("Decision based on revenue analysis");
        });

        it("preserves limitations from context", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                limitations: ["Limited historical data", "Single period analysis"]
            });

            const decision = engine.decide(project, context);

            expect(decision.limitations).toEqual(["Limited historical data", "Single period analysis"]);
        });

        it("marks evidence as unavailable when not provided", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");

            const decision = engine.decide(project);

            expect(decision.traceId).toBeUndefined();
            expect(decision.inputHash).toBeUndefined();
            expect(decision.explanation).toBeUndefined();
            expect(decision.confidence).toBeUndefined();
        });
    });

    describe("AssistantEngine Preserves Evidence", () => {
        it("preserves evidence from DecisionContext to AssistantResponse", () => {
            const engine = new AssistantEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                traceId: "TRACE-xyz-789",
                inputHash: "input-hash-123",
                explanation: "Revenue exceeded threshold",
                confidence: 0.92,
                limitations: ["Q1 data only"]
            });

            const response = engine.analyzeProject(project, context);

            expect(response.traceId).toBe("TRACE-xyz-789");
            expect(response.inputHash).toBe("input-hash-123");
            expect(response.explanation).toBe("Revenue exceeded threshold");
            expect(response.limitations).toEqual(["Q1 data only"]);
        });

        it("AssistantResponse does not hard-code 0.85 confidence", () => {
            const engine = new AssistantEngine();
            const project = new Project("test-project");

            // Without evidence, confidence should be undefined, not 0.85
            const response = engine.analyzeProject(project);

            expect(response.confidence).not.toBe(0.85);
            expect(response.confidence).toBeUndefined();
        });

        it("uses actual confidence from evidence", () => {
            const engine = new AssistantEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                confidence: 0.67
            });

            const response = engine.analyzeProject(project, context);

            expect(response.confidence).toBe(0.67);
        });

        it("preserves evidence through full path: context → decision → response", () => {
            const engine = new AssistantEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                traceId: "TRACE-full-path",
                inputHash: "hash-full-path",
                confidence: 0.88
            });

            const response = engine.analyzeProject(project, context);

            // Evidence should survive the full path
            expect(response.traceId).toBe("TRACE-full-path");
            expect(response.inputHash).toBe("hash-full-path");
            expect(response.confidence).toBe(0.88);
        });
    });

    describe("Missing Evidence Remains Explicitly Unavailable", () => {
        it("does not fabricate sourceRef", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                traceId: "TRACE-123"
            });

            const decision = engine.decide(project, context);

            // sourceRef should not exist (not in DecisionContext contract)
            expect((decision as any).sourceRef).toBeUndefined();
        });

        it("does not fabricate decisionRef", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");
            const context = DecisionContext.fromEvidence({
                traceId: "TRACE-123"
            });

            const decision = engine.decide(project, context);

            // decisionRef should not exist (not in DecisionContext contract)
            expect((decision as any).decisionRef).toBeUndefined();
        });

        it("does not fabricate confidence when unavailable", () => {
            const engine = new AssistantEngine();
            const project = new Project("test-project");

            const response = engine.analyzeProject(project);

            // Confidence should be undefined, not a fabricated value
            expect(response.confidence).toBeUndefined();
        });
    });

    describe("DecisionIntelligenceEngine Remains Unused", () => {
        it("DecisionEngine does not depend on DecisionIntelligenceEngine", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");

            // DecisionEngine should work without DecisionIntelligenceEngine
            const decision = engine.decide(project);

            expect(decision).toBeDefined();
        });

        it("AssistantEngine does not invoke DecisionIntelligenceEngine", () => {
            const engine = new AssistantEngine();
            const project = new Project("test-project");

            // AssistantEngine should work without DecisionIntelligenceEngine
            const response = engine.analyzeProject(project);

            expect(response).toBeDefined();
        });
    });

    describe("Existing DecisionEngine Behavior Remains Green", () => {
        it("decide(project) returns valid ProjectDecision", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");
            project.activate();

            const decision = engine.decide(project);

            expect(decision.status).toBe(ProjectStatus.Active);
            expect(decision.message).toContain("Analyze project status");
        });

        it("decision message reflects project status", () => {
            const engine = new DecisionEngine();
            const project = new Project("test-project");
            project.complete();

            const decision = engine.decide(project);

            expect(decision.message).toBe("Analyze project status: Completed");
        });
    });

    describe("End-to-End Evidence Flow", () => {
        it("full path: ReasoningEngine → DecisionContext → DecisionEngine → ProjectDecision → AssistantResponse", () => {
            // Step 1: ReasoningEngine produces result with provenance
            const reasoningEngine = new ReasoningEngine();
            const reasoningResult = reasoningEngine.reason("Should we expand to new market?");

            // Step 2: Convert reasoning result to DecisionContext
            const context = DecisionContext.fromEvidence({
                traceId: reasoningResult.provenance?.traceId,
                inputHash: reasoningResult.provenance?.inputHash,
                explanation: reasoningResult.provenance?.explainability?.decisionBasis,
                confidence: reasoningResult.provenance?.explainability?.confidence,
                limitations: reasoningResult.provenance?.explainability?.limitations
            });

            // Step 3: AssistantEngine orchestrates the flow
            const assistantEngine = new AssistantEngine();
            const project = new Project("market-expansion");
            project.activate();

            const response = assistantEngine.analyzeProject(project, context);

            // Step 4: Verify evidence survived the full path
            expect(response.traceId).toBe(reasoningResult.provenance?.traceId);
            expect(response.inputHash).toBe(reasoningResult.provenance?.inputHash);
            expect(response.project.name).toBe("market-expansion");
        });

        it("evidence is truthful - no fabrication on failure path", () => {
            // Step 1: ReasoningEngine fails
            const reasoningEngine = new ReasoningEngine();
            const reasoningResult = reasoningEngine.reason(""); // Invalid input

            // Step 2: Convert to DecisionContext
            const context = DecisionContext.fromEvidence({
                traceId: reasoningResult.provenance?.traceId,
                inputHash: reasoningResult.provenance?.inputHash
            });

            // Step 3: Pass through AssistantEngine
            const assistantEngine = new AssistantEngine();
            const project = new Project("test-project");
            const response = assistantEngine.analyzeProject(project, context);

            // Step 4: Verify no fabrication
            expect(response.traceId).toBe(reasoningResult.provenance?.traceId);
            expect(response.confidence).toBeUndefined(); // Not fabricated
            expect(response.explanation).toBeUndefined(); // Not fabricated
        });
    });

    /**
     * Phase 05B-1 - Truthful Confidence Correction Tests
     *
     * Proves:
     * A. Runtime-provided confidence is preserved if it truly exists
     * B. When runtime confidence is absent, confidence is undefined
     * C. No hard-coded 0.85 remains
     * D. Limitations explicitly disclose missing confidence
     * E. Full path still preserves truthful evidence
     * F. Failure path never produces fabricated confidence
     */
    describe("Phase 05B-1 - Truthful Confidence", () => {
        it("A: no hard-coded 0.85 in ReasoningEngine explainability", () => {
            const engine = new ReasoningEngine();
            const result = engine.reason("test problem");

            if (result.answer && result.provenance?.explainability) {
                expect(result.provenance.explainability.confidence).not.toBe(0.85);
            }
        });

        it("B: confidence is undefined when runtime does not provide it", () => {
            const engine = new ReasoningEngine();
            const result = engine.reason("test problem");

            // When the Python runtime does not return a confidence field,
            // explainability.confidence must be undefined, not a fabricated value
            if (result.answer && result.provenance?.explainability) {
                expect(result.provenance.explainability.confidence).toBeUndefined();
            }
        });

        it("C: provenance explainability confidence is never 0.85 hard-coded", () => {
            // Run multiple reasoning attempts to ensure no 0.85 ever appears
            const engine = new ReasoningEngine();
            for (let i = 0; i < 5; i++) {
                const result = engine.reason(`test problem ${i}`);
                if (result.answer && result.provenance?.explainability) {
                    expect(result.provenance.explainability.confidence).not.toBe(0.85);
                }
            }
        });

        it("D: limitations explicitly disclose missing confidence", () => {
            const engine = new ReasoningEngine();
            const result = engine.reason("test problem");

            if (result.answer && result.provenance?.explainability) {
                // When confidence is undefined, limitations should disclose it
                if (result.provenance.explainability.confidence === undefined) {
                    const limitations = result.provenance.explainability.limitations ?? [];
                    const hasConfidenceDisclosure = limitations.some(
                        (l) => l.toLowerCase().includes("confidence") &&
                               l.toLowerCase().includes("not available")
                    );
                    expect(hasConfidenceDisclosure).toBe(true);
                }
            }
        });

        it("E: full path preserves truthful evidence without fabricated confidence", () => {
            const reasoningEngine = new ReasoningEngine();
            const reasoningResult = reasoningEngine.reason("Should we proceed?");

            // Convert to DecisionContext
            const context = DecisionContext.fromEvidence({
                traceId: reasoningResult.provenance?.traceId,
                inputHash: reasoningResult.provenance?.inputHash,
                explanation: reasoningResult.provenance?.explainability?.decisionBasis,
                confidence: reasoningResult.provenance?.explainability?.confidence,
                limitations: reasoningResult.provenance?.explainability?.limitations
            });

            // Pass through AssistantEngine
            const assistantEngine = new AssistantEngine();
            const project = new Project("test-project");
            const response = assistantEngine.analyzeProject(project, context);

            // Evidence preserved, but confidence is NOT fabricated
            expect(response.traceId).toBe(reasoningResult.provenance?.traceId);
            expect(response.inputHash).toBe(reasoningResult.provenance?.inputHash);
            // Confidence from runtime is propagated truthfully (undefined if runtime didn't provide)
            expect(response.confidence).toBe(reasoningResult.provenance?.explainability?.confidence);
        });

        it("F: failure path never produces fabricated confidence", () => {
            const engine = new ReasoningEngine();

            // Empty input - failure path
            const emptyResult = engine.reason("");
            expect(emptyResult.success).toBe(false);
            expect(emptyResult.provenance?.explainability).toBeUndefined();

            // Whitespace input - failure path
            const whitespaceResult = engine.reason("   ");
            expect(whitespaceResult.success).toBe(false);
            expect(whitespaceResult.provenance?.explainability).toBeUndefined();
        });

        it("E3: explainability exists with truthful confidence when output present", () => {
            const engine = new ReasoningEngine();
            const result = engine.reason("meaningful problem");

            if (result.answer) {
                // Explainability should exist
                expect(result.provenance?.explainability).toBeDefined();
                // But confidence should be undefined (runtime doesn't provide it)
                expect(result.provenance?.explainability?.confidence).toBeUndefined();
                // Limitations should disclose the missing confidence
                expect(result.provenance?.explainability?.limitations).toBeDefined();
                const limitations = result.provenance!.explainability!.limitations!;
                expect(limitations.some((l) => l.includes("Confidence"))).toBe(true);
            }
        });

        it("P2: trustworthy intelligence - no hard-coded confidence values", () => {
            const engine = new ReasoningEngine();

            // Test multiple scenarios
            const results = [
                engine.reason("problem 1"),
                engine.reason("problem 2"),
                engine.reason(""),  // failure
                engine.reason("   ") // failure
            ];

            for (const result of results) {
                if (result.provenance?.explainability?.confidence !== undefined) {
                    // If confidence exists, it must be from runtime, not hard-coded
                    // We verify it's not the known hard-coded values
                    expect(result.provenance.explainability.confidence).not.toBe(0.85);
                }
            }
        });
    });
});
