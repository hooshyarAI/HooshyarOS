export type CommercialPlan = "TRIAL" | "STARTER" | "BUSINESS" | "ENTERPRISE";

export interface SubscriptionState {
  tenantId: string;
  plan: CommercialPlan;
  active: boolean;
  seats: number;
  expiresAt: string;
}

export interface Entitlement {
  allowed: boolean;
  remaining: number;
  reason: string | null;
}

export interface PaymentProviderBoundary {
  activate(tenantId: string, plan: CommercialPlan): Promise<{ providerReference: string }>;
}

const limits: Record<CommercialPlan, number> = { TRIAL: 3, STARTER: 10, BUSINESS: 100, ENTERPRISE: 1000 };

export class CommercialSubscriptionService {
  constructor(private readonly provider?: PaymentProviderBoundary) {}

  async activate(tenantId: string, plan: CommercialPlan, expiresAt: string): Promise<SubscriptionState> {
    const normalizedTenant = tenantId?.trim() ?? "";
    if (!normalizedTenant) throw new Error("tenant_id_required");
    if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) throw new Error("valid_expiry_required");
    if (this.provider) await this.provider.activate(normalizedTenant, plan);
    return { tenantId: normalizedTenant, plan, active: true, seats: 0, expiresAt };
  }

  entitlement(state: SubscriptionState, usage: number): Entitlement {
    if (!state.active) return { allowed: false, remaining: 0, reason: "SUBSCRIPTION_INACTIVE" };
    if (Date.parse(state.expiresAt) <= Date.now()) return { allowed: false, remaining: 0, reason: "SUBSCRIPTION_EXPIRED" };
    const remaining = Math.max(0, limits[state.plan] - usage);
    return remaining > 0 ? { allowed: true, remaining, reason: null } : { allowed: false, remaining: 0, reason: "PLAN_LIMIT_REACHED" };
  }

  planLimit(plan: CommercialPlan): number { return limits[plan]; }
}
