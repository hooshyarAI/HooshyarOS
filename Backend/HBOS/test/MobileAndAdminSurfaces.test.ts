import { AdminAndMobileSurfaces } from "../../../Frontend/HooshyarWebApp/AdminAndMobileSurfaces";

describe("AdminAndMobileSurfaces", () => {
    it("exposes the canonical product boundary", () => {
        const service = new AdminAndMobileSurfaces();
        expect(service.capabilityId).toBe("product.mobile-and-admin-surfaces");
        expect(service.targetEngine).toBe("Assistant Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new AdminAndMobileSurfaces().execute("continue").status).toBe("READY");
        expect(new AdminAndMobileSurfaces().execute(" ").status).toBe("BLOCKED");
    });
});
