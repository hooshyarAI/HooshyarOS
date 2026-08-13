import { HooshyarWebApp } from "../../../Frontend/HooshyarWebApp";

describe("HooshyarWebApp", () => {
    it("exposes the canonical product boundary", () => {
        const service = new HooshyarWebApp();
        expect(service.capabilityId).toBe("product.web-application-shell");
        expect(service.targetEngine).toBe("Assistant Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new HooshyarWebApp().execute("continue").status).toBe("READY");
        expect(new HooshyarWebApp().execute(" ").status).toBe("BLOCKED");
    });
});
