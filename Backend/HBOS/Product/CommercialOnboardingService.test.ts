import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommercialIdentityService } from "./CommercialIdentityService";
import { CommercialOnboardingService } from "./CommercialOnboardingService";

describe("CommercialOnboardingService", () => {
  test("onboards a tenant when security, readiness, usage, and value evidence are complete", async () => {
    const root = await mkdtemp(join(tmpdir(), "hooshyar-onboarding-"));
    const identity = new CommercialIdentityService(join(root, "identity.sqlite"));
    try {
      identity.initialize();
      const result = new CommercialOnboardingService(identity).onboard({
        username: "owner",
        organization: "سازمان نمونه",
        subscriptionActive: true,
        securityIsolationVerified: true,
        productReadinessVerified: true,
        usageScore: 80,
        activeCapabilities: 3,
        valueMeasurement: {
          processedItems: 10,
          successfulExtractions: 10,
          manualEntriesAvoided: 5,
          validationIssuesDetected: 0,
          reconciliationIssuesDetected: 0,
          estimatedMinutesSaved: 60,
        },
      });

      expect(result.tenantId).toContain("tenant-");
      expect(result.valueProven).toBe(true);
      expect(result.health).toBe("HEALTHY");
      expect(result.ready).toBe(true);
    } finally {
      identity.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
