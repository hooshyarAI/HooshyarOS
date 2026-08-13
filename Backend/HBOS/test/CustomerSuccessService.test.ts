import { CustomerSuccessService } from "../Product/CustomerSuccessService";

describe("CustomerSuccessService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new CustomerSuccessService();
        expect(service.capabilityId).toBe("repair-product.customer-success");
        expect(service.targetEngine).toBe("Organizational Intelligence Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("evaluates the declared product evidence", () => {
        const result = new CustomerSuccessService().evaluate("evidence=ready;scope=defined");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new CustomerSuccessService().evaluate(" ").status).toBe("BLOCKED");
    });
});
