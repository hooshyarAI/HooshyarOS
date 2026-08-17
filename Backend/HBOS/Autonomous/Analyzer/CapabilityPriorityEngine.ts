export interface CapabilityPriorityInput {
    capability: string;
    businessImpact: number;
    customerRisk: number;
    securityRisk: number;
    dependencyCriticality: number;
    evidenceGap: number;
    implementationCost: number;
}

export interface CapabilityPriorityResult {
    capability: string;
    score: number;
    priority: "P0" | "P1" | "P2" | "P3";
}

function clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
}

export function calculateCapabilityPriority(input: CapabilityPriorityInput): CapabilityPriorityResult {
    const benefitRisk =
        input.businessImpact * 0.25 +
        input.customerRisk * 0.20 +
        input.securityRisk * 0.20 +
        input.dependencyCriticality * 0.15 +
        input.evidenceGap * 0.15;

    const costPenalty = input.implementationCost * 0.05;
    const score = clamp(benefitRisk - costPenalty);

    const priority: CapabilityPriorityResult["priority"] =
        score >= 80 ? "P0" : score >= 60 ? "P1" : score >= 35 ? "P2" : "P3";

    return { capability: input.capability, score, priority };
}
