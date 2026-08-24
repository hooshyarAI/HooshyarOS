import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommercialOfflineOnlineService } from "./CommercialOfflineOnlineService";
import { CommercialOnboardingService } from "./CommercialOnboardingService";
import { CommercialSubscriptionService } from "./CommercialSubscriptionService";
import { CommercialIdentityService } from "./CommercialIdentityService";

describe("Commercial completion application flow", () => {
  test("connects subscription, onboarding, and offline-online operation for one tenant", async () => {
    const root = await mkdtemp(join(tmpdir(), "hooshyar-commercial-application-"));
    const identity = new CommercialIdentityService(join(root, "identity.sqlite"));
    try {
      identity.initialize();
      const subscription = await new CommercialSubscriptionService().activate("tenant-app", "BUSINESS", "2099-01-01T00:00:00.000Z");
      const entitlement = new CommercialSubscriptionService().entitlement(subscription, 1);
      const onboarding = new CommercialOnboardingService(identity).onboard({
        username: "application-owner",
        organization: "application-org",
        subscriptionActive: entitlement.allowed,
        securityIsolationVerified: true,
        productReadinessVerified: true,
        usageScore: 80,
        activeCapabilities: 3,
        valueMeasurement: { processedItems: 10, successfulExtractions: 10, manualEntriesAvoided: 4, validationIssuesDetected: 0, reconciliationIssuesDetected: 0, estimatedMinutesSaved: 45 },
      });
      const offline = new CommercialOfflineOnlineService();
      const delivered: string[] = [];
      offline.setOnline(false);
      offline.submit({ id: "app-1", tenantId: onboarding.tenantId, type: "INGEST", payload: { amount: 100 } }, op => delivered.push(op.id));
      offline.setOnline(true);
      const replay = offline.replay(op => delivered.push(op.id));

      expect(entitlement.allowed).toBe(true);
      expect(onboarding.ready).toBe(true);
      expect(onboarding.tenantId).toBe(identity.getSession(onboarding.token)?.tenantId);
      expect(replay).toEqual({ replayed: 1, remaining: 0 });
      expect(delivered).toEqual(["app-1"]);
    } finally {
      identity.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
