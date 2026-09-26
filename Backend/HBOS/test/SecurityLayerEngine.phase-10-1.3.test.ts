import { SecurityLayerEngine, RetentionEnforcementResult, RetentionClassificationResult } from "../Engines/SecurityLayerEngine";
import { RecordRetentionMetadata } from "../Entities/RetentionPolicy";

describe("SecurityLayerEngine Phase 10-1.3 — Retention Enforcement and Classification", () => {
    const engine = new SecurityLayerEngine();

    beforeEach(() => {
        engine.initialize();
    });

    describe("enforceRetention(recordCreatedAt, recordType, tenantId, store)", () => {
        it("returns canDelete=true when store permits deletion", () => {
            const store = {
                checkRetention: jest.fn().mockReturnValue({ canDelete: true, reason: "Max retention exceeded", legalHoldActive: false })
            };
            const result = engine.enforceRetention("2024-01-01T00:00:00Z", "AUDIT_EVENT", "tenant-1", store as any);
            expect(result.canDelete).toBe(true);
            expect(result.legalHoldActive).toBe(false);
        });

        it("returns canDelete=false with legal hold active", () => {
            const store = {
                checkRetention: jest.fn().mockReturnValue({ canDelete: false, reason: "Legal hold active", legalHoldActive: true, daysUntilDeletion: 365 })
            };
            const result = engine.enforceRetention("2024-01-01T00:00:00Z", "SECURITY_EVENT", "tenant-1", store as any);
            expect(result.canDelete).toBe(false);
            expect(result.legalHoldActive).toBe(true);
            expect(result.daysUntilDeletion).toBe(365);
        });

        it("returns canDelete=false with minimum retention not met", () => {
            const store = {
                checkRetention: jest.fn().mockReturnValue({ canDelete: false, reason: "Minimum retention not met", daysUntilDeletion: 10, legalHoldActive: false })
            };
            const result = engine.enforceRetention("2025-01-01T00:00:00Z", "DECISION_EVENT", undefined, store as any);
            expect(result.canDelete).toBe(false);
            expect(result.daysUntilDeletion).toBe(10);
        });

        it("propagates sensitivity from classifyData based on recordType", () => {
            const store = {
                checkRetention: jest.fn().mockReturnValue({ canDelete: false, reason: "Within window", legalHoldActive: false })
            };
            const result = engine.enforceRetention("2024-01-01T00:00:00Z", "PII", "tenant-1", store as any);
            expect(result.sensitivity).toBe("SENSITIVE");
        });

        it("propagates reason from store result", () => {
            const store = {
                checkRetention: jest.fn().mockReturnValue({ canDelete: false, reason: "Custom retention rule", legalHoldActive: false })
            };
            const result = engine.enforceRetention("2024-01-01T00:00:00Z", "PROJECT_DATA", undefined, store as any);
            expect(result.reason).toBe("Custom retention rule");
        });
    });

    describe("classifyDataForRetention(hint, recordType)", () => {
        it("classifies PII hint as SENSITIVE with maximum retention recommendation", () => {
            const result = engine.classifyDataForRetention("customer PII records", "AUDIT_EVENT");
            expect(result.classified).toBe(true);
            expect(result.sensitivity).toBe("SENSITIVE");
            expect(result.retentionRecommendation).toContain("Maximum retention required");
        });

        it("classifies financial hint as CONFIDENTIAL with extended retention recommendation", () => {
            const result = engine.classifyDataForRetention("financial statements", "DECISION_EVENT");
            expect(result.classified).toBe(true);
            expect(result.sensitivity).toBe("CONFIDENTIAL");
            expect(result.retentionRecommendation).toContain("Extended retention");
        });

        it("classifies non-sensitive hint as INTERNAL with standard retention recommendation", () => {
            const result = engine.classifyDataForRetention("internal memo", "PROJECT_DATA");
            expect(result.classified).toBe(true);
            expect(result.sensitivity).toBe("INTERNAL");
            expect(result.retentionRecommendation).toContain("Standard retention");
        });

        it("classifies no hint as INTERNAL with standard retention recommendation", () => {
            const result = engine.classifyDataForRetention(undefined, "PUBLIC_DATA");
            expect(result.classified).toBe(false);
            expect(result.sensitivity).toBe("INTERNAL");
            expect(result.retentionRecommendation).toContain("Standard retention");
        });

        it("propagates reason from classifyData", () => {
            const result = engine.classifyDataForRetention("credentials", "SECURITY_EVENT");
            expect(result.reason).toBe("Data classified as SENSITIVE based on hint: CREDENTIAL");
        });
    });

    describe("buildRetentionMetadata(sensitivity, createdAt, policyId)", () => {
        it("builds metadata for SENSITIVE with +365 days", () => {
            const metadata = engine.buildRetentionMetadata("SENSITIVE", "2024-01-01T00:00:00Z", "POL-1");
            expect(metadata.createdAt).toBe("2024-01-01T00:00:00Z");
            expect(metadata.retentionPolicyId).toBe("POL-1");
            expect(metadata.legalHold).toBe(false);
            expect(metadata.deletableAfter).toBe("2024-12-31T00:00:00.000Z");
        });

        it("builds metadata for CONFIDENTIAL with +180 days", () => {
            const metadata = engine.buildRetentionMetadata("CONFIDENTIAL", "2024-06-01T00:00:00Z");
            expect(metadata.deletableAfter).toBe("2024-11-28T00:00:00.000Z");
        });

        it("builds metadata for INTERNAL with +90 days", () => {
            const metadata = engine.buildRetentionMetadata("INTERNAL", "2024-06-01T00:00:00Z", "POL-2");
            expect(metadata.deletableAfter).toBe("2024-08-30T00:00:00.000Z");
        });

        it("builds metadata for PUBLIC with +30 days", () => {
            const metadata = engine.buildRetentionMetadata("PUBLIC", "2024-06-01T00:00:00Z");
            expect(metadata.deletableAfter).toBe("2024-07-01T00:00:00.000Z");
        });

        it("defaults to +30 days for unknown sensitivity and allows undefined policyId", () => {
            const metadata = engine.buildRetentionMetadata("UNKNOWN", "2024-06-01T00:00:00Z");
            expect(metadata.retentionPolicyId).toBeUndefined();
            expect(metadata.deletableAfter).toBe("2024-07-01T00:00:00.000Z");
        });
    });
});
