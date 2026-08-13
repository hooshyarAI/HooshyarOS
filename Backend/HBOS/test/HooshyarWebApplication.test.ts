import { HooshyarWebApp } from "../../../Frontend/HooshyarWebApp";

describe("HooshyarWebApp", () => {
    it("exposes the canonical product boundary", () => {
        const app = new HooshyarWebApp();
        expect(app.capabilityId).toBe("product.web-application-shell");
        expect(app.targetEngine).toBe("Assistant Engine");
        expect(app.initialize().status).toBe("READY");
    });

    it("builds a deterministic commercial navigation surface", () => {
        expect(new HooshyarWebApp().navigation()).toEqual([
            "dashboard",
            "financial",
            "reports",
            "decisions",
            "alerts",
        ]);
    });

    it("accepts supported routes and rejects unknown routes", () => {
        const app = new HooshyarWebApp();
        expect(app.execute(" dashboard ")).toMatchObject({ status: "READY", path: "dashboard" });
        expect(app.execute("unknown").status).toBe("BLOCKED");
    });
});
