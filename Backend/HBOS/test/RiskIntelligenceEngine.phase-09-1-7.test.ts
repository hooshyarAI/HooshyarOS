import { RiskIntelligenceEngine } from "../Engines/RiskIntelligenceEngine";

describe("RiskIntelligenceEngine sensitivity analysis (09-1.7)", () => {
    const engine = new RiskIntelligenceEngine();

    test("sensitivity on linear model: y = a + b*x, +10% in b increases y by 10% of b*x", () => {
        const base = { a: 100, b: 5, x: 10 };
        const r = engine.sensitivity({
            base,
            deltas: [0.10],
            model: (p) => (p as any).a + (p as any).b * (p as any).x
        });
        expect(r.status).toBe("READY");
        expect(r.baseOutput).toBe(150);
        expect(r.entries.length).toBe(3);
        const bEntry = r.entries.find(e => e.variable === "b")!;
        expect(bEntry.newValue).toBe(5.5);
        expect(bEntry.newOutput).toBeCloseTo(155, 5);
        expect(bEntry.absoluteChange).toBeCloseTo(5, 5);
        expect(bEntry.elasticOutput).toBeCloseTo(1 / 3, 5);
    });

    test("sensitivity tornado sorts by descending range", () => {
        // y = a + b*x; at base a=100, b=5, x=10 -> y = 150
        // Perturbing `a` ±10%: range = |110+50 - 90+50| = 20
        // Perturbing `b` ±10%: range = |100+55 - 100+45| = 10
        // Perturbing `x` ±10%: range = |100+55 - 100+45| = 10
        const base = { a: 100, b: 5, x: 10 };
        const t = engine.tornado({
            base,
            deltaPct: 0.10,
            model: (p) => (p as any).a + (p as any).b * (p as any).x
        });
        expect(t[0].variable).toBe("a");
        expect(t[0].range).toBeCloseTo(20, 5);
        // b and x tied
        const bEntry = t.find(e => e.variable === "b")!;
        const xEntry = t.find(e => e.variable === "x")!;
        expect(bEntry.range).toBeCloseTo(10, 5);
        expect(xEntry.range).toBeCloseTo(10, 5);
    });

    test("sensitivity blocks invalid model", () => {
        const r = engine.sensitivity({ base: { a: 1 }, deltas: [0.1], model: null as any });
        expect(r.status).toBe("BLOCKED");
    });

    test("sensitivity blocks NaN base value", () => {
        const r = engine.sensitivity({ base: { a: Number.NaN }, deltas: [0.1], model: (p) => (p as any).a });
        expect(r.status).toBe("BLOCKED");
    });

    test("sensitivity blocks non-finite model output", () => {
        const r = engine.sensitivity({
            base: { a: 1 },
            deltas: [0.1],
            model: () => Number.POSITIVE_INFINITY
        });
        expect(r.status).toBe("BLOCKED");
    });

    test("tornado with invalid input returns empty", () => {
        expect(engine.tornado({ base: null as any, deltaPct: 0.1, model: () => 0 })).toEqual([]);
        expect(engine.tornado({ base: { a: 1 }, deltaPct: Number.NaN, model: () => 0 })).toEqual([]);
    });

    test("existing assess contract preserved", () => {
        const r = engine.assess(0.5, 10);
        expect(r.status).toBe("READY");
        expect(r.score).toBe(5);
    });
});
