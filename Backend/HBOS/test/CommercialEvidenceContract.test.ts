import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("Commercial evidence contract", () => {
  test("does not promote artifact-only commercial layers to completion", () => {
    const result = new CommercialProductCompletionAudit().audit(process.cwd());
    expect(result.completionStates.productComplete).toBe(false);
    expect(result.missingLayers).toEqual(expect.arrayContaining([
      "identity-and-session-evidence",
      "authorization-and-tenant-evidence",
      "financial-intelligence-evidence",
      "executive-intelligence-evidence",
      "dashboard-report-application-evidence",
      "security-privacy-evidence",
      "subscription-commercial-controls-evidence",
      "customer-onboarding-evidence"
    ]));
  });

  test("does not treat lower-level evidence as application or acceptance completion", () => {
    const result = new CommercialProductCompletionAudit().audit(process.cwd());
    expect(result.completionStates.productComplete).toBe(false);
    expect(result.completionStates.commercialProductRuntimeComplete).toBe(false);
  });
});
