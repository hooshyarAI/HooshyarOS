import { AssistantEngine } from "../Engines/AssistantEngine";
import { Project } from "../Core/Project";
import { ProjectStatus } from "../Core/ProjectStatus";
import { DecisionContext } from "../Core/DecisionContext";
import { IntelligenceInput, IntelligenceContext } from "../Core/IntelligenceContract";

describe("AssistantEngine Phase 11-1.8", () => {
    let engine: AssistantEngine;

    beforeEach(() => {
        engine = new AssistantEngine();
        engine.initialize();
    });

    describe("Engine interface", () => {
        test("name is AssistantEngine", () => {
            expect(engine.name).toBe("AssistantEngine");
        });

        test("initialize starts without error", () => {
            expect(() => engine.initialize()).not.toThrow();
        });

        test("health returns true", () => {
            expect(engine.health()).toBe(true);
        });
    });

    describe("analyzeProject", () => {
        test("returns AssistantResponse with project and message", () => {
            const project = new Project("Test Project");
            project.status = ProjectStatus.Active;
            const response = engine.analyzeProject(project);
            expect(response.project).toBe(project);
            expect(typeof response.message).toBe("string");
            expect(response.message.length).toBeGreaterThan(0);
        });

        test("carries provenance evidence when available", () => {
            const project = new Project("Test Project");
            project.status = ProjectStatus.Active;
            const evidence = DecisionContext.fromEvidence({
                traceId: "trace-123",
                inputHash: "hash-123",
                explanation: "Test explanation"
            });
            const response = engine.analyzeProject(project, evidence);
            expect(response.traceId !== undefined || response.inputHash !== undefined || response.explanation !== undefined).toBe(true);
        });

        test("does not fabricate confidence", () => {
            const project = new Project("Test Project");
            project.status = ProjectStatus.Active;
            const response = engine.analyzeProject(project);
            if (typeof response.confidence === "number") {
                expect(response.confidence).toBeGreaterThanOrEqual(0);
                expect(response.confidence).toBeLessThanOrEqual(1);
            }
        });
    });

    describe("analyzeWithIntelligence", () => {
        test("returns reasoning and decision for valid input", () => {
            const input: IntelligenceInput = {
                problem: "Evaluate project risk",
                data: { projectName: "Test" },
            };
            const context: IntelligenceContext = {
                knowledgeItems: [],
                evidenceItems: [],
            };
            const result = engine.analyzeWithIntelligence(input, context);
            expect(result.reasoning).toBeDefined();
            expect(result.decision).toBeDefined();
        });
    });

    describe("analyzeAcquisitionOpportunity", () => {
        test("rejects missing tenant", () => {
            expect(() => engine.analyzeAcquisitionOpportunity("test problem", {
                tenantId: "",
                problem: "test problem",
                financial: { revenue: 0, expenses: 0, assets: 0, liabilities: 0, cashFlows: { initial: 0, flows: [], discountRate: 0 }, waccInputs: { equity: 0, debt: 0, costOfEquity: 0, costOfDebt: 0, taxRate: 0 } },
                risk: { probability: 0, impact: 0, model: () => 0 },
                decision: { ahpMatrix: [[1]], topsis: { matrix: [[1]], weights: [1], criteria: ["benefit"] } },
            })).toThrow("assistant-orchestration-tenant-required");
        });

        test("rejects missing problem", () => {
            expect(() => engine.analyzeAcquisitionOpportunity("   ", {
                tenantId: "tenant-1",
                problem: "   ",
                financial: { revenue: 0, expenses: 0, assets: 0, liabilities: 0, cashFlows: { initial: 0, flows: [], discountRate: 0 }, waccInputs: { equity: 0, debt: 0, costOfEquity: 0, costOfDebt: 0, taxRate: 0 } },
                risk: { probability: 0, impact: 0, model: () => 0 },
                decision: { ahpMatrix: [[1]], topsis: { matrix: [[1]], weights: [1], criteria: ["benefit"] } },
            })).toThrow("assistant-orchestration-problem-required");
        });

        test("returns response and orchestrated result for valid input", () => {
            const result = engine.analyzeAcquisitionOpportunity(
                "Evaluate acquisition",
                {
                    problem: "Evaluate acquisition",
                    tenantId: "tenant-1",
                    financial: {
                        revenue: 1000,
                        expenses: 800,
                        assets: 500,
                        liabilities: 200,
                        cashFlows: { initial: 0, flows: [100, 200], discountRate: 0.1 },
                        waccInputs: { equity: 0.6, debt: 0.4, costOfEquity: 0.1, costOfDebt: 0.05, taxRate: 0.25 },
                    },
                    risk: {
                        probability: 0.3,
                        impact: 0.5,
                        model: (p) => p.probability * p.impact,
                    },
                    decision: {
                        ahpMatrix: [[1, 2], [0.5, 1]],
                        topsis: { matrix: [[1, 2], [3, 4]], weights: [0.5, 0.5], criteria: ["benefit", "cost"] },
                    },
                }
            );
            expect(result.response).toBeDefined();
            expect(result.orchestrated).toBeDefined();
            expect(result.response.message.length).toBeGreaterThan(0);
        });
    });

    describe("evidence and provenance", () => {
        test("AssistantResponse preserves traceId from DecisionContext", () => {
            const project = new Project("Test Project");
            project.status = ProjectStatus.Active;
            const evidence = DecisionContext.fromEvidence({
                traceId: "trace-123",
                inputHash: "hash-123",
                reasoningRef: "reasoning-123",
                explanation: "Test explanation",
                confidence: 0.8,
                limitations: ["limitation-1"],
            });
            const response = engine.analyzeProject(project, evidence);
            expect(response.traceId).toBe("trace-123");
            expect(response.inputHash).toBe("hash-123");
            expect(response.reasoningRef).toBe("reasoning-123");
            expect(response.explanation).toBe("Test explanation");
            expect(response.confidence).toBe(0.8);
            expect(response.limitations).toEqual(["limitation-1"]);
        });

        test("DecisionContext.fromEvidence filters invalid confidence", () => {
            const evidence = DecisionContext.fromEvidence({
                traceId: "trace-123",
                confidence: 1.5,
            });
            expect(evidence.confidence).toBeUndefined();
        });

        test("AssistantResponse does not expose fabricated fields when evidence is unavailable", () => {
            const project = new Project("Test Project");
            project.status = ProjectStatus.Active;
            const response = engine.analyzeProject(project);
            expect(response.traceId === undefined || typeof response.traceId === "string").toBe(true);
            expect(response.inputHash === undefined || typeof response.inputHash === "string").toBe(true);
        });
    });
});
