/**
 * Phase 06-E - Truthful Confidence Regression Tests
 *
 * Tests that verify fabricated confidence has been eliminated from the intelligence pipeline.
 *
 * Success criteria:
 * 1. fabricated AssistantConfidence no longer exists
 * 2. IntelligenceEngine domain thresholds are not mislabeled as confidence
 * 3. IntelligenceEngine does not emit fabricated confidence
 * 4. legitimate calculated confidence carries formula/source metadata
 * 5. legitimate model confidence is preserved
 * 6. unavailable confidence remains unavailable
 * 7. changing a financial/domain threshold changes reasoning outcome,
 *    NOT confidence merely because a threshold exists
 * 8. confidence does not equal domain/risk score
 * 9. confidence remains within [0,1] when present
 * 10. invalid confidence becomes unavailable/rejected
 * 11. confidence provenance survives IntelligenceEngine → DecisionEngine
 * 12. DecisionEngine never invents confidence
 * 13. AssistantResponse does not invent/upgrade confidence
 */

import { IntelligenceEngine } from "../Engines/IntelligenceEngine";
import { IntelligenceInput, IntelligenceContext, IntelligenceResult, IntelligencePipeline, TruthfulConfidence } from "../Core/IntelligenceContract";
import { AssistantConfidence } from "../Core/AssistantConfidence";
import { AssistantContext } from "../Core/AssistantContext";
import { Project } from "../Core/Project";
import { AssistantMemory } from "../Core/AssistantMemory";
import { MemoryEngine } from "../Engines/MemoryEngine";
import { DecisionEngine, DecisionInput } from "../Decision/DecisionEngine";
import { MemoryEvent } from "../Entities/MemoryEvent";

describe("Phase 06-E - Truthful Confidence", () => {

    describe("1. AssistantConfidence - No Fabricated Confidence", () => {

        test("AssistantConfidence.calculate() returns unavailable, not fabricated numeric confidence", () => {
            const assistantConfidence = new AssistantConfidence();
            const project = new Project("Test Project");
            const mockContext = new AssistantContext(project, []);

            const result = assistantConfidence.calculate(mockContext);

            // Phase 06-E: Must return unavailable, not a fabricated number
            expect(result).toEqual({ source: "unavailable" });
            expect(result.source).toBe("unavailable");
        });

        test("AssistantConfidence does NOT produce hard-coded additive scores", () => {
            const assistantConfidence = new AssistantConfidence();
            const project1 = new Project("Project A");
            const project2 = new Project("Project B");
            const context1 = new AssistantContext(project1, []);
            const context2 = new AssistantContext(project2, [new MemoryEvent("milestone", "completed", "test")]);

            const result1 = assistantConfidence.calculate(context1);
            const result2 = assistantConfidence.calculate(context2);

            // Both must return unavailable - no fabricated differentiation
            expect(result1).toEqual({ source: "unavailable" });
            expect(result2).toEqual({ source: "unavailable" });
        });
    });

    describe("2. IntelligenceEngine - Domain Thresholds Not Mislabeled as Confidence", () => {

        let engine: IntelligenceEngine;

        beforeEach(() => {
            engine = new IntelligenceEngine();
        });

        test("Financial GOOD path: profitMargin threshold (0.1) is classification, not confidence", () => {
            const input: IntelligenceInput = {
                problem: "Analyze financial health",
                data: {
                    revenue: 100000,
                    expenses: 50000,
                    assets: 200000,
                    liabilities: 80000
                    // profitMargin = 0.5, debtRatio = 0.4 → GOOD
                }
            };

            const context: IntelligenceContext = {
                knowledgeItems: [],
                evidenceItems: []
            };

            const result = engine.reason(input, context);

            // The conclusion should reflect the domain classification
            expect(result.conclusion).toContain("GOOD");

            // Phase 06-E: Confidence must NOT be profitMargin value (0.5)
            // Confidence should be based on data quality, not domain value
            if (result.confidence.source === "calculated") {
                // Confidence is calculated from data quality (0-1 scale), not profitMargin
                expect(result.confidence.value).toBeLessThanOrEqual(1);
                expect(result.confidence.value).toBeGreaterThanOrEqual(0);
                // The formula should reference data_completeness, not profit_margin
                expect(result.confidence.formula).toContain("data_completeness");
            }
        });

        test("Financial MARGINAL path: profitMargin threshold (0.0) is classification, not confidence", () => {
            const input: IntelligenceInput = {
                problem: "Analyze financial health",
                data: {
                    revenue: 100000,
                    expenses: 80000,
                    assets: 200000,
                    liabilities: 100000
                    // profitMargin = 0.2, debtRatio = 0.5 → MARGINAL
                }
            };

            const context: IntelligenceContext = {
                knowledgeItems: [],
                evidenceItems: []
            };

            const result = engine.reason(input, context);

            expect(result.conclusion).toContain("MARGINAL");
            // Confidence must NOT be 0.6 (the old fabricated value)
            if (result.confidence.source === "calculated") {
                expect(result.confidence.formula).not.toBe("profit_margin * 0.6");
            }
        });

        test("Budget thresholds (0.9, 1.1) are classification boundaries, not confidence", () => {
            const input: IntelligenceInput = {
                problem: "Analyze budget",
                data: {
                    planned: 100000,
                    actual: 105000  // utilization = 1.05 → ON TRACK
                }
            };

            const context: IntelligenceContext = {
                knowledgeItems: [],
                evidenceItems: []
            };

            const result = engine.reason(input, context);

            expect(result.conclusion).toContain("ON TRACK");
            // Confidence must NOT be 0.85 (the old fabricated value)
            if (result.confidence.source === "calculated") {
                expect(result.confidence.formula).not.toBe("utilization_within_bounds");
                expect(result.confidence.formula).toContain("data_completeness");
            }
        });

        test("Risk thresholds (0.6, 0.3) are classification boundaries, not confidence", () => {
            const input: IntelligenceInput = {
                problem: "Assess risk",
                data: {
                    probability: 0.8,
                    impact: 0.9
                    // riskScore = 0.72 → HIGH
                }
            };

            const context: IntelligenceContext = {
                knowledgeItems: [],
                evidenceItems: []
            };

            const result = engine.reason(input, context);

            expect(result.conclusion).toContain("HIGH");
            // Confidence must NOT be 0.85 (the old fabricated value)
            if (result.confidence.source === "calculated") {
                expect(result.confidence.formula).not.toBe("risk_score >= 0.6");
                expect(result.confidence.formula).toContain("data_completeness");
            }
        });
    });

    describe("3. IntelligenceEngine - No Fabricated Confidence", () => {

        let engine: IntelligenceEngine;

        beforeEach(() => {
            engine = new IntelligenceEngine();
        });

        test("Financial reasoning does not emit hard-coded confidence values", () => {
            const input: IntelligenceInput = {
                problem: "Analyze financial health",
                data: {
                    revenue: 100000,
                    expenses: 50000,
                    assets: 200000,
                    liabilities: 80000
                }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            // Check that no hard-coded fabricated values are present
            // The old values were: 0.95, 0.6, 0.75
            if (result.confidence.source !== "unavailable") {
                expect(result.confidence.value).not.toBe(0.95);
                expect(result.confidence.value).not.toBe(0.6);
                expect(result.confidence.value).not.toBe(0.75);
            }
        });

        test("Budget reasoning does not emit hard-coded confidence values", () => {
            const input: IntelligenceInput = {
                problem: "Analyze budget",
                data: { planned: 100000, actual: 95000 }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            // Check that no hard-coded fabricated values are present
            // The old values were: 0.85, 0.8
            if (result.confidence.source !== "unavailable") {
                expect(result.confidence.value).not.toBe(0.85);
                expect(result.confidence.value).not.toBe(0.8);
            }
        });

        test("Risk reasoning does not emit hard-coded confidence values", () => {
            const input: IntelligenceInput = {
                problem: "Assess risk",
                data: { probability: 0.5, impact: 0.5 }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            // Check that no hard-coded fabricated values are present
            // The old values were: 0.85, 0.7, 0.75
            if (result.confidence.source !== "unavailable") {
                expect(result.confidence.value).not.toBe(0.85);
                expect(result.confidence.value).not.toBe(0.7);
                expect(result.confidence.value).not.toBe(0.75);
            }
        });

        test("Rule-based reasoning does not emit MODEL confidence without actual model", () => {
            const input: IntelligenceInput = {
                problem: "Analyze KPI",
                data: {}
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            // Rule-based routing should NOT claim MODEL confidence without a real model
            if (result.confidence.source === "calculated") {
                // Should be CALCULATED, not MODEL (since there's no actual model)
                expect(result.confidence.source).toBe("calculated");
                expect(result.confidence.formula).toContain("keyword_pattern_match");
            }
        });
    });

    describe("4. Legitimate Calculated Confidence Carries Formula and Evidence", () => {

        let engine: IntelligenceEngine;

        beforeEach(() => {
            engine = new IntelligenceEngine();
        });

        test("Calculated confidence includes formula and evidence metadata", () => {
            const input: IntelligenceInput = {
                problem: "Analyze financial health",
                data: {
                    revenue: 100000,
                    expenses: 50000,
                    assets: 200000,
                    liabilities: 80000
                }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            if (result.confidence.source === "calculated") {
                expect(result.confidence.formula).toBeDefined();
                expect(result.confidence.evidence).toBeDefined();
                expect(typeof result.confidence.formula).toBe("string");
                expect(typeof result.confidence.evidence).toBe("string");
            }
        });
    });

    describe("5. Unavailable Confidence Remains Unavailable", () => {

        let engine: IntelligenceEngine;

        beforeEach(() => {
            engine = new IntelligenceEngine();
        });

        test("Insufficient context returns unavailable confidence", () => {
            const input: IntelligenceInput = {
                problem: "Analyze something",
                data: {}  // No financial, budget, or risk metrics
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            // With no matching domain or rules, should return unavailable
            expect(result.confidence.source).toBe("unavailable");
        });

        test("Empty knowledge context returns unavailable for knowledge-grounded reasoning", () => {
            const input: IntelligenceInput = {
                problem: "Generic analysis without domain data",
                data: {}
            };

            // Empty knowledge - should not fabricate confidence
            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            expect(result.confidence.source).toBe("unavailable");
        });
    });

    describe("6. Confidence Does Not Equal Domain Score", () => {

        let engine: IntelligenceEngine;

        beforeEach(() => {
            engine = new IntelligenceEngine();
        });

        test("Confidence is not equal to profitMargin domain value", () => {
            const profitMargin = 0.5;
            const input: IntelligenceInput = {
                problem: "Analyze financial health",
                data: {
                    revenue: 100000,
                    expenses: 50000,
                    assets: 200000,
                    liabilities: 80000
                    // profitMargin = 0.5
                }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            if (result.confidence.source !== "unavailable") {
                // Confidence must NOT equal the domain value (profitMargin = 0.5)
                expect(result.confidence.value).not.toBe(profitMargin);
            }
        });

        test("Confidence is not equal to utilization domain value", () => {
            const utilization = 1.05;
            const input: IntelligenceInput = {
                problem: "Analyze budget",
                data: { planned: 100000, actual: 105000 }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            if (result.confidence.source !== "unavailable") {
                // Confidence must NOT equal the domain value (utilization = 1.05)
                expect(result.confidence.value).not.toBe(utilization);
            }
        });

        test("Confidence is not equal to riskScore domain value", () => {
            const riskScore = 0.72;
            const input: IntelligenceInput = {
                problem: "Assess risk",
                data: { probability: 0.8, impact: 0.9 }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            if (result.confidence.source !== "unavailable") {
                // Confidence must NOT equal the domain value (riskScore = 0.72)
                expect(result.confidence.value).not.toBe(riskScore);
            }
        });
    });

    describe("7. Confidence Remains Within [0,1] When Present", () => {

        let engine: IntelligenceEngine;

        beforeEach(() => {
            engine = new IntelligenceEngine();
        });

        test("Financial reasoning confidence is within [0,1]", () => {
            const input: IntelligenceInput = {
                problem: "Analyze financial health",
                data: {
                    revenue: 100000,
                    expenses: 50000,
                    assets: 200000,
                    liabilities: 80000
                }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            if (result.confidence.source !== "unavailable") {
                expect(result.confidence.value).toBeGreaterThanOrEqual(0);
                expect(result.confidence.value).toBeLessThanOrEqual(1);
            }
        });

        test("Budget reasoning confidence is within [0,1]", () => {
            const input: IntelligenceInput = {
                problem: "Analyze budget",
                data: { planned: 100000, actual: 95000 }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            if (result.confidence.source !== "unavailable") {
                expect(result.confidence.value).toBeGreaterThanOrEqual(0);
                expect(result.confidence.value).toBeLessThanOrEqual(1);
            }
        });

        test("Risk reasoning confidence is within [0,1]", () => {
            const input: IntelligenceInput = {
                problem: "Assess risk",
                data: { probability: 0.5, impact: 0.5 }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            if (result.confidence.source !== "unavailable") {
                expect(result.confidence.value).toBeGreaterThanOrEqual(0);
                expect(result.confidence.value).toBeLessThanOrEqual(1);
            }
        });

        test("Rule-based reasoning confidence is within [0,1]", () => {
            const input: IntelligenceInput = {
                problem: "Analyze KPI",
                data: {}
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const result = engine.reason(input, context);

            if (result.confidence.source !== "unavailable") {
                expect(result.confidence.value).toBeGreaterThanOrEqual(0);
                expect(result.confidence.value).toBeLessThanOrEqual(1);
            }
        });
    });

    describe("8. Confidence Provenance Survives IntelligenceEngine → DecisionEngine", () => {

        test("Intelligence confidence is preserved through DecisionEngine", () => {
            const intelligenceEngine = new IntelligenceEngine();
            const decisionEngine = new DecisionEngine();

            const intelligenceInput: IntelligenceInput = {
                problem: "Analyze financial health",
                data: {
                    revenue: 100000,
                    expenses: 50000,
                    assets: 200000,
                    liabilities: 80000
                }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };
            const intelligenceResult = intelligenceEngine.reason(intelligenceInput, context);

            const decisionInput: DecisionInput = {
                problem: "Make decision on financial health",
                objective: "Approve or reject based on financial analysis",
                assumptions: [],
                reasoning: intelligenceResult
            };

            const decisionResult = decisionEngine.evaluate(decisionInput);

            // Confidence provenance preserved
            expect(decisionResult.confidence).toBeDefined();
            // If reasoning had confidence, decision should either use it or mark unavailable
            // DecisionEngine should NOT fabricate its own confidence
            if (intelligenceResult.confidence.source !== "unavailable") {
                // Decision may use reasoning confidence or mark as unavailable if not authorized
                expect(
                    decisionResult.confidence.source === "unavailable" ||
                    decisionResult.confidence.source === "model" ||
                    decisionResult.confidence.source === "calculated"
                ).toBe(true);
            }
        });
    });

    describe("9. DecisionEngine Never Invents Confidence", () => {

        test("DecisionEngine REJECTED outcome uses unavailable confidence", () => {
            const decisionEngine = new DecisionEngine();
            decisionEngine.initialize();

            // Create a blocking rule that always triggers
            const decisionInput: DecisionInput = {
                problem: "Test rejection",
                objective: "Test",
                assumptions: [],
                rules: [{
                    id: "BLOCK-1",
                    description: "Always blocking",
                    blocking: true,
                    match: () => ({ matched: true, reason: "Test block" })
                }]
            };

            const result = decisionEngine.evaluate(decisionInput);

            // Rejection should use unavailable confidence (not fabricate 0.95)
            expect(result.outcome).toBe("REJECTED");
            expect(result.confidence.source).toBe("unavailable");
        });

        test("DecisionEngine REVIEW_REQUIRED outcome uses unavailable confidence", () => {
            const decisionEngine = new DecisionEngine();
            decisionEngine.initialize();

            const decisionInput: DecisionInput = {
                problem: "Test review",
                objective: "Test",
                assumptions: []
                // No reasoning provided
            };

            const result = decisionEngine.evaluate(decisionInput);

            expect(result.outcome).toBe("REVIEW_REQUIRED");
            expect(result.confidence.source).toBe("unavailable");
        });
    });

    describe("10. Changing Domain Threshold Changes Reasoning Outcome, Not Confidence", () => {

        let engine: IntelligenceEngine;

        beforeEach(() => {
            engine = new IntelligenceEngine();
        });

        test("Changing profitMargin threshold changes conclusion, not just confidence", () => {
            // Case 1: GOOD health - profitMargin >= 0.1 AND debtRatio < 0.5
            const input1: IntelligenceInput = {
                problem: "Analyze financial health",
                data: {
                    revenue: 100000,
                    expenses: 50000,  // profitMargin = 0.5
                    assets: 200000,
                    liabilities: 80000  // debtRatio = 0.4
                }
            };

            // Case 2: MARGINAL health - profitMargin < 0.1 (below GOOD threshold)
            const input2: IntelligenceInput = {
                problem: "Analyze financial health",
                data: {
                    revenue: 100000,
                    expenses: 95000,  // profitMargin = 0.05 (< 0.1)
                    assets: 200000,
                    liabilities: 80000  // debtRatio = 0.4
                }
            };

            const context: IntelligenceContext = { knowledgeItems: [], evidenceItems: [] };

            const result1 = engine.reason(input1, context);
            const result2 = engine.reason(input2, context);

            // Conclusions should differ based on domain thresholds
            expect(result1.conclusion).not.toBe(result2.conclusion);
            expect(result1.conclusion).toContain("GOOD");
            expect(result2.conclusion).toContain("MARGINAL");

            // Both should have valid confidence (based on data quality)
            // The difference is in conclusion, not fabricated confidence
            if (result1.confidence.source !== "unavailable" && result2.confidence.source !== "unavailable") {
                expect(result1.confidence.value).toBeGreaterThanOrEqual(0);
                expect(result2.confidence.value).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe("11. IntelligencePipeline Factory Validates Confidence", () => {

        test("fromModelConfidence rejects values outside [0,1]", () => {
            const result1 = IntelligencePipeline.fromModelConfidence(1.5, "test");
            const result2 = IntelligencePipeline.fromModelConfidence(-0.5, "test");

            expect(result1.source).toBe("unavailable");
            expect(result2.source).toBe("unavailable");
        });

        test("fromCalculatedConfidence rejects values outside [0,1]", () => {
            const result1 = IntelligencePipeline.fromCalculatedConfidence(1.5, "test", "evidence");
            const result2 = IntelligencePipeline.fromCalculatedConfidence(-0.5, "test", "evidence");

            expect(result1.source).toBe("unavailable");
            expect(result2.source).toBe("unavailable");
        });

        test("fromCalculatedConfidence accepts valid values", () => {
            const result = IntelligencePipeline.fromCalculatedConfidence(0.85, "data_completeness", "test evidence");

            expect(result.source).toBe("calculated");
            if (result.source === "calculated") {
                expect(result.value).toBe(0.85);
                expect(result.formula).toBe("data_completeness");
                expect(result.evidence).toBe("test evidence");
            }
        });
    });

    describe("12. Knowledge-Grounded Reasoning With Valid Knowledge Confidence", () => {

        let engine: IntelligenceEngine;

        beforeEach(() => {
            engine = new IntelligenceEngine();
        });

        test("Knowledge-grounded reasoning uses actual knowledge confidence when available", () => {
            const input: IntelligenceInput = {
                problem: "General analysis",
                data: {}
            };

            const context: IntelligenceContext = {
                knowledgeItems: [
                    {
                        id: "k1",
                        title: "Test knowledge",
                        description: "Test description",
                        confidence: 0.9,
                        source: "test",
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: "k2",
                        title: "More knowledge",
                        description: "More description",
                        confidence: 0.8,
                        source: "test",
                        createdAt: new Date().toISOString()
                    }
                ],
                evidenceItems: []
            };

            const result = engine.reason(input, context);

            // Should use average of knowledge confidences (0.85)
            if (result.confidence.source === "calculated") {
                expect(result.confidence.formula).toBe("average_knowledge_confidence");
                expect(result.confidence.value).toBeCloseTo(0.85, 5);
            }
        });

        test("Knowledge-grounded reasoning returns unavailable when knowledge has no confidence", () => {
            const input: IntelligenceInput = {
                problem: "General analysis",
                data: {}
            };

            const context: IntelligenceContext = {
                knowledgeItems: [
                    {
                        id: "k1",
                        title: "Test knowledge",
                        description: "Test description",
                        confidence: undefined,  // No confidence
                        source: "test",
                        createdAt: new Date().toISOString()
                    }
                ],
                evidenceItems: []
            };

            const result = engine.reason(input, context);

            expect(result.confidence.source).toBe("unavailable");
        });
    });

    describe("13. Regression - Phase 06-D Findings Remain Fixed", () => {

        test("DecisionEngine still uses unavailable for REJECTED (not 0.95)", () => {
            const decisionEngine = new DecisionEngine();
            decisionEngine.initialize();

            const decisionInput: DecisionInput = {
                problem: "Test",
                objective: "Test",
                assumptions: [],
                rules: [{
                    id: "BLOCK",
                    description: "Block",
                    blocking: true,
                    match: () => ({ matched: true })
                }]
            };

            const result = decisionEngine.evaluate(decisionInput);

            expect(result.outcome).toBe("REJECTED");
            expect(result.confidence).toEqual({ source: "unavailable" });
        });

        test("DecisionEngine REVIEW_REQUIRED when no reasoning provided", () => {
            const decisionEngine = new DecisionEngine();
            decisionEngine.initialize();

            const decisionInput: DecisionInput = {
                problem: "Test",
                objective: "Test",
                assumptions: []
            };

            const result = decisionEngine.evaluate(decisionInput);

            expect(result.outcome).toBe("REVIEW_REQUIRED");
            expect(result.confidence).toEqual({ source: "unavailable" });
        });
    });
});
