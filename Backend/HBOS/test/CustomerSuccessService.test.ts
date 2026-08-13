import { CustomerSuccessService } from "../Product/CustomerSuccessService";

describe("CustomerSuccessService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CustomerSuccessService();
        expect(service.capabilityId).toBe("product.customer-success");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("evaluates the declared product evidence", () => {
        const result = new CustomerSuccessService().evaluate("adoption=4;value=5;risk=2");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBe(11);
    });

    it("blocks empty evidence input", () => {
        expect(new CustomerSuccessService().evaluate(" ").status).toBe("BLOCKED");
    });
});
