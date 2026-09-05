import { ExponentialSmoothingService } from "../Product/ExponentialSmoothingService";

describe("ExponentialSmoothingService", () => {
    const service = new ExponentialSmoothingService();

    test("ses smooths correctly", () => {
        const result = service.ses([10, 20, 30], 0.3);
        expect(result.status).toBe("READY");
        expect(result.smoothed).toBeCloseTo(18.1, 1);
    });

    test("ses blocks invalid alpha", () => {
        expect(service.ses([10, 20], 0).status).toBe("BLOCKED");
        expect(service.ses([10, 20], 1).status).toBe("BLOCKED");
        expect(service.ses([10, 20], NaN).status).toBe("BLOCKED");
    });

    test("ses blocks empty history", () => {
        expect(service.ses([], 0.5).status).toBe("BLOCKED");
    });
});
