import { AnomalyDetectionService } from "../Product/AnomalyDetectionService";

describe("AnomalyDetectionService", () => {
    const service = new AnomalyDetectionService();

    test("zscore detects outliers", () => {
        const result = service.zscore([10, 12, 12, 13, 12, 11, 14, 2000], 1.5, 2.5);
        expect(result.status).toBe("READY");
        expect(result.points.some(p => p.flag === "ALERT")).toBe(true);
    });

    test("zscore blocks short series", () => {
        expect(service.zscore([10]).status).toBe("BLOCKED");
    });

    test("iqr detects outliers", () => {
        const result = service.iqr([10, 12, 12, 13, 12, 11, 14, 100]);
        expect(result.status).toBe("READY");
        expect(result.points.some(p => p.flag === "ALERT")).toBe(true);
    });

    test("modifiedZ detects outliers", () => {
        const result = service.modifiedZ([10, 12, 12, 13, 12, 11, 14, 100]);
        expect(result.status).toBe("READY");
        expect(result.points.some(p => p.flag === "ALERT")).toBe(true);
    });
});
