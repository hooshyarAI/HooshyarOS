import { commercialReady } from "./CommercialReadinessGate";
describe("Commercial readiness gate", () => {
    it("blocks when a production-critical capability is missing", () => {
        expect(commercialReady({ security: true, persistence: true, ingestion: false, tenantIsolation: true, verification: true })).toBe(false);
    });
    it("allows readiness only when all required foundations are verified", () => {
        expect(commercialReady({ security: true, persistence: true, ingestion: true, tenantIsolation: true, verification: true })).toBe(true);
    });
});
