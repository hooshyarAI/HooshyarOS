import { ExponentialSmoothingService } from "../Product/ExponentialSmoothingService";

describe("ExponentialSmoothingService (09-1.9)", () => {
    const service = new ExponentialSmoothingService();

    test("alpha=1 -> fitted = observed, forecast = last observation", () => {
        const r = service.ses([10, 20, 30, 40], 1, 2);
        expect(r.status).toBe("READY");
        expect(r.fitted.map(p => p.value)).toEqual([10, 20, 30, 40]);
        expect(r.points.map(p => p.value)).toEqual([40, 40]);
    });

    test("alpha=0 -> fitted = first observation forever", () => {
        const r = service.ses([10, 20, 30, 40], 0, 2);
        expect(r.status).toBe("READY");
        expect(r.fitted.map(p => p.value)).toEqual([10, 10, 10, 10]);
        expect(r.points.map(p => p.value)).toEqual([10, 10]);
    });

    test("alpha=0.5 known calculation", () => {
        // level[0] = 10; level[1] = 0.5*20 + 0.5*10 = 15; level[2] = 0.5*30 + 0.5*15 = 22.5
        const r = service.ses([10, 20, 30, 40], 0.5, 1);
        expect(r.status).toBe("READY");
        expect(r.fitted[0].value).toBe(10);
        expect(r.fitted[1].value).toBe(15);
        expect(r.fitted[2].value).toBe(22.5);
        expect(r.fitted[3].value).toBeCloseTo(31.25, 5);
        expect(r.points[0].value).toBeCloseTo(31.25, 5);
    });

    test("blocks invalid alpha", () => {
        expect(service.ses([1, 2, 3], -0.1, 1).status).toBe("BLOCKED");
        expect(service.ses([1, 2, 3], 1.1, 1).status).toBe("BLOCKED");
    });

    test("blocks empty series", () => {
        expect(service.ses([], 0.5, 1).status).toBe("BLOCKED");
    });

    test("blocks NaN inputs", () => {
        expect(service.ses([1, Number.NaN, 3], 0.5, 1).status).toBe("BLOCKED");
    });

    test("no NaN/Infinity leaks", () => {
        const r = service.ses([100, 110, 105, 120, 115], 0.3, 5);
        expect(r.status).toBe("READY");
        for (const p of r.points) expect(Number.isFinite(p.value)).toBe(true);
        expect(Number.isFinite(r.inSampleMae)).toBe(true);
    });
});
