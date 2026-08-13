import { AdminAndMobileSurfaces } from "../../../Frontend/HooshyarWebApp/AdminAndMobileSurfaces";

describe("AdminAndMobileSurfaces", () => {
    it("exposes the canonical product boundary", () => {
        const service = new AdminAndMobileSurfaces();
        expect(service.capabilityId).toBe("product.mobile-and-admin-surfaces");
        expect(service.targetEngine).toBe("Assistant Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("validates mobile and administration surfaces", () => {
        const result = new AdminAndMobileSurfaces().validate("mobile=ready;admin=ready");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new AdminAndMobileSurfaces().validate(" ").status).toBe("BLOCKED");
    });
});
