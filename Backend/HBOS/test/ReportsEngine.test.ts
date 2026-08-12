import { ReportsEngine } from "../Engines/ReportsEngine";

describe("ReportsEngine", () => {
    it("exposes canonical identity and health", () => {
        const engine = new ReportsEngine();
        expect(engine.name).toBe("ReportsEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability().id).toBe("platform.reports");
    });

    it("builds a report from validated sections", () => {
        const result = new ReportsEngine().build("Monthly report", ["Revenue", "Profit"]);
        expect(result.status).toBe("READY");
        expect(result.sections).toEqual(["Revenue", "Profit"]);
    });
});
