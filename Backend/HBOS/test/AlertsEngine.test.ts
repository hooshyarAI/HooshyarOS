import { AlertsEngine } from "../Engines/AlertsEngine";

describe("AlertsEngine", () => {
    it("exposes canonical identity and health", () => {
        const engine = new AlertsEngine();
        expect(engine.name).toBe("AlertsEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability().id).toBe("platform.alerts");
    });

    it("evaluates threshold alerts", () => {
        const result = new AlertsEngine().evaluate(120, 100);
        expect(result.status).toBe("READY");
        expect(result.triggered).toBe(true);
    });
});
