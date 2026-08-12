import { DashboardEngine } from "../Engines/DashboardEngine";

describe("DashboardEngine", () => {
    it("exposes canonical identity and health", () => {
        const engine = new DashboardEngine();
        expect(engine.name).toBe("DashboardEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability().id).toBe("platform.dashboard");
    });

    it("builds a deterministic metric snapshot", () => {
        const result = new DashboardEngine().snapshot({ revenue: 100, profit: 25 });
        expect(result.status).toBe("READY");
        expect(result.total).toBe(125);
    });
});
