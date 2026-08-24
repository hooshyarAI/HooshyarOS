import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommercialOfflineOnlineService } from "./CommercialOfflineOnlineService";
import { CommercialOnboardingService } from "./CommercialOnboardingService";
import { CommercialSubscriptionService } from "./CommercialSubscriptionService";
import { CommercialIdentityService } from "./CommercialIdentityService";

describe("Commercial completion acceptance", () => {
  test("accepts a tenant only when entitlement, onboarding readiness, and operation replay all succeed", async () => {
    const root = await mkdtemp(join(tmpdir(), "hooshyar-commercial-acceptance-"));
    const identity = new CommercialIdentityService(join(root, "identity.sqlite"));
    try {
      identity.initialize();
      const subscriptionService = new CommercialSubscriptionService();
      const state = await subscriptionService.activate("tenant-acceptance", "BUSINESS", "2099-01-01T00:00:00.000Z");
      const entitlement = subscriptionService.entitlement(state, 0);
      const onboarding = new CommercialOnboardingService(identity).onboard({
        username: "acceptance-owner",
        organization: "acceptance-org",
        subscriptionActive: entitlement.allowed,
        securityIsolationVerified: true,
        productReadinessVerified: true,
        usageScore: 90,
        activeCapabilities: 4,
        valueMeasurement: { processedItems: 20, successfulExtractions: 20, manualEntriesAvoided: 10, validationIssuesDetected: 0, reconciliationIssuesDetected: 0, estimatedMinutesSaved: 120 },
      });
      const offline = new CommercialOfflineOnlineService();
      let delivered = 0;
      offline.setOnline(false);
      offline.submit({ id: "acceptance-1", tenantId: onboarding.tenantId, type: "INGEST", payload: {} }, () => { delivered += 1; });
      offline.setOnline(true);
      const replay = offline.replay(() => { delivered += 1; });

      expect({ entitlement: entitlement.allowed, onboarding: onboarding.ready, replayed: replay.replayed, delivered }).toEqual({ entitlement: true, onboarding: true, replayed: 1, delivered: 1 });
    } finally {
      identity.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
