import { DashboardEngine } from "../Engines/DashboardEngine";

describe("DashboardEngine", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new DashboardEngine();
        expect(engine.name).toBe("DashboardEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "platform.dashboard",
            capability: "implement Dashboard capability",
            targetEngine: "Dashboard Engine"
        });
    });
});
