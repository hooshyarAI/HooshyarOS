import { CashFlowForecastingService } from "../Product/CashFlowForecastingService";

describe("CashFlowForecastingService (09-1.6)", () => {
    const service = new CashFlowForecastingService();

    test("naive forecast = last observation", () => {
        const r = service.naive([100, 110, 105, 120], 3);
        expect(r.status).toBe("READY");
        expect(r.method).toBe("naive");
        expect(r.points).toEqual([{ step: 1, value: 120 }, { step: 2, value: 120 }, { step: 3, value: 120 }]);
    });

    test("naive blocks empty series", () => {
        expect(service.naive([], 3).status).toBe("BLOCKED");
    });

    test("naive blocks zero horizon", () => {
        expect(service.naive([1, 2, 3], 0).status).toBe("BLOCKED");
    });

    test("movingAverage with window=3", () => {
        const r = service.movingAverage([10, 20, 30, 40, 50], 3, 2);
        expect(r.status).toBe("READY");
        // Fitted values: at t=3 (series index 2) = mean(10,20,30) = 20; t=4 = 30; t=5 = 40
        expect(r.fitted.map(p => p.value)).toEqual([20, 30, 40]);
        expect(r.points).toEqual([{ step: 1, value: 40 }, { step: 2, value: 40 }]);
    });

    test("movingAverage blocks window > series length", () => {
        expect(service.movingAverage([1, 2], 5, 1).status).toBe("BLOCKED");
    });

    test("linearTrend forecast on perfect line", () => {
        const r = service.linearTrend([1, 2, 3, 4, 5], 3);
        expect(r.status).toBe("READY");
        expect(r.points.map(p => p.value)).toEqual([6, 7, 8]);
        // fitted values should equal the input
        for (let i = 0; i < 5; i += 1) {
            expect(r.fitted[i].value).toBeCloseTo(i + 1, 5);
        }
    });

    test("linearTrend blocks <2 points", () => {
        expect(service.linearTrend([1], 1).status).toBe("BLOCKED");
    });

    test("no NaN/Infinity leaks", () => {
        const r = service.linearTrend([0, 0, 0, 0, 0], 3);
        expect(r.status).toBe("READY");
        for (const p of r.points) expect(Number.isFinite(p.value)).toBe(true);
    });

    test("blocks NaN inputs", () => {
        expect(service.naive([1, Number.NaN, 3], 2).status).toBe("BLOCKED");
        expect(service.movingAverage([1, Number.NaN, 3], 2, 1).status).toBe("BLOCKED");
        expect(service.linearTrend([1, Number.NaN, 3], 1).status).toBe("BLOCKED");
    });
});
