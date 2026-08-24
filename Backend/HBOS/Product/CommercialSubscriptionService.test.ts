import { CommercialSubscriptionService } from "./CommercialSubscriptionService";

describe("CommercialSubscriptionService", () => {
  test("activates a tenant subscription and enforces its plan limit", async () => {
    const service = new CommercialSubscriptionService();
    const state = await service.activate("tenant-subscription", "BUSINESS", "2099-01-01T00:00:00.000Z");

    expect(state).toMatchObject({ tenantId: "tenant-subscription", plan: "BUSINESS", active: true });
    expect(service.entitlement(state, 99)).toEqual({ allowed: true, remaining: 1, reason: null });
    expect(service.entitlement(state, 100)).toEqual({ allowed: false, remaining: 0, reason: "PLAN_LIMIT_REACHED" });
    expect(service.planLimit("BUSINESS")).toBe(100);
  });

  test("never treats an expired subscription as entitled", async () => {
    const state = await new CommercialSubscriptionService().activate("tenant-expired", "STARTER", "2000-01-01T00:00:00.000Z");
    expect(new CommercialSubscriptionService().entitlement(state, 0)).toEqual({ allowed: false, remaining: 0, reason: "SUBSCRIPTION_EXPIRED" });
  });
});
