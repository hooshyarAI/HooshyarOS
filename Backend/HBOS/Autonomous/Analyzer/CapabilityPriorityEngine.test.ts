import { calculateCapabilityPriority } from "./CapabilityPriorityEngine";

describe("Capability priority engine", () => {
    it("prioritizes security-critical high-impact gaps", () => {
        const result = calculateCapabilityPriority({
            capability: "Tenant Isolation",
            businessImpact: 90,
            customerRisk: 100,
            securityRisk: 100,
            dependencyCriticality: 90,
            evidenceGap: 100,
            implementationCost: 20,
        });

        expect(result.priority).toBe("P0");
        expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("does not let implementation cost dominate critical risk", () => {
        const result = calculateCapabilityPriority({
            capability: "Customer Data Boundary",
            businessImpact: 90,
            customerRisk: 100,
            securityRisk: 100,
            dependencyCriticality: 80,
            evidenceGap: 100,
            implementationCost: 100,
        });

        expect(result.priority).toBe("P0");
    });

    it("assigns lower priority to low-impact, low-risk work", () => {
        const result = calculateCapabilityPriority({
            capability: "Cosmetic UI polish",
            businessImpact: 20,
            customerRisk: 0,
            securityRisk: 0,
            dependencyCriticality: 10,
            evidenceGap: 10,
            implementationCost: 50,
        });

        expect(result.priority).toBe("P3");
    });
});
