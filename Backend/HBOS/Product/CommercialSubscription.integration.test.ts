import { CommercialTrialPolicy } from "../Autonomous/Commercial/CommercialTrialPolicy";
import { CommercialSubscriptionService, PaymentProviderBoundary } from "./CommercialSubscriptionService";

describe("Commercial subscription integration", () => {
  test("connects trial policy, tenant entitlement, and explicit provider activation boundary", async () => {
    const calls: string[] = [];
    const provider: PaymentProviderBoundary = { activate: async (tenantId, plan) => { calls.push(`${tenantId}:${plan}`); return { providerReference: "provider-ref" }; } };
    const trial = new CommercialTrialPolicy().evaluate({ initialDays: 30 });
    const service = new CommercialSubscriptionService(provider);
    const state = await service.activate("tenant-commercial", "TRIAL", "2099-01-01T00:00:00.000Z");
    const entitlement = service.entitlement(state, 2);

    expect(trial.durationDays).toBe(30);
    expect(state.plan).toBe("TRIAL");
    expect(entitlement.allowed).toBe(true);
    expect(entitlement.remaining).toBe(1);
    expect(calls).toEqual(["tenant-commercial:TRIAL"]);
  });
});
