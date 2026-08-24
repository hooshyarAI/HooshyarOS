import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommercialIdentityService } from "./CommercialIdentityService";
import { CommercialOnboardingService } from "./CommercialOnboardingService";

describe("Commercial onboarding integration", () => {
  test("connects tenant identity, proof-of-value, and lifecycle health", async () => {
    const root = await mkdtemp(join(tmpdir(), "hooshyar-onboarding-integration-"));
    const identity = new CommercialIdentityService(join(root, "identity.sqlite"));
    try {
      identity.initialize();
      const result = new CommercialOnboardingService(identity).onboard({
        username: "integration-owner",
        organization: "integration-org",
        subscriptionActive: true,
        securityIsolationVerified: true,
        productReadinessVerified: true,
        usageScore: 60,
        activeCapabilities: 2,
        valueMeasurement: {
          processedItems: 5,
          successfulExtractions: 5,
          manualEntriesAvoided: 2,
          validationIssuesDetected: 1,
          reconciliationIssuesDetected: 0,
          estimatedMinutesSaved: 20,
        },
      });

      expect(identity.getSession(result.token)?.tenantId).toBe(result.tenantId);
      expect(result.valueProven).toBe(true);
      expect(result.health).toBe("HEALTHY");
    } finally {
      identity.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
