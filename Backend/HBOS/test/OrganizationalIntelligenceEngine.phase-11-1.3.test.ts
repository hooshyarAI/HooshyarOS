jest.mock("../Engines/ReasoningEngine", () => {
    const MockReasoningEngine = jest.fn().mockImplementation(() => ({
        name: "ReasoningEngine",
        initialize: jest.fn(),
        health: jest.fn(() => true),
        reason: jest.fn()
    }));
    return { ReasoningEngine: MockReasoningEngine };
});

import { OrganizationalIntelligenceEngine, OrganizationalDiagnosis, ProcessAnalysis, Bottleneck, ImprovementRecommendation, LearningRecord, ProcessMetrics } from "../Engines/OrganizationalIntelligenceEngine";
import { ReasoningEngine } from "../Engines/ReasoningEngine";

describe("OrganizationalIntelligenceEngine Phase 11-1.3", () => {
    let engine: OrganizationalIntelligenceEngine;
    let mockReasoning: any;

    beforeEach(() => {
        engine = new OrganizationalIntelligenceEngine();
        engine.initialize();
        mockReasoning = (engine as any).reasoning;
        mockReasoning.reason.mockClear();
    });

    describe("assess regression", () => {
        it("owns the canonical organizational intelligence boundary", () => {
            expect(engine.name).toBe("OrganizationalIntelligenceEngine");
            expect(engine.health()).toBe(true);
            expect(engine.assess().status).toBe("READY");
        });
    });

    describe("diagnose", () => {
        it("returns structured diagnosis with provenance when reasoning succeeds", () => {
            mockReasoning.reason.mockReturnValue({
                problem: "Diagnose organizational issues in scope: sales. Evidence: {}",
                status: "completed",
                success: true,
                answer: "Root cause: delay in approval workflow affecting decision making",
                provenance: {
                    traceId: "TRACE-REASONING-1",
                    inputHash: "hash-input",
                    outputHash: "hash-output",
                    timestamp: new Date().toISOString(),
                    verificationStatus: "VERIFIED",
                    sourceRef: "python-ai-runtime",
                    transformationRef: "python-ai-runtime",
                    reasoningSteps: ["step1", "step2"]
                }
            });

            const result = engine.diagnose("sales", { delay: true, approval: true });

            expect(result.scope).toBe("sales");
            expect(result.status).toBe("READY");
            expect(result.rootCauses).toContain("Process delay detected");
            expect(result.affectedProcesses).toContain("Approval workflow");
            expect(result.recommendations.length).toBeGreaterThan(0);
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.provenance.inputHash).toBeDefined();
            expect(result.provenance.outputHash).toBeDefined();
            expect(result.provenance.verificationStatus).toBe("VERIFIED");
            expect(result.provenance.sourceRef).toBeDefined();
            expect(result.provenance.reasoningSteps.length).toBeGreaterThan(0);
        });

        it("returns BLOCKED for empty scope", () => {
            const result = engine.diagnose("");

            expect(result.status).toBe("BLOCKED");
            expect(result.rootCauses).toContain("Empty scope provided");
            expect(result.provenance.verificationStatus).toBe("FAILED");
        });

        it("returns NEEDS_DATA for missing evidence", () => {
            const result = engine.diagnose("engineering");

            expect(result.status).toBe("NEEDS_DATA");
            expect(result.rootCauses).toContain("No evidence provided for causal analysis");
            expect(result.provenance.verificationStatus).toBe("PENDING");
        });

        it("falls back to inference when reasoning fails", () => {
            mockReasoning.reason.mockReturnValue({
                problem: "Diagnose organizational issues in scope: ops. Evidence: {}",
                status: "reasoning_failed",
                success: false,
                provenance: {
                    traceId: "TRACE-FAIL",
                    inputHash: "hash-fail",
                    timestamp: new Date().toISOString(),
                    verificationStatus: "FAILED",
                    sourceRef: "unavailable",
                    reasoningSteps: ["unavailable"]
                }
            });

            const result = engine.diagnose("ops", { resource: true });

            expect(result.status).toBe("NEEDS_DATA");
            expect(result.rootCauses).toContain("Resource constraint indicated in evidence");
            expect(result.affectedProcesses).toContain("General organizational processes");
            expect(result.provenance.verificationStatus).toBe("PENDING");
        });

        it("produces unique traceId per invocation", () => {
            const r1 = engine.diagnose("sales", { delay: true });
            const r2 = engine.diagnose("ops", { resource: true });

            expect(r1.provenance.traceId).not.toBe(r2.provenance.traceId);
        });
    });

    describe("analyzeProcesses", () => {
        it("returns process analysis with provenance from MemoryEngine events", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("PROJECT_CREATED", "data", "sales-process"));
            memory.store(new MemoryEvent("PROJECT_UPDATED", "data", "sales-process"));

            const result = engine.analyzeProcesses("sales");

            expect(result.scope).toBe("sales");
            expect(result.processes).toContain("sales-process");
            expect(result.cycleTimes["sales-process"]).toBe(2);
            expect(result.throughput["sales-process"]).toBe(2);
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.provenance.inputHash).toBeDefined();
            expect(result.provenance.outputHash).toBeDefined();
            expect(result.provenance.verificationStatus).toBe("VERIFIED");
        });

        it("returns PENDING when no events match scope", () => {
            const result = engine.analyzeProcesses("nonexistent-scope");

            expect(result.processes).toHaveLength(0);
            expect(result.provenance.verificationStatus).toBe("PENDING");
        });
    });

    describe("detectBottlenecks", () => {
        it("identifies bottlenecks with evidence from high event volume", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            for (let i = 0; i < 25; i++) {
                memory.store(new MemoryEvent("EVENT", "data", "slow-process"));
            }

            const result = engine.detectBottlenecks("slow");

            expect(result.length).toBeGreaterThan(0);
            const delayBottleneck = result.find((b: Bottleneck) => b.process === "slow-process");
            expect(delayBottleneck).toBeDefined();
            expect(delayBottleneck!.type).toBe("DELAY");
            expect(delayBottleneck!.severity).toBe("CRITICAL");
            expect(delayBottleneck!.evidence.length).toBeGreaterThan(0);
            expect(delayBottleneck!.provenance.traceId).toMatch(/^TRACE-/);
            expect(delayBottleneck!.provenance.verificationStatus).toBe("VERIFIED");
        });

        it("identifies duplication bottlenecks", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            for (let i = 0; i < 8; i++) {
                memory.store(new MemoryEvent("EVENT", "data", "dup-source"));
            }

            const result = engine.detectBottlenecks("dup");

            expect(result.length).toBeGreaterThan(0);
            const dupBottleneck = result.find((b: Bottleneck) => b.process === "dup-source" && b.type === "DUPLICATION");
            expect(dupBottleneck).toBeDefined();
            expect(dupBottleneck!.evidence[0]).toContain("8 events");
        });

        it("returns result for empty scope with FAILED status", () => {
            const result = engine.detectBottlenecks("");

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].process).toBe("unknown");
            expect(result[0].provenance.verificationStatus).toBe("FAILED");
        });

        it("returns LOW severity when no bottlenecks detected", () => {
            const result = engine.detectBottlenecks("no-events-here");

            expect(result.length).toBe(1);
            expect(result[0].severity).toBe("LOW");
            expect(result[0].provenance.verificationStatus).toBe("PENDING");
        });
    });

    describe("recommendImprovements", () => {
        it("generates candidates with expected ROI from detected bottlenecks", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            for (let i = 0; i < 25; i++) {
                memory.store(new MemoryEvent("EVENT", "data", "critical-process"));
            }

            const result = engine.recommendImprovements("critical");

            expect(result.length).toBeGreaterThan(0);
            const rec = result[0];
            expect(rec.id).toMatch(/^REC-/);
            expect(rec.expectedTimeSaving).toBeGreaterThan(0);
            expect(rec.expectedCostImpact).toBeLessThan(0);
            expect(rec.expectedCapacityRelease).toBeGreaterThan(0);
            expect(typeof rec.automationCandidate).toBe("boolean");
            expect(rec.confidence).toBeGreaterThan(0);
            expect(rec.provenance.traceId).toMatch(/^TRACE-/);
            expect(rec.provenance.verificationStatus).toBe("VERIFIED");
        });

        it("returns result for empty scope with FAILED status", () => {
            const result = engine.recommendImprovements("");

            expect(result.length).toBe(1);
            expect(result[0].id).toBe("REC-EMPTY");
            expect(result[0].expectedTimeSaving).toBe(0);
            expect(result[0].provenance.verificationStatus).toBe("FAILED");
        });

        it("maps bottleneck types to recommendation types", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            for (let i = 0; i < 8; i++) {
                memory.store(new MemoryEvent("EVENT", "data", "dup-proc"));
            }

            const result = engine.recommendImprovements("dup-proc");
            const automationRec = result.find((r: ImprovementRecommendation) => r.type === "AUTOMATION");
            expect(automationRec).toBeDefined();
            expect(automationRec!.automationCandidate).toBe(true);
        });
    });

    describe("learnFromExecution", () => {
        it("measures before/after with actual vs expected distinction", () => {
            const before: ProcessMetrics = { cycleTime: 100, throughput: 50, errorRate: 0.2, capacity: 80, cost: 1000 };
            const after: ProcessMetrics = { cycleTime: 70, throughput: 60, errorRate: 0.1, capacity: 90, cost: 800 };

            const result = engine.learnFromExecution(before, after);

            expect(result.metrics.before).toBe(before);
            expect(result.metrics.after).toBe(after);
            expect(result.timeSaved).toBe(30);
            expect(result.cycleTimeReduced).toBe(30);
            expect(result.errorRateReduced).toBe(0.1);
            expect(result.throughputIncreased).toBe(10);
            expect(result.operatingCostReduced).toBe(200);
            expect(result.capacityCreated).toBe(10);
            expect(result.actualFinancialValue).toBeGreaterThan(0);
            expect(result.actualROI).toBeGreaterThan(0);
            expect(result.sustainability).toBe("SUSTAINABLE");
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.provenance.verificationStatus).toBe("VERIFIED");
        });

        it("returns NOT_SUSTAINABLE when no improvement observed", () => {
            const before: ProcessMetrics = { cycleTime: 50, throughput: 50, errorRate: 0.1, capacity: 80, cost: 1000 };
            const after: ProcessMetrics = { cycleTime: 50, throughput: 50, errorRate: 0.1, capacity: 80, cost: 1000 };

            const result = engine.learnFromExecution(before, after);

            expect(result.timeSaved).toBe(0);
            expect(result.actualFinancialValue).toBe(0);
            expect(result.actualROI).toBe(0);
            expect(result.sustainability).toBe("NOT_SUSTAINABLE");
        });

        it("returns PARTIAL when only some metrics improved", () => {
            const before: ProcessMetrics = { cycleTime: 100, throughput: 50, errorRate: 0.2, capacity: 80, cost: 1000 };
            const after: ProcessMetrics = { cycleTime: 80, throughput: 50, errorRate: 0.2, capacity: 80, cost: 1000 };

            const result = engine.learnFromExecution(before, after);

            expect(result.cycleTimeReduced).toBe(20);
            expect(result.actualFinancialValue).toBe(100);
            expect(result.sustainability).toBe("PARTIAL");
        });

        it("computes decisionLatencyReduced and riskReduced from cycleTimeReduced and errorRateReduced", () => {
            const before: ProcessMetrics = { cycleTime: 100, throughput: 50, errorRate: 0.2, capacity: 80, cost: 1000 };
            const after: ProcessMetrics = { cycleTime: 60, throughput: 60, errorRate: 0.1, capacity: 90, cost: 800 };

            const result = engine.learnFromExecution(before, after);

            expect(result.decisionLatencyReduced).toBeCloseTo(12, 5);
            expect(result.qualityImproved).toBeCloseTo(0.1, 5);
            expect(result.riskReduced).toBeCloseTo(0.05, 5);
        });
    });

    describe("Provenance chain completeness", () => {
        it("diagnose produces complete provenance chain", () => {
            const result = engine.diagnose("scope", { key: "value" });
            const p = result.provenance;

            expect(p.traceId).toMatch(/^TRACE-/);
            expect(p.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(p.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(["VERIFIED", "PENDING", "FAILED"]).toContain(p.verificationStatus);
            expect(typeof p.sourceRef).toBe("string");
            expect(Array.isArray(p.reasoningSteps)).toBe(true);
        });

        it("learnFromExecution produces complete provenance chain", () => {
            const result = engine.learnFromExecution(
                { cycleTime: 100, throughput: 50, errorRate: 0.2, capacity: 80, cost: 1000 },
                { cycleTime: 70, throughput: 60, errorRate: 0.1, capacity: 90, cost: 800 }
            );
            const p = result.provenance;

            expect(p.traceId).toMatch(/^TRACE-/);
            expect(p.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(p.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(["VERIFIED", "PENDING", "FAILED"]).toContain(p.verificationStatus);
            expect(typeof p.sourceRef).toBe("string");
            expect(Array.isArray(p.reasoningSteps)).toBe(true);
        });
    });

    describe("Expected vs actual impact distinction", () => {
        it("recommendImprovements returns expected impact fields", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            for (let i = 0; i < 25; i++) {
                memory.store(new MemoryEvent("EVENT", "data", "proc"));
            }

            const recs = engine.recommendImprovements("proc");
            const rec = recs[0];

            expect(rec.expectedTimeSaving).toBeGreaterThanOrEqual(0);
            expect(rec.expectedCostImpact).toBeLessThanOrEqual(0);
            expect(rec.expectedCapacityRelease).toBeGreaterThanOrEqual(0);
            expect(rec.confidence).toBeGreaterThanOrEqual(0);
            expect(rec.confidence).toBeLessThanOrEqual(1);
        });

        it("learnFromExecution returns actual measured impact fields", () => {
            const before: ProcessMetrics = { cycleTime: 100, throughput: 50, errorRate: 0.2, capacity: 80, cost: 1000 };
            const after: ProcessMetrics = { cycleTime: 70, throughput: 60, errorRate: 0.1, capacity: 90, cost: 800 };

            const result = engine.learnFromExecution(before, after);

            expect(result.timeSaved).toBe(before.cycleTime - after.cycleTime);
            expect(result.operatingCostReduced).toBe(before.cost - after.cost);
            expect(result.actualFinancialValue).toBe(result.operatingCostReduced + result.laborCapacityReleased * 100);
        });
    });

    describe("Integration with composed engines", () => {
        it("composes ReasoningEngine, MemoryEngine, KnowledgeEngine, ProjectPilotEngine", () => {
            expect((engine as any).reasoning).toBeDefined();
            expect((engine as any).memory).toBeDefined();
            expect((engine as any).knowledge).toBeDefined();
            expect((engine as any).projects).toBeDefined();
        });

        it("diagnose invokes ReasoningEngine.reason with constructed problem", () => {
            mockReasoning.reason.mockReturnValue({
                problem: "",
                status: "completed",
                success: true,
                answer: "Analysis complete"
            });

            engine.diagnose("sales", { delay: true });

            expect(mockReasoning.reason).toHaveBeenCalledTimes(1);
            const calledWith = mockReasoning.reason.mock.calls[0][0];
            expect(calledWith).toContain("sales");
            expect(calledWith).toContain("delay");
        });

        it("analyzeProcesses reads from MemoryEngine.retrieve", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("TYPE", "data", "proc-A"));

            const result = engine.analyzeProcesses("proc-A");

            expect(result.processes).toContain("proc-A");
        });
    });
});



