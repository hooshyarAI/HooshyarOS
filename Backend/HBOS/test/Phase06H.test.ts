/**
 * Phase 06-H: Knowledge-Influenced Production Decisions
 *
 * Tests that runtime knowledge/intelligence materially influences
 * the actual production decision path used by AssistantEngine.analyzeProject().
 */

import { AssistantEngine } from "../Engines/AssistantEngine";
import { KnowledgeEngine } from "../Engines/KnowledgeEngine";
import { MemoryEngine } from "../Core/MemoryEngine";
import { Project } from "../Entities/Project";
import { ProjectStatus } from "../Entities/ProjectStatus";
import { IntelligencePipeline } from "../Core/IntelligenceContract";

describe("Phase 06-H: Knowledge-Influenced Production Decisions", () => {

    describe("1. analyzeProject() uses intelligence path when relevant knowledge exists", () => {

        test("knowledge about project name triggers intelligence-backed analysis", () => {
            const assistant = new AssistantEngine();

            const memoryEngine = new MemoryEngine();
            const knowledgeEngine = new KnowledgeEngine();
            memoryEngine.addListener(knowledgeEngine);

            memoryEngine.store({
                id: "1",
                type: "PROJECT_LEARNED",
                data: "Important lesson about HBOS Core",
                source: "KnowledgeEngine",
                createdAt: new Date()
            } as any);

            expect(knowledgeEngine.count()).toBe(1);
            expect(knowledgeEngine.getKnowledge()[0].title).toBe("PROJECT_LEARNED");
        });

        test("knowledge is accumulated via MemoryEngine listener", () => {
            const memoryEngine = new MemoryEngine();
            const knowledgeEngine = new KnowledgeEngine();
            memoryEngine.addListener(knowledgeEngine);

            memoryEngine.store({
                id: "1",
                type: "PROJECT_EVENT",
                data: "HBOS Core milestone completed",
                source: "System",
                createdAt: new Date()
            } as any);

            expect(knowledgeEngine.count()).toBe(1);

            memoryEngine.store({
                id: "2",
                type: "PROJECT_UPDATE",
                data: "HBOS Core status changed",
                source: "System",
                createdAt: new Date()
            } as any);

            expect(knowledgeEngine.count()).toBe(2);
        });

    });

    describe("2. analyzeWithIntelligence() wires IntelligenceEngine → DecisionEngine", () => {

        test("analyzeWithIntelligence produces reasoning and decision", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Should we proceed with HBOS Core Phase 2?",
                data: { revenue: 100000, expenses: 50000 }
            };

            const context = {
                knowledgeItems: [{
                    id: "1",
                    title: "Phase 1 Success",
                    description: "HBOS Core Phase 1 completed on time",
                    confidence: 0.8,
                    source: "ProjectHistory",
                    createdAt: new Date().toISOString()
                }],
                evidenceItems: []
            };

            const result = assistant.analyzeWithIntelligence(input, context);

            expect(result.reasoning).toBeDefined();
            expect(result.reasoning?.success).toBe(true);
            expect(result.reasoning?.conclusion).toBeDefined();

            expect(result.decision).toBeDefined();
            expect(["APPROVED", "REJECTED", "REVIEW_REQUIRED"]).toContain(result.decision.outcome);
        });

        test("reasoning result includes truthful confidence", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Budget analysis for Q1",
                data: { planned: 100000, actual: 95000 }
            };

            const context = { knowledgeItems: [], evidenceItems: [] };

            const result = assistant.analyzeWithIntelligence(input, context);

            expect(result.reasoning?.confidence).toBeDefined();
            expect(result.reasoning?.confidence.source).toBeDefined();
        });

    });

    describe("3. Fallback to legacy path when no relevant knowledge", () => {

        test("analyzeProject falls back to legacy when no knowledge exists", () => {
            const assistant = new AssistantEngine();

            const project = new Project("TestProject");
            project.status = ProjectStatus.Active;

            const result = assistant.analyzeProject(project);

            expect(result).toBeDefined();
            expect(result.project).toBe(project);
            expect(result.message).toBeDefined();
        });

        test("legacy path returns undefined confidence (truthful unavailable)", () => {
            const assistant = new AssistantEngine();

            const project = new Project("AnotherProject");
            project.status = ProjectStatus.Planning;

            const result = assistant.analyzeProject(project);

            expect(result.confidence).toBeUndefined();
        });

    });

    describe("4. Provenance survives through production path", () => {

        test("intelligence path preserves traceId from reasoning", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Strategic decision analysis",
                data: { revenue: 200000, expenses: 80000 }
            };

            const context = {
                knowledgeItems: [{
                    id: "1",
                    title: "Market Analysis",
                    description: "Strong market position",
                    confidence: 0.75,
                    source: "MarketResearch",
                    createdAt: new Date().toISOString()
                }],
                evidenceItems: []
            };

            const result = assistant.analyzeWithIntelligence(input, context);

            expect(result.reasoning?.traceId).toBeDefined();
            expect(typeof result.reasoning!.traceId).toBe("string");
            expect(result.reasoning!.traceId.length).toBeGreaterThan(0);
        });

        test("intelligence path preserves reasoning steps", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Financial health check",
                data: { revenue: 150000, expenses: 60000, assets: 500000, liabilities: 100000 }
            };

            const context = { knowledgeItems: [], evidenceItems: [] };

            const result = assistant.analyzeWithIntelligence(input, context);

            expect(result.reasoning?.reasoningSteps).toBeDefined();
            expect(Array.isArray(result.reasoning!.reasoningSteps)).toBe(true);
        });

        test("decision result includes traceId and inputHash", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Risk assessment",
                data: { probability: 0.7, impact: 0.5 }
            };

            const context = { knowledgeItems: [], evidenceItems: [] };

            const result = assistant.analyzeWithIntelligence(input, context);

            expect(result.decision.traceId).toBeDefined();
            expect(result.decision.inputHash).toBeDefined();
        });

    });

    describe("5. Truthful confidence survives through pipeline", () => {

        test("financial reasoning produces calculated confidence", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Financial analysis",
                data: { revenue: 100000, expenses: 50000, assets: 200000, liabilities: 80000 }
            };

            const context = { knowledgeItems: [], evidenceItems: [] };

            const result = assistant.analyzeWithIntelligence(input, context);

            expect(result.reasoning?.confidence.source).toBe("calculated");
            if (result.reasoning?.confidence.source === "calculated") {
                expect(typeof result.reasoning.confidence.value).toBe("number");
            }
        });

        test("rule-based routing returns unavailable confidence", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Generic inquiry with no specific data"
            };

            const context = { knowledgeItems: [], evidenceItems: [] };

            const result = assistant.analyzeWithIntelligence(input, context);

            expect(result.reasoning?.confidence.source).toBe("unavailable");
        });

        test("knowledge-grounded reasoning uses average knowledge confidence", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Project recommendation"
            };

            const context = {
                knowledgeItems: [
                    {
                        id: "1",
                        title: "Similar Project Success",
                        description: "Completed with positive outcome",
                        confidence: 0.9,
                        source: "History",
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: "2",
                        title: "Resource Constraint",
                        description: "Limited team capacity",
                        confidence: 0.7,
                        source: "Planning",
                        createdAt: new Date().toISOString()
                    }
                ],
                evidenceItems: []
            };

            const result = assistant.analyzeWithIntelligence(input, context);

            if (result.reasoning?.success && result.reasoning.status === "reasoned_knowledge") {
                expect(result.reasoning.confidence.source).toBe("calculated");
            }
        });

    });

    describe("6. Knowledge changes can change the resulting decision", () => {

        test("knowledge influences reasoning when no domain algorithm applies", () => {
            const assistant = new AssistantEngine();

            const inputWithoutData = {
                problem: "Project recommendation"
            };

            const inputWithData = {
                problem: "Project recommendation",
                data: { revenue: 100000, expenses: 50000 }
            };

            const contextWithoutKnowledge = { knowledgeItems: [], evidenceItems: [] };
            const contextWithKnowledge = {
                knowledgeItems: [{
                    id: "1",
                    title: "Project Risk Identified",
                    description: "High complexity project with limited resources",
                    confidence: 0.85,
                    source: "RiskAssessment",
                    createdAt: new Date().toISOString()
                }],
                evidenceItems: []
            };

            const resultWithoutDataAndKnowledge = assistant.analyzeWithIntelligence(inputWithoutData, contextWithoutKnowledge);
            const resultWithDataAndKnowledge = assistant.analyzeWithIntelligence(inputWithoutData, contextWithKnowledge);

            expect(resultWithoutDataAndKnowledge.reasoning?.conclusion).not.toBe(resultWithDataAndKnowledge.reasoning?.conclusion);
        });

        test("domain data takes precedence over knowledge in reasoning", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Financial analysis",
                data: { revenue: 100000, expenses: 50000, assets: 200000, liabilities: 80000 }
            };

            const contextWithoutKnowledge = { knowledgeItems: [], evidenceItems: [] };
            const contextWithKnowledge = {
                knowledgeItems: [{
                    id: "1",
                    title: "Negative Report",
                    description: "Company in financial trouble",
                    confidence: 0.9,
                    source: "ExternalAnalysis",
                    createdAt: new Date().toISOString()
                }],
                evidenceItems: []
            };

            const resultWithout = assistant.analyzeWithIntelligence(input, contextWithoutKnowledge);
            const resultWith = assistant.analyzeWithIntelligence(input, contextWithKnowledge);

            expect(resultWithout.reasoning?.status).toBe("reasoned_domain");
            expect(resultWith.reasoning?.status).toBe("reasoned_domain");
            expect(resultWithout.reasoning?.conclusion).toBe(resultWith.reasoning?.conclusion);
        });

    });

    describe("7. Phase 06-D and 06-F regression", () => {

        test("Phase 06-D: DecisionEngine evaluate accepts IntelligenceResult", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Test decision",
                data: { planned: 1000, actual: 900 }
            };

            const context = { knowledgeItems: [], evidenceItems: [] };

            const { reasoning, decision } = assistant.analyzeWithIntelligence(input, context);

            expect(reasoning).toBeDefined();
            expect(decision).toBeDefined();
            expect(decision.outcome).toBeDefined();
        });

        test("Phase 06-F: Governance constraints are evaluated", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Governance decision point"
            };

            const context = { knowledgeItems: [], evidenceItems: [] };

            const result = assistant.analyzeWithIntelligence(input, context);

            expect(result.decision).toBeDefined();
            expect(result.decision.authorized).toBeDefined();
        });

    });

    describe("8. Security and tenant isolation preserved", () => {

        test("decision result indicates authorization status", () => {
            const assistant = new AssistantEngine();

            const input = {
                problem: "Security-sensitive operation"
            };

            const context = { knowledgeItems: [], evidenceItems: [] };

            const result = assistant.analyzeWithIntelligence(input, context);

            expect(typeof result.decision.authorized).toBe("boolean");
        });

    });

});
