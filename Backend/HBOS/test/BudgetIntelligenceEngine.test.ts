import { BudgetIntelligenceEngine } from "../Engines/BudgetIntelligenceEngine";

describe("BudgetIntelligenceEngine", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new BudgetIntelligenceEngine();
        expect(engine.name).toBe("BudgetIntelligenceEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability().id).toBe("platform.budget-intelligence");
    });

    it("analyzes budget variance", () => {
        const result = new BudgetIntelligenceEngine().analyze({ planned: 1000, actual: 800 });
        expect(result.status).toBe("READY");
        expect(result.variance).toBe(-200);
        expect(result.utilization).toBeCloseTo(0.8);
    });

    it("summarizes budget and actual cost by cost center and category", () => {
        const input = { lines: [
            { lineId: "l1", costCenterId: "factory", category: "materials", currency: "irr", planned: 1000, actual: 1200 },
            { lineId: "l2", costCenterId: "factory", category: "labor", currency: "IRR", planned: 500, actual: 300 },
            { lineId: "l3", costCenterId: "office", category: "materials", currency: "IRR", planned: 250, actual: 250 }
        ] };
        const result = new BudgetIntelligenceEngine().analyzeCostBreakdown(input);
        expect(result.status).toBe("READY");
        if (result.status !== "READY") return;
        expect(result.currency).toBe("IRR");
        expect(result.total).toEqual(expect.objectContaining({
            planned: 1750, actual: 1750, variance: 0, utilization: 1, variancePercent: 0, status: "WITHIN_BUDGET"
        }));
        expect(result.byCostCenter).toEqual([
            expect.objectContaining({ key: "factory", planned: 1500, actual: 1500, variance: 0, lineCount: 2 }),
            expect.objectContaining({ key: "office", planned: 250, actual: 250, variance: 0, lineCount: 1 })
        ]);
        expect(result.byCategory).toEqual([
            expect.objectContaining({ key: "labor", planned: 500, actual: 300, variance: -200, status: "UNDER_BUDGET" }),
            expect.objectContaining({ key: "materials", planned: 1250, actual: 1450, variance: 200, status: "OVER_BUDGET" })
        ]);
        expect(result.lines[0].status).toBe("OVER_BUDGET");
        expect(result.lines[0].variancePercent).toBe(20);
    });

    it("blocks empty, malformed, duplicate and mixed-currency cost input", () => {
        const engine = new BudgetIntelligenceEngine();
        expect(engine.analyzeCostBreakdown({ lines: [] })).toEqual({ status: "BLOCKED", reason: "COST_LINES_REQUIRED" });
        expect(engine.analyzeCostBreakdown({ lines: [
            { lineId: "x", costCenterId: "a", category: "m", currency: "IRR", planned: -1, actual: 0 }
        ] })).toEqual({ status: "BLOCKED", reason: "COST_AMOUNT_INVALID" });
        expect(engine.analyzeCostBreakdown({ lines: [
            { lineId: "x", costCenterId: "a", category: "m", currency: "IRR", planned: 1, actual: 1 },
            { lineId: "x", costCenterId: "b", category: "m", currency: "IRR", planned: 1, actual: 1 }
        ] })).toEqual({ status: "BLOCKED", reason: "COST_LINE_ID_DUPLICATE" });
        expect(engine.analyzeCostBreakdown({ lines: [
            { lineId: "x", costCenterId: "a", category: "m", currency: "IRR", planned: 1, actual: 1 },
            { lineId: "y", costCenterId: "b", category: "m", currency: "USD", planned: 1, actual: 1 }
        ] })).toEqual({ status: "BLOCKED", reason: "MIXED_CURRENCIES_NOT_SUPPORTED" });
    });

    it("does not invent ratios when planned cost is zero", () => {
        const result = new BudgetIntelligenceEngine().analyzeCostBreakdown({ lines: [
            { lineId: "unbudgeted", costCenterId: "it", category: "software", currency: "IRR", planned: 0, actual: 500 }
        ] });
        expect(result.status).toBe("READY");
        if (result.status !== "READY") return;
        expect(result.total.utilization).toBeNull();
        expect(result.total.variancePercent).toBeNull();
        expect(result.total.status).toBe("UNBUDGETED_SPEND");
    });

    it("keeps input immutable and blocks aggregate overflow", () => {
        const engine = new BudgetIntelligenceEngine();
        const lines = [
            { lineId: "x", costCenterId: "a", category: "m", currency: "IRR", planned: Number.MAX_VALUE, actual: 0 },
            { lineId: "y", costCenterId: "a", category: "m", currency: "IRR", planned: Number.MAX_VALUE, actual: 0 }
        ];
        const original = JSON.stringify(lines);
        expect(engine.analyzeCostBreakdown({ lines }).status).toBe("BLOCKED");
        expect(JSON.stringify(lines)).toBe(original);
    });

    it("keeps the canonical evidence alias on the same analysis contract", () => {
        expect(new BudgetIntelligenceEngine().analyzeBudget({ planned: 1000, actual: 800 })).toEqual(
            new BudgetIntelligenceEngine().analyze({ planned: 1000, actual: 800 })
        );
    });
});
