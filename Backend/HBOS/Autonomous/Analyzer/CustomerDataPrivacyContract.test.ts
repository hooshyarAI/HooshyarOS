import {
    CUSTOMER_DATA_ZERO_ACCESS,
    isPlaintextCustomerDataAccessDenied,
} from "./CustomerDataPrivacyContract";

describe("Customer data zero-access contract", () => {
    it("requires encryption and tenant isolation", () => {
        expect(CUSTOMER_DATA_ZERO_ACCESS.encryptionAtRestRequired).toBe(true);
        expect(CUSTOMER_DATA_ZERO_ACCESS.encryptionInTransitRequired).toBe(true);
        expect(CUSTOMER_DATA_ZERO_ACCESS.tenantIsolationRequired).toBe(true);
    });

    it("denies plaintext access to owner, operators, developers, AI and autonomous agents", () => {
        expect(isPlaintextCustomerDataAccessDenied("PLATFORM_OWNER")).toBe(true);
        expect(isPlaintextCustomerDataAccessDenied("PLATFORM_OPERATOR")).toBe(true);
        expect(isPlaintextCustomerDataAccessDenied("DEVELOPER")).toBe(true);
        expect(isPlaintextCustomerDataAccessDenied("AI_MODEL")).toBe(true);
        expect(isPlaintextCustomerDataAccessDenied("AUTONOMOUS_AGENT")).toBe(true);
    });

    it("does not deny the customer actor by this platform-level contract", () => {
        expect(isPlaintextCustomerDataAccessDenied("CUSTOMER_USER")).toBe(false);
    });

    it("requires auditability and prohibits secondary use without authorization", () => {
        expect(CUSTOMER_DATA_ZERO_ACCESS.auditAccessAttempts).toBe(true);
        expect(CUSTOMER_DATA_ZERO_ACCESS.noSecondaryUseWithoutCustomerAuthorization).toBe(true);
    });
});
