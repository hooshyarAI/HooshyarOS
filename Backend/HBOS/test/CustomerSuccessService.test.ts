import { CustomerSuccessService } from "../Product/CustomerSuccessService";

describe("CustomerSuccessService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CustomerSuccessService();
        expect(service.capabilityId).toBe("product.customer-success");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new CustomerSuccessService().execute("continue").status).toBe("READY");
        expect(new CustomerSuccessService().execute(" ").status).toBe("BLOCKED");
    });
});
