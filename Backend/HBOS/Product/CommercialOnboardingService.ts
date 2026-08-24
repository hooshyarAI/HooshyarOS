import { CommercialIdentityService } from "./CommercialIdentityService";
import { evaluateCustomerLifecycleHealth, CustomerHealth } from "../Autonomous/Analyzer/CustomerLifecycleHealth";
import { evaluateProofOfValueCycle } from "../Autonomous/Analyzer/ProofOfValueCycle";
import type { TrialValueMeasurement } from "../Autonomous/Analyzer/TrialValueMeasurement";

export interface CommercialOnboardingInput {
  username: string;
  organization: string;
  role?: "OWNER" | "ADMIN" | "MANAGER" | "VIEWER";
  subscriptionActive: boolean;
  securityIsolationVerified: boolean;
  productReadinessVerified: boolean;
  usageScore: number;
  activeCapabilities: number;
  valueMeasurement: TrialValueMeasurement;
}

export interface CommercialOnboardingResult {
  tenantId: string;
  token: string;
  valueProven: boolean;
  health: CustomerHealth;
  ready: boolean;
}

export class CommercialOnboardingService {
  constructor(private readonly identity: CommercialIdentityService) {}

  onboard(input: CommercialOnboardingInput): CommercialOnboardingResult {
    const session = this.identity.createSession(input.username, input.organization, input.role ?? "OWNER");
    const value = evaluateProofOfValueCycle(input.valueMeasurement);
    const health = evaluateCustomerLifecycleHealth({
      subscriptionActive: input.subscriptionActive,
      securityIsolationVerified: input.securityIsolationVerified,
      productReadinessVerified: input.productReadinessVerified,
      valueProven: value.outcome === "VALUE_PROVEN",
      usageScore: input.usageScore,
      activeCapabilities: input.activeCapabilities,
    });

    return {
      tenantId: session.tenantId,
      token: session.token,
      valueProven: value.outcome === "VALUE_PROVEN",
      health: health.health,
      ready: health.health === "HEALTHY",
    };
  }
}
