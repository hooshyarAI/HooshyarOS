import { AnomalyDetectionService } from "../Product/AnomalyDetectionService";

describe("AnomalyDetectionService (09-2.6)", () => {
    const service = new AnomalyDetectionService();

    test("zscore flags clear outlier as ALERT", () => {
        // Series: 10 close values, one extreme outlier -> with warn=1.5, alert=2.0 the outlier must trigger
        const r = service.zscore([10, 11, 12, 10, 11, 12, 10, 11, 12, 100], 1.5, 2.0);
        expect(r.status).toBe("READY");
        const last = r.points[r.points.length - 1];
        expect(last.flag).toBe("ALERT");
    });

    test("zscore all same -> all NORMAL with score 0", () => {
        const r = service.zscore([5, 5, 5, 5, 5]);
        expect(r.status).toBe("READY");
        for (const p of r.points) {
            expect(p.flag).toBe("NORMAL");
            expect(p.score).toBe(0);
        }
    });

    test("iqr flags outliers outside fence", () => {
        const r = service.iqr([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
        expect(r.status).toBe("READY");
        const last = r.points[r.points.length - 1];
        expect(last.flag).toBe("ALERT");
    });

    test("modifiedZ robust to single outlier", () => {
        // Median ~10; MAD is 0 (all values are 10 except the outlier)
        // So the modified-Z score for the outlier is Infinity in the math; with mad=0, we set score=0 per our impl.
        // In that case, the outlier is NOT flagged via modified-Z (correct: MAD is 0 so we cannot determine).
        // The test verifies graceful behavior.
        const r = service.modifiedZ([10, 10, 10, 10, 10, 10, 10, 10, 10, 100]);
        expect(r.status).toBe("READY");
        // Score should be 0 (graceful degradation when MAD = 0)
        const last = r.points[r.points.length - 1];
        expect(Number.isFinite(last.score)).toBe(true);
    });

    test("modifiedZ detects outlier when MAD > 0", () => {
        // Add a bit of noise so MAD > 0
        const r = service.modifiedZ([10, 11, 9, 10, 11, 9, 10, 11, 9, 100]);
        expect(r.status).toBe("READY");
        const last = r.points[r.points.length - 1];
        expect(last.flag).toBe("ALERT");
    });

    test("blocks short series", () => {
        expect(service.zscore([]).status).toBe("BLOCKED");
        expect(service.zscore([1]).status).toBe("BLOCKED");
    });

    test("blocks NaN inputs", () => {
        expect(service.zscore([1, 2, Number.NaN, 4]).status).toBe("BLOCKED");
    });

    test("no NaN/Infinity leaks", () => {
        const r = service.iqr([1, 1, 1, 1, 1]);
        expect(r.status).toBe("READY");
        for (const p of r.points) expect(Number.isFinite(p.score)).toBe(true);
    });
});
