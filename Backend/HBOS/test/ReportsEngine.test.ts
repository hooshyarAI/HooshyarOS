import { ReportsEngine } from "../Engines/ReportsEngine";

describe("ReportsEngine", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new ReportsEngine();
        expect(engine.name).toBe("ReportsEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "platform.reports",
            capability: "implement Reports capability",
            targetEngine: "Reports Engine"
        });
    });
});
