import { RiskIntelligenceEngine } from "../Engines/RiskIntelligenceEngine";

describe("RiskIntelligenceEngine scenario analysis (09-1.8)", () => {
    const engine = new RiskIntelligenceEngine();

    test("scenario analysis base / down / up", () => {
        const baseNpv = (rate: number, flows: number[]) => {
            let total = -1000;
            for (let t = 0; t < flows.length; t += 1) {
                total += flows[t] / Math.pow(1 + rate, t + 1);
            }
            return total;
        };
        const base = baseNpv(0.10, [400, 400, 400]);
        const r = engine.scenario({
            base: { rate: 0.10, y1: 400, y2: 400, y3: 400 },
            scenarios: [
                { name: "downside", params: { rate: 0.15, y1: 300, y2: 300, y3: 300 } },
                { name: "upside", params: { rate: 0.05, y1: 500, y2: 500, y3: 500 } }
            ],
            model: (p) => {
                const x = p as { rate: number; y1: number; y2: number; y3: number };
                return -1000 + x.y1 / Math.pow(1 + x.rate, 1) + x.y2 / Math.pow(1 + x.rate, 2) + x.y3 / Math.pow(1 + x.rate, 3);
            }
        });
        expect(r.status).toBe("READY");
        expect(r.baseOutput).toBeCloseTo(base, 1);
        expect(r.entries[0].name).toBe("downside");
        expect(r.entries[0].output).toBeLessThan(r.baseOutput);
        expect(r.entries[1].name).toBe("upside");
        expect(r.entries[1].output).toBeGreaterThan(r.baseOutput);
        expect(r.entries[0].delta).toBeCloseTo(r.entries[0].output - r.baseOutput, 5);
    });

    test("scenario blocks invalid model", () => {
        const r = engine.scenario({ base: { a: 1 }, scenarios: [], model: null as any });
        expect(r.status).toBe("BLOCKED");
    });

    test("scenario blocks NaN base value", () => {
        const r = engine.scenario({ base: { a: Number.NaN }, scenarios: [], model: () => 0 });
        expect(r.status).toBe("BLOCKED");
    });

    test("scenario blocks non-finite base output", () => {
        const r = engine.scenario({ base: { a: 1 }, scenarios: [], model: () => Number.POSITIVE_INFINITY });
        expect(r.status).toBe("BLOCKED");
    });

    test("scenario with non-finite scenario value marks entry BLOCKED", () => {
        const r = engine.scenario({
            base: { a: 1 },
            scenarios: [{ name: "bad", params: { a: Number.NaN } }],
            model: (p) => (p as any).a
        });
        expect(r.status).toBe("READY");
        expect(r.entries[0].status).toBe("BLOCKED");
    });

    test("no NaN/Infinity leaks in ready entries", () => {
        const r = engine.scenario({
            base: { a: 1, b: 2 },
            scenarios: [{ name: "x", params: { a: 1, b: 2 } }],
            model: (p) => (p as any).a * (p as any).b
        });
        expect(r.status).toBe("READY");
        expect(Number.isFinite(r.entries[0].output)).toBe(true);
        expect(Number.isFinite(r.entries[0].pctChange)).toBe(true);
    });
});
