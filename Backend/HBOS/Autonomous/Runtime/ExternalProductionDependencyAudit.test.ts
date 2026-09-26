import { ExternalProductionDependencyAudit } from "./ExternalProductionDependencyAudit";

describe("ExternalProductionDependencyAudit", () => {
    const audit = new ExternalProductionDependencyAudit();

    it("blocks both external dependencies without explicit evidence", () => {
        const result = audit.audit({});
        expect(result).toEqual([
            expect.objectContaining({ id: "payment-provider-activation", status: "BLOCKED" }),
            expect.objectContaining({ id: "production-cloud-resources", status: "BLOCKED" })
        ]);
    });

    it("accepts only explicit operator readiness flags and never exposes secrets", () => {
        const result = audit.audit({
            HOOSHYAR_PAYMENT_PROVIDER_ACTIVATED: "1",
            HOOSHYAR_PAYMENT_PROVIDER_HEALTH_URL: "https://payments.example.test/health",
            HOOSHYAR_PRODUCTION_CLOUD_READY: "1",
            HOOSHYAR_PRODUCTION_HEALTH_URL: "https://production.example.test/health",
            HOOSHYAR_PAYMENT_PROVIDER_HEALTH_TOKEN: "secret-value"
        });

        expect(result).toEqual([
            expect.objectContaining({
                id: "payment-provider-activation",
                status: "READY",
                evidence: "explicit-activation-and-health-endpoint-configured"
            }),
            expect.objectContaining({
                id: "production-cloud-resources",
                status: "READY",
                evidence: "explicit-cloud-readiness-and-health-endpoint-configured"
            })
        ]);
        expect(JSON.stringify(result)).not.toContain("secret-value");
    });
});
