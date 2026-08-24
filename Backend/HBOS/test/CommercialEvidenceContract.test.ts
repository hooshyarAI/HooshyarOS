import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("Commercial evidence contract", () => {
  test("does not promote artifact-only commercial layers to completion", () => {
    const result = new CommercialProductCompletionAudit().audit(process.cwd());
    expect(result.completionStates.productComplete).toBe(false);
    expect(result.missingLayers).toEqual(expect.arrayContaining([
      "identity-and-session",
      "authorization-and-tenant",
      "financial-intelligence",
      "executive-intelligence",
      "dashboards-and-reports",
      "security-privacy",
      "subscription-commercial-controls",
      "customer-onboarding"
    ]));
  });

  test("does not treat lower-level evidence as application or acceptance completion", () => {
    const result = new CommercialProductCompletionAudit().audit(process.cwd());
    expect(result.completionStates.productComplete).toBe(false);
    expect(result.completionStates.commercialProductRuntimeComplete).toBe(false);
  });
});
