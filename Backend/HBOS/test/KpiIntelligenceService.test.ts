import { KpiIntelligenceService } from "../Product/KpiIntelligenceService";

describe("KpiIntelligenceService", () => {
    const service = new KpiIntelligenceService();

    test("trend detects upward slope", () => {
        const result = service.trend([10, 20, 30, 40]);
        expect(result.status).toBe("READY");
        expect(result.direction).toBe("UP");
        expect(result.slope).toBeCloseTo(10, 5);
    });

    test("trend detects downward slope", () => {
        const result = service.trend([40, 30, 20, 10]);
        expect(result.status).toBe("READY");
        expect(result.direction).toBe("DOWN");
    });

    test("trend blocks short series", () => {
        expect(service.trend([10]).status).toBe("BLOCKED");
    });

    test("deviation computes z-scores and anomalies", () => {
        const result = service.deviation([10, 12, 12, 13, 12, 11, 14, 100], 1.5, 2.0);
        expect(result.status).toBe("READY");
        expect(result.mean).toBeCloseTo(23, 1);
        expect(result.anomalies.some(a => a.flag === "ALERT")).toBe(true);
    });
});
