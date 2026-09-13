import { CashFlowForecastingService } from "../Product/CashFlowForecastingService";

describe("CashFlowForecastingService", () => {
    const service = new CashFlowForecastingService();

    test("naive returns last value", () => {
        expect(service.naive([10, 20, 30]).forecast).toBe(30);
        expect(service.naive([10, 20, 30]).status).toBe("READY");
    });

    test("naive blocks empty history", () => {
        expect(service.naive([]).status).toBe("BLOCKED");
    });

    test("movingAverage computes average of last window", () => {
        const result = service.movingAverage([10, 20, 30, 40], 2);
        expect(result.forecast).toBeCloseTo(35, 5);
        expect(result.status).toBe("READY");
    });

    test("movingAverage blocks invalid window", () => {
        expect(service.movingAverage([10, 20], 0).status).toBe("BLOCKED");
    });

    test("linearTrend computes forecast", () => {
        const result = service.linearTrend([10, 20, 30]);
        expect(result.status).toBe("READY");
        expect(result.forecast).toBeCloseTo(40, 5);
        expect(result.slope).toBeCloseTo(10, 5);
    });

    test("linearTrend blocks short history", () => {
        expect(service.linearTrend([10]).status).toBe("BLOCKED");
    });
});
