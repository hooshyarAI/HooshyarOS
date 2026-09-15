import { ExponentialSmoothingService } from "../Product/ExponentialSmoothingService";

describe("ExponentialSmoothingService (phase-09 contract, reconciled)", () => {
    const service = new ExponentialSmoothingService();

    test("alpha=0.5 known calculation", () => {
        const r = service.ses([10, 20, 30, 40], 0.5);
        expect(r.status).toBe("READY");
        expect(r.smoothed).toBeCloseTo(31.25, 5);
    });

    test("alpha=0.3 known calculation", () => {
        const r = service.ses([10, 20, 30], 0.3);
        expect(r.status).toBe("READY");
        expect(r.smoothed).toBeCloseTo(18.1, 5);
    });

    test("alpha boundaries are exclusive: 0 and 1 fail closed", () => {
        expect(service.ses([1, 2, 3], 0).status).toBe("BLOCKED");
        expect(service.ses([1, 2, 3], 1).status).toBe("BLOCKED");
        expect(service.ses([1, 2, 3], -0.1).status).toBe("BLOCKED");
        expect(service.ses([1, 2, 3], 1.1).status).toBe("BLOCKED");
        expect(service.ses([1, 2, 3], Number.NaN).status).toBe("BLOCKED");
    });

    test("empty or all-non-finite series fail closed", () => {
        expect(service.ses([], 0.5).status).toBe("BLOCKED");
        expect(service.ses([Number.NaN, Number.NaN], 0.5).status).toBe("BLOCKED");
    });

    test("interior non-finite observations are discarded, not propagated as NaN", () => {
        const r = service.ses([1, Number.NaN, 3], 0.5);
        expect(r.status).toBe("READY");
        expect(r.smoothed).toBe(2);
        expect(Number.isFinite(r.smoothed)).toBe(true);
    });

    test("no NaN/Infinity leaks for a valid series", () => {
        const r = service.ses([100, 110, 105, 120, 115], 0.3);
        expect(r.status).toBe("READY");
        expect(Number.isFinite(r.smoothed)).toBe(true);
    });
});
