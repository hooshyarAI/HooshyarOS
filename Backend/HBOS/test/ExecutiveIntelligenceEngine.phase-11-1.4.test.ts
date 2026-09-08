import { ExecutiveIntelligenceEngine, StrategicGoal, ActualMetrics, ExpectedMetrics, GrowthDimension, ImpactComparison, StrategicAlignment, DashboardPrimitives, KPIHistory, BalancedGrowthReport } from "../Engines/ExecutiveIntelligenceEngine";
import { MemoryEvent } from "../Entities/MemoryEvent";

describe("ExecutiveIntelligenceEngine Phase 11-1.4 — Strategic Evaluation & Dashboard Primitives", () => {
    let engine: ExecutiveIntelligenceEngine;

    beforeEach(() => {
        engine = new ExecutiveIntelligenceEngine();
        engine.initialize();
    });

    describe("Engine interface compliance", () => {
        it("has name = ExecutiveIntelligenceEngine", () => {
            expect(engine.name).toBe("ExecutiveIntelligenceEngine");
        });

        it("implements initialize()", () => {
            expect(() => engine.initialize()).not.toThrow();
        });

        it("implements health() returning boolean", () => {
            expect(typeof engine.health()).toBe("boolean");
        });
    });

    describe("evaluateStrategicAlignment", () => {
        it("computes alignment score from goals and actuals", () => {
            const goals: StrategicGoal[] = [
                { id: "G1", name: "Revenue", target: 100, weight: 0.5, category: "financial" },
                { id: "G2", name: "Efficiency", target: 80, weight: 0.5, category: "operational" }
            ];
            const actuals: ActualMetrics[] = [
                { goalId: "G1", actual: 90, timestamp: "2024-01-01T00:00:00Z", source: "test" },
                { goalId: "G2", actual: 80, timestamp: "2024-01-01T00:00:00Z", source: "test" }
            ];

            const result = engine.evaluateStrategicAlignment(goals, actuals);

            expect(result.alignmentScore).toBeCloseTo(95, 1);
            expect(result.gaps).toHaveLength(2);
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.provenance.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.provenance.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.provenance.verificationStatus).toBe("VERIFIED");
            expect(result.provenance.sourceRef).toBe("ExecutiveIntelligenceEngine");
            expect(result.provenance.reasoningSteps.length).toBeGreaterThan(0);
        });

        it("returns zero alignment score for empty goals", () => {
            const result = engine.evaluateStrategicAlignment([], []);

            expect(result.alignmentScore).toBe(0);
            expect(result.gaps).toHaveLength(0);
            expect(result.criticalDivergences).toHaveLength(0);
            expect(result.recommendations.length).toBeGreaterThan(0);
        });

        it("identifies critical divergences for low achievement", () => {
            const goals: StrategicGoal[] = [
                { id: "G1", name: "Revenue", target: 100, weight: 1, category: "financial" }
            ];
            const actuals: ActualMetrics[] = [
                { goalId: "G1", actual: 30, timestamp: "2024-01-01T00:00:00Z", source: "test" }
            ];

            const result = engine.evaluateStrategicAlignment(goals, actuals);

            expect(result.criticalDivergences.length).toBeGreaterThan(0);
            expect(result.criticalDivergences[0].severity).toBe("HIGH");
            expect(result.recommendations.some(r => r.includes("critical divergence"))).toBe(true);
        });

        it("returns MEDIUM severity for mid-range achievement", () => {
            const goals: StrategicGoal[] = [
                { id: "G1", name: "Revenue", target: 100, weight: 1, category: "financial" }
            ];
            const actuals: ActualMetrics[] = [
                { goalId: "G1", actual: 65, timestamp: "2024-01-01T00:00:00Z", source: "test" }
            ];

            const result = engine.evaluateStrategicAlignment(goals, actuals);

            expect(result.criticalDivergences[0].severity).toBe("MEDIUM");
        });

        it("handles missing actuals with zero default", () => {
            const goals: StrategicGoal[] = [
                { id: "G1", name: "Revenue", target: 100, weight: 1, category: "financial" }
            ];
            const actuals: ActualMetrics[] = [];

            const result = engine.evaluateStrategicAlignment(goals, actuals);

            expect(result.gaps[0].actual).toBe(0);
            expect(result.gaps[0].gap).toBe(-100);
        });

        it("produces unique traceId per invocation", () => {
            const goals: StrategicGoal[] = [{ id: "G1", name: "Revenue", target: 100, weight: 1, category: "financial" }];
            const actuals: ActualMetrics[] = [{ goalId: "G1", actual: 90, timestamp: "2024-01-01T00:00:00Z", source: "test" }];

            const r1 = engine.evaluateStrategicAlignment(goals, actuals);
            const r2 = engine.evaluateStrategicAlignment(goals, actuals);

            expect(r1.provenance.traceId).not.toBe(r2.provenance.traceId);
        });
    });

    describe("generateDashboardPrimitives", () => {
        it("returns complete dashboard primitives with provenance", () => {
            const result = engine.generateDashboardPrimitives("tenant-1");

            expect(result.kpis.length).toBeGreaterThan(0);
            expect(result.trends.length).toBeGreaterThan(0);
            expect(result.alerts.length).toBeGreaterThan(0);
            expect(result.strategicAlignment).toBeDefined();
            expect(result.balancedGrowthIndicators).toBeDefined();
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.provenance.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.provenance.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.provenance.verificationStatus).toBe("VERIFIED");
            expect(result.provenance.reasoningSteps.length).toBeGreaterThan(0);
        });

        it("computes KPIs from empty memory with defaults", () => {
            const result = engine.generateDashboardPrimitives("tenant-empty");

            expect(result.kpis.length).toBeGreaterThanOrEqual(2);
            expect(result.kpis[0].name).toBeDefined();
            expect(typeof result.kpis[0].actual).toBe("number");
        });

        it("includes strategic alignment from goals vs actuals", () => {
            const result = engine.generateDashboardPrimitives("tenant-1");

            expect(result.strategicAlignment.alignmentScore).toBeGreaterThanOrEqual(0);
            expect(result.strategicAlignment.alignmentScore).toBeLessThanOrEqual(100);
        });

        it("includes balanced growth indicators for all 10 dimensions", () => {
            const result = engine.generateDashboardPrimitives("tenant-1");

            expect(result.balancedGrowthIndicators.dimensions).toHaveLength(10);
            expect(result.balancedGrowthIndicators.overallBalance).toBeGreaterThanOrEqual(0);
            expect(result.balancedGrowthIndicators.overallBalance).toBeLessThanOrEqual(100);
        });

        it("filters memory events by tenantId", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("KPI_Revenue", JSON.stringify({ actual: 150, target: 100 }), "sales", "tenant-1"));
            memory.store(new MemoryEvent("KPI_Revenue", JSON.stringify({ actual: 120, target: 100 }), "sales", "tenant-2"));

            const result = engine.generateDashboardPrimitives("tenant-1");

            expect(result.kpis.find((k: any) => k.name === "Revenue")?.actual).toBe(150);
        });
    });

    describe("trackKPIHistory", () => {
        it("returns KPI history with data points from memory", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("Revenue", "100", "finance"));
            memory.store(new MemoryEvent("Revenue", "110", "finance"));
            memory.store(new MemoryEvent("Revenue", "120", "finance"));

            const result = engine.trackKPIHistory("Revenue");

            expect(result.kpiId).toBe("Revenue");
            expect(result.dataPoints).toHaveLength(3);
            expect(result.trend).toBe("UP");
            expect(typeof result.forecast).toBe("number");
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.provenance.verificationStatus).toBe("VERIFIED");
        });

        it("returns DOWN trend for decreasing values", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("Efficiency", "100", "ops"));
            memory.store(new MemoryEvent("Efficiency", "90", "ops"));

            const result = engine.trackKPIHistory("Efficiency");

            expect(result.trend).toBe("DOWN");
        });

        it("returns STABLE trend for unchanged values", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("Quality", "50", "qa"));
            memory.store(new MemoryEvent("Quality", "50", "qa"));

            const result = engine.trackKPIHistory("Quality");

            expect(result.trend).toBe("STABLE");
        });

        it("returns PENDING status when no data points found", () => {
            const result = engine.trackKPIHistory("UnknownKPI");

            expect(result.dataPoints).toHaveLength(0);
            expect(result.forecast).toBeNull();
            expect(result.provenance.verificationStatus).toBe("PENDING");
        });

        it("respects limit parameter", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            for (let i = 0; i < 10; i++) {
                memory.store(new MemoryEvent("Metric", String(i), "src"));
            }

            const result = engine.trackKPIHistory("Metric", 3);

            expect(result.dataPoints).toHaveLength(3);
        });

        it("produces unique traceId per invocation", () => {
            const r1 = engine.trackKPIHistory("KPI1");
            const r2 = engine.trackKPIHistory("KPI2");

            expect(r1.provenance.traceId).not.toBe(r2.provenance.traceId);
        });
    });

    describe("compareExpectedVsActual", () => {
        it("computes variance and variancePercent correctly", () => {
            const expected: ExpectedMetrics = { metric: "Revenue", expected: 100, period: "Q1" };
            const actual: ActualMetrics = { goalId: "G1", actual: 120, timestamp: "2024-01-01T00:00:00Z", source: "test" };

            const result = engine.compareExpectedVsActual(expected, actual);

            expect(result.metric).toBe("Revenue");
            expect(result.expected).toBe(100);
            expect(result.actual).toBe(120);
            expect(result.variance).toBe(20);
            expect(result.variancePercent).toBe(20);
            expect(result.isExpectedMet).toBe(true);
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.provenance.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.provenance.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.provenance.verificationStatus).toBe("VERIFIED");
        });

        it("returns negative variance when actual is below expected", () => {
            const expected: ExpectedMetrics = { metric: "Cost", expected: 1000, period: "Q1" };
            const actual: ActualMetrics = { goalId: "G1", actual: 800, timestamp: "2024-01-01T00:00:00Z", source: "test" };

            const result = engine.compareExpectedVsActual(expected, actual);

            expect(result.variance).toBe(-200);
            expect(result.variancePercent).toBe(-20);
            expect(result.isExpectedMet).toBe(false);
        });

        it("handles zero expected without division by zero", () => {
            const expected: ExpectedMetrics = { metric: "Metric", expected: 0, period: "Q1" };
            const actual: ActualMetrics = { goalId: "G1", actual: 50, timestamp: "2024-01-01T00:00:00Z", source: "test" };

            const result = engine.compareExpectedVsActual(expected, actual);

            expect(result.variance).toBe(50);
            expect(isFinite(result.variancePercent)).toBe(true);
            expect(result.isExpectedMet).toBe(true);
        });

        it("includes provenance with reasoning steps", () => {
            const expected: ExpectedMetrics = { metric: "Metric", expected: 100, period: "Q1" };
            const actual: ActualMetrics = { goalId: "G1", actual: 100, timestamp: "2024-01-01T00:00:00Z", source: "test" };

            const result = engine.compareExpectedVsActual(expected, actual);

            expect(result.provenance.reasoningSteps.length).toBeGreaterThan(0);
            expect(result.provenance.sourceRef).toBe("ExecutiveIntelligenceEngine");
        });

        it("produces unique traceId per invocation", () => {
            const expected1: ExpectedMetrics = { metric: "M1", expected: 100, period: "Q1" };
            const actual1: ActualMetrics = { goalId: "G1", actual: 100, timestamp: "2024-01-01T00:00:00Z", source: "test" };
            const expected2: ExpectedMetrics = { metric: "M2", expected: 100, period: "Q1" };
            const actual2: ActualMetrics = { goalId: "G1", actual: 100, timestamp: "2024-01-01T00:00:00Z", source: "test" };

            const r1 = engine.compareExpectedVsActual(expected1, actual1);
            const r2 = engine.compareExpectedVsActual(expected2, actual2);

            expect(r1.provenance.traceId).not.toBe(r2.provenance.traceId);
        });
    });

    describe("generateBalancedGrowthIndicators", () => {
        it("returns balanced growth report for all 10 dimensions", () => {
            const dimensions: GrowthDimension[] = ["profit", "liquidity", "operationalCapacity", "workforce", "throughput", "quality", "risk", "compliance", "resilience", "investment"];

            const result = engine.generateBalancedGrowthIndicators(dimensions);

            expect(result.dimensions).toHaveLength(10);
            expect(result.overallBalance).toBeGreaterThanOrEqual(0);
            expect(result.overallBalance).toBeLessThanOrEqual(100);
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.provenance.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.provenance.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(result.provenance.verificationStatus).toBe("VERIFIED");
            expect(result.provenance.reasoningSteps.length).toBeGreaterThan(0);
        });

        it("scores HEALTHY for dimensions above 75", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("profit", "90", "finance"));

            const dimensions: GrowthDimension[] = ["profit"];
            const result = engine.generateBalancedGrowthIndicators(dimensions);

            expect(result.dimensions[0].status).toBe("HEALTHY");
            expect(result.imbalances.length).toBe(0);
        });

        it("identifies AT_RISK dimensions between 40 and 75", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("liquidity", "60", "finance"));

            const dimensions: GrowthDimension[] = ["liquidity"];
            const result = engine.generateBalancedGrowthIndicators(dimensions);

            expect(result.dimensions[0].status).toBe("AT_RISK");
            expect(result.imbalances.length).toBe(1);
            expect(result.imbalances[0].gap).toBeCloseTo(15, 1);
        });

        it("identifies CRITICAL dimensions below 40", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("investment", "20", "finance"));

            const dimensions: GrowthDimension[] = ["investment"];
            const result = engine.generateBalancedGrowthIndicators(dimensions);

            expect(result.dimensions[0].status).toBe("CRITICAL");
            expect(result.imbalances.length).toBe(1);
        });

        it("uses base scores when no memory events exist for dimension", () => {
            const dimensions: GrowthDimension[] = ["profit"];

            const result = engine.generateBalancedGrowthIndicators(dimensions);

            expect(result.dimensions[0].score).toBeGreaterThan(0);
            expect(result.dimensions[0].score).toBeLessThanOrEqual(100);
        });

        it("generates recommendations for imbalanced dimensions", () => {
            const MemoryEvent = require("../Entities/MemoryEvent").MemoryEvent;
            const memory = (engine as any).memory;
            memory.store(new MemoryEvent("workforce", "30", "hr"));
            memory.store(new MemoryEvent("quality", "20", "qa"));

            const dimensions: GrowthDimension[] = ["workforce", "quality"];
            const result = engine.generateBalancedGrowthIndicators(dimensions);

            expect(result.recommendations.length).toBeGreaterThan(0);
            expect(result.recommendations.some(r => r.includes("workforce"))).toBe(true);
            expect(result.recommendations.some(r => r.includes("quality"))).toBe(true);
        });

        it("produces unique traceId per invocation", () => {
            const dimensions: GrowthDimension[] = ["profit", "liquidity"];
            const r1 = engine.generateBalancedGrowthIndicators(dimensions);
            const r2 = engine.generateBalancedGrowthIndicators(dimensions);

            expect(r1.provenance.traceId).not.toBe(r2.provenance.traceId);
        });
    });

    describe("Provenance chain completeness", () => {
        it("evaluateStrategicAlignment produces complete provenance chain", () => {
            const goals: StrategicGoal[] = [{ id: "G1", name: "R", target: 100, weight: 1, category: "f" }];
            const actuals: ActualMetrics[] = [{ goalId: "G1", actual: 80, timestamp: "2024-01-01T00:00:00Z", source: "t" }];
            const result = engine.evaluateStrategicAlignment(goals, actuals);
            const p = result.provenance;

            expect(p.traceId).toMatch(/^TRACE-/);
            expect(p.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(p.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(["VERIFIED", "PENDING", "FAILED"]).toContain(p.verificationStatus);
            expect(typeof p.sourceRef).toBe("string");
            expect(Array.isArray(p.reasoningSteps)).toBe(true);
        });

        it("generateDashboardPrimitives produces complete provenance chain", () => {
            const result = engine.generateDashboardPrimitives("t1");
            const p = result.provenance;

            expect(p.traceId).toMatch(/^TRACE-/);
            expect(p.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(p.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(["VERIFIED", "PENDING", "FAILED"]).toContain(p.verificationStatus);
            expect(typeof p.sourceRef).toBe("string");
            expect(Array.isArray(p.reasoningSteps)).toBe(true);
        });

        it("trackKPIHistory produces complete provenance chain", () => {
            const result = engine.trackKPIHistory("KPI");
            const p = result.provenance;

            expect(p.traceId).toMatch(/^TRACE-/);
            expect(p.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(p.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(["VERIFIED", "PENDING", "FAILED"]).toContain(p.verificationStatus);
            expect(typeof p.sourceRef).toBe("string");
            expect(Array.isArray(p.reasoningSteps)).toBe(true);
        });

        it("compareExpectedVsActual produces complete provenance chain", () => {
            const expected: ExpectedMetrics = { metric: "M", expected: 100, period: "Q1" };
            const actual: ActualMetrics = { goalId: "G1", actual: 100, timestamp: "2024-01-01T00:00:00Z", source: "t" };
            const result = engine.compareExpectedVsActual(expected, actual);
            const p = result.provenance;

            expect(p.traceId).toMatch(/^TRACE-/);
            expect(p.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(p.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(["VERIFIED", "PENDING", "FAILED"]).toContain(p.verificationStatus);
            expect(typeof p.sourceRef).toBe("string");
            expect(Array.isArray(p.reasoningSteps)).toBe(true);
        });

        it("generateBalancedGrowthIndicators produces complete provenance chain", () => {
            const result = engine.generateBalancedGrowthIndicators(["profit", "liquidity"]);
            const p = result.provenance;

            expect(p.traceId).toMatch(/^TRACE-/);
            expect(p.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(p.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(["VERIFIED", "PENDING", "FAILED"]).toContain(p.verificationStatus);
            expect(typeof p.sourceRef).toBe("string");
            expect(Array.isArray(p.reasoningSteps)).toBe(true);
        });
    });

    describe("Regression tests", () => {
        it("analyzeKpi still works as before", () => {
            const kpi = engine.analyzeKpi("Revenue", 150000, 100000);
            expect(kpi.name).toBe("Revenue");
            expect(kpi.actual).toBe(150000);
            expect(kpi.target).toBe(100000);
            expect(kpi.variance).toBe(50000);
            expect(kpi.achievementRate).toBe(150);
        });

        it("recommend still works as before", () => {
            const kpi = engine.analyzeKpi("Test", 200, 100);
            const recommendation = engine.recommend(kpi);
            expect(recommendation.status).toBe("ON_TRACK");
        });

        it("evaluatePerformance still works as before", () => {
            const result = engine.evaluatePerformance(150, 100);
            expect(result.status).toBe("ON_TRACK");
            expect(result.achievementRate).toBe(150);
        });
    });
});

