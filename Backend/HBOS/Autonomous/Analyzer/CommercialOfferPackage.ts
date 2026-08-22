import { CommercialPlan } from "./CommercialOfferPolicy";

export interface CommercialOfferPackageInput {
    customerId: string;
    plan: CommercialPlan;
    monthlyEquivalent: number;
    discountRate: number;
    valueProven: boolean;
    securityIsolationVerified: boolean;
    productReadinessVerified: boolean;
    activeCapabilities: string[];
}

export interface CommercialOfferPackage {
    customerId: string;
    plan: CommercialPlan;
    monthlyEquivalent: number;
    discountRate: number;
    activeCapabilities: string[];
    evidenceBacked: boolean;
    approvalRequired: true;
}

export function buildCommercialOfferPackage(
    input: CommercialOfferPackageInput,
): CommercialOfferPackage | null {
    if (
        !input.customerId ||
        input.monthlyEquivalent <= 0 ||
        input.activeCapabilities.length === 0 ||
        !input.valueProven ||
        !input.securityIsolationVerified ||
        !input.productReadinessVerified
    ) {
        return null;
    }

    return {
        customerId: input.customerId,
        plan: input.plan,
        monthlyEquivalent: input.monthlyEquivalent,
        discountRate: input.discountRate,
        activeCapabilities: [...input.activeCapabilities],
        evidenceBacked: true,
        approvalRequired: true,
    };
}
