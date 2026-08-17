import { evaluateCustomerLifecycleHealth } from "./CustomerLifecycleHealth";

describe("Customer lifecycle health", () => {
    const healthy = {
        subscriptionActive: true,
        securityIsolationVerified: true,
        productReadinessVerified: true,
        valueProven: true,
        usageScore: 80,
        activeCapabilities: 4,
    };

    it("marks a customer healthy when value and usage are confirmed", () => {
        expect(evaluateCustomerLifecycleHealth(healthy)).toEqual({
            health: "HEALTHY",
            reason: "VALUE_AND_USAGE_CONFIRMED",
        });
    });

    it("marks insufficient value or usage as at risk", () => {
        const result = evaluateCustomerLifecycleHealth({
            ...healthy,
            valueProven: false,
        });
        expect(result.health).toBe("AT_RISK");
        expect(result.reason).toBe("VALUE_OR_USAGE_INSUFFICIENT");
    });

    it("fails closed when readiness is not verified", () => {
        const result = evaluateCustomerLifecycleHealth({
            ...healthy,
            securityIsolationVerified: false,
        });
        expect(result.health).toBe("INSUFFICIENT_EVIDENCE");
        expect(result.reason).toBe("READINESS_NOT_VERIFIED");
    });
});
