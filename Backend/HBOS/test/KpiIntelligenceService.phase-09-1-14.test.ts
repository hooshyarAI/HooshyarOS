import { KpiIntelligenceService } from "../Product/KpiIntelligenceService";

describe("KpiIntelligenceService (09-1.14)", () => {
    const service = new KpiIntelligenceService();

    test("trend on perfect line y = 2x", () => {
        const r = service.trend([2, 4, 6, 8, 10]);
        expect(r.status).toBe("READY");
        expect(r.n).toBe(5);
        expect(r.slope).toBeCloseTo(2, 5);
        expect(r.intercept).toBeCloseTo(0, 5);
        expect(r.direction).toBe("UP");
    });

    test("trend on decreasing series", () => {
        const r = service.trend([100, 80, 60, 40, 20]);
        expect(r.status).toBe("READY");
        expect(r.slope).toBeCloseTo(-20, 5);
        expect(r.direction).toBe("DOWN");
    });

    test("trend on flat series", () => {
        const r = service.trend([50, 50, 50, 50]);
        expect(r.status).toBe("READY");
        expect(r.slope).toBeCloseTo(0, 5);
        expect(r.direction).toBe("FLAT");
    });

    test("trend blocks <2 points", () => {
        expect(service.trend([]).status).toBe("BLOCKED");
        expect(service.trend([42]).status).toBe("BLOCKED");
    });

    test("trend blocks NaN", () => {
        expect(service.trend([1, 2, Number.NaN, 4]).status).toBe("BLOCKED");
    });

    test("deviation: mean 50, std 0 -> all z=0, flag NORMAL", () => {
        const r = service.deviation([50, 50, 50, 50]);
        expect(r.status).toBe("READY");
        expect(r.mean).toBe(50);
        expect(r.stdDev).toBe(0);
        for (const z of r.zScores) expect(z).toBe(0);
        for (const a of r.anomalies) expect(a.flag).toBe("NORMAL");
    });

    test("deviation: clear outlier flagged as ALERT", () => {
        const r = service.deviation([10, 11, 12, 10, 11, 12, 10, 11, 12, 100]);
        expect(r.status).toBe("READY");
        const last = r.anomalies[r.anomalies.length - 1];
        expect(last.flag).toBe("ALERT");
    });

    test("no NaN/Infinity leaks", () => {
        const r = service.trend([1, 2, 3, 4, 5]);
        expect(r.status).toBe("READY");
        expect(Number.isFinite(r.slope)).toBe(true);
        expect(Number.isFinite(r.intercept)).toBe(true);
    });
});
