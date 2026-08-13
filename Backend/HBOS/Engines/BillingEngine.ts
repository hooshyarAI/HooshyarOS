import { createHmac, timingSafeEqual } from "node:crypto";
import { Engine } from "../Core/Engine";

export interface BillingPlan { id: string; name: string; monthlyLimit: number; features: string[]; }
export interface Entitlement { organizationId: string; planId: string; active: boolean; expiresAt: number | null; }

/** Canonical billing/subscription boundary. Provider activation remains external. */
export class BillingEngine implements Engine {
    name = "BillingEngine";
    readonly plans: BillingPlan[] = [
        { id: "starter", name: "Starter", monthlyLimit: 100, features: ["dashboard", "reports", "assistant"] },
        { id: "professional", name: "Professional", monthlyLimit: 1000, features: ["dashboard", "reports", "assistant", "decision-center", "kpi"] },
        { id: "enterprise", name: "Enterprise", monthlyLimit: 10000, features: ["dashboard", "reports", "assistant", "decision-center", "kpi", "organization-controls"] }
    ];

    initialize(): void {}
    health(): boolean { return true; }

    entitlement(organizationId: string, planId = "starter", expiresAt: number | null = null): Entitlement | null {
        if (!organizationId?.trim() || !this.plans.some(plan => plan.id === planId)) return null;
        return { organizationId: organizationId.trim(), planId, active: expiresAt === null || expiresAt > Date.now(), expiresAt };
    }

    allows(entitlement: Entitlement | null, feature: string): boolean {
        if (!entitlement?.active) return false;
        const plan = this.plans.find(item => item.id === entitlement.planId);
        return Boolean(plan?.features.includes(feature));
    }

    verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
        if (!rawBody || !signature || !secret) return false;
        const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
        const left = Buffer.from(expected, "utf8");
        const right = Buffer.from(signature, "utf8");
        return left.length === right.length && timingSafeEqual(left, right);
    }
}
