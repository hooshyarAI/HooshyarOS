import { SubscriptionEntitlementService } from "../Product/SubscriptionEntitlementService";

describe("SubscriptionEntitlementService", () => {
    it("exposes the canonical product boundary", () => {
        const service = new SubscriptionEntitlementService();
        expect(service.capabilityId).toBe("product.commercial-subscription-entitlements");
        expect(service.targetEngine).toBe("Governance Engine");
        expect(service.initialize().status).toBe("READY");
    });

    it("authorizes commercial subscription entitlement evidence", () => {
        const result = new SubscriptionEntitlementService().authorize("plan=annual;tenant=hooshyar;active=true");
        expect(result.status).toBe("READY");
        expect(result.evidence).toBeDefined();
    });

    it("blocks empty evidence input", () => {
        expect(new SubscriptionEntitlementService().authorize(" ").status).toBe("BLOCKED");
    });
});
