import { AlertsEngine } from "../Engines/AlertsEngine";

describe("AlertsEngine", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new AlertsEngine();
        expect(engine.name).toBe("AlertsEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "platform.alerts",
            capability: "implement Alerts capability",
            targetEngine: "Alerts Engine"
        });
    });
});
