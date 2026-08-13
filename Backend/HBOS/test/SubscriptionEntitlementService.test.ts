import { SubscriptionEntitlementService } from "../Product/SubscriptionEntitlementService";

describe("SubscriptionEntitlementService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new SubscriptionEntitlementService();
        expect(service.capabilityId).toBe("product.commercial-subscription-entitlements");
        expect(service.targetEngine).toBe("Governance Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("keeps its deterministic minimal contract", () => {
        expect(new SubscriptionEntitlementService().execute("continue").status).toBe("READY");
        expect(new SubscriptionEntitlementService().execute(" ").status).toBe("BLOCKED");
    });
});
