import { CashFlowForecastingService } from "../Product/CashFlowForecastingService";

describe("CashFlowForecastingService (phase-09 contract, reconciled)", () => {
    const service = new CashFlowForecastingService();

    test("naive forecast = last observation", () => {
        const r = service.naive([100, 110, 105, 120]);
        expect(r.status).toBe("READY");
        expect(r.forecast).toBe(120);
    });

    test("naive fails closed on empty or non-finite last observation", () => {
        expect(service.naive([]).status).toBe("BLOCKED");
        expect(service.naive([1, 2, Number.NaN]).status).toBe("BLOCKED");
    });

    test("moving average uses the last window", () => {
        const r = service.movingAverage([10, 20, 30, 40, 50], 3);
        expect(r.status).toBe("READY");
        expect(r.window).toBe(3);
        expect(r.forecast).toBe(40);
    });

    test("moving average fails closed on invalid window or empty series", () => {
        expect(service.movingAverage([1, 2], 0).status).toBe("BLOCKED");
        expect(service.movingAverage([1, 2], Number.NaN).status).toBe("BLOCKED");
        expect(service.movingAverage([], 2).status).toBe("BLOCKED");
    });

    test("moving average with no finite observations fails closed", () => {
        expect(service.movingAverage([Number.NaN, Number.NaN], 2).status).toBe("BLOCKED");
    });

    test("linear trend forecasts the next point on a perfect line", () => {
        const r = service.linearTrend([1, 2, 3, 4, 5]);
        expect(r.status).toBe("READY");
        expect(r.slope).toBeCloseTo(1, 5);
        expect(r.forecast).toBeCloseTo(6, 5);
    });

    test("linear trend fails closed with fewer than two finite points", () => {
        expect(service.linearTrend([1]).status).toBe("BLOCKED");
        expect(service.linearTrend([1, Number.NaN]).status).toBe("BLOCKED");
        expect(service.linearTrend([Number.NaN, Number.NaN, Number.NaN]).status).toBe("BLOCKED");
    });

    test("linear trend on a flat series produces a finite, zero-slope forecast", () => {
        const r = service.linearTrend([0, 0, 0, 0, 0]);
        expect(r.status).toBe("READY");
        expect(r.slope).toBe(0);
        expect(Number.isFinite(r.forecast)).toBe(true);
    });

    test("interior non-finite observations are discarded, not propagated as NaN", () => {
        const r = service.movingAverage([1, Number.NaN, 3], 2);
        expect(r.status).toBe("READY");
        expect(r.forecast).toBe(2);
        expect(Number.isFinite(r.forecast)).toBe(true);
    });
});
