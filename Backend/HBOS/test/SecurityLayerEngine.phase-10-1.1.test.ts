import { SecurityLayerEngine, PolicyEvaluationResult, TenantIsolationVerificationResult, EncryptionBoundaryResult, DataClassificationResult } from "../Engines/SecurityLayerEngine";
import { SecurityContext } from "../Security/SecurityContext";
import { Authorization } from "../Security/Authorization";
import { Principal, PrincipalType } from "../Security/Principals";

describe("SecurityLayerEngine Phase 10-1.1 — Real Security Enforcement", () => {
    const engine = new SecurityLayerEngine();

    beforeEach(() => {
        engine.initialize();
    });

    describe("Backward compatibility: authorize(subject)", () => {
        it("authorizes a valid subject", () => {
            expect(engine.authorize("admin")).toEqual({ subject: "admin", status: "READY" });
        });

        it("blocks an empty subject", () => {
            expect(engine.authorize(" ").status).toBe("BLOCKED");
        });
    });

    describe("evaluatePolicy(context, action, resource)", () => {
        const humanUser = Principal.humanUser("user-1", "tenant-123");
        const context = SecurityContext.forHumanUser(humanUser, [Authorization.READ, Authorization.WRITE]);
        const tenantResource = { tenantId: "tenant-123" as const };

        it("permits when context and resource align", () => {
            const result = engine.evaluatePolicy(context, Authorization.READ, tenantResource);
            expect(result.result).toBe("PERMITTED");
            expect(result.reason).toBe("Policy evaluation passed");
        });

        it("denies when actor is missing", () => {
            const emptyContext = SecurityContext.empty();
            const result = engine.evaluatePolicy(emptyContext, Authorization.READ, tenantResource);
            expect(result.result).toBe("MISSING_CONTEXT");
            expect(result.reason).toContain("No actor");
        });

        it("denies on tenant mismatch", () => {
            const otherTenantResource = { tenantId: "tenant-other" };
            const result = engine.evaluatePolicy(context, Authorization.READ, otherTenantResource);
            expect(result.result).toBe("DENIED");
            expect(result.reason).toContain("Tenant mismatch");
        });

        it("denies when permission is not granted", () => {
            const limitedContext = SecurityContext.forHumanUser(humanUser, [Authorization.READ]);
            const result = engine.evaluatePolicy(limitedContext, Authorization.WRITE, tenantResource);
            expect(result.result).toBe("DENIED");
            expect(result.reason).toContain("not granted");
        });
    });

    describe("verifyTenantIsolation(resource)", () => {
        it("returns isolated=true for tenant-scoped resource", () => {
            const result = engine.verifyTenantIsolation({ tenantId: "tenant-123" });
            expect(result.isolated).toBe(true);
            expect(result.tenantId).toBe("tenant-123");
        });

        it("returns isolated=true for global resource", () => {
            const result = engine.verifyTenantIsolation({});
            expect(result.isolated).toBe(true);
            expect(result.reason).toContain("Global resource");
        });

        it("returns isolated=false for empty tenantId", () => {
            const result = engine.verifyTenantIsolation({ tenantId: "" });
            expect(result.isolated).toBe(false);
            expect(result.reason).toContain("empty tenantId");
        });
    });

    describe("checkEncryptionBoundary(dataType)", () => {
        it("flags PII as requiring encryption", () => {
            const result = engine.checkEncryptionBoundary("user_pii_data");
            expect(result.compliant).toBe(true);
            expect(result.reason).toContain("requires encryption");
        });

        it("marks non-sensitive types as not requiring mandatory encryption", () => {
            const result = engine.checkEncryptionBoundary("public_dashboard_metric");
            expect(result.compliant).toBe(true);
            expect(result.reason).toContain("does not require mandatory encryption");
        });

        it("rejects empty data type", () => {
            const result = engine.checkEncryptionBoundary("");
            expect(result.compliant).toBe(false);
            expect(result.reason).toContain("must be specified");
        });
    });

    describe("classifyData(sensitivityHint)", () => {
        it("classifies PII as SENSITIVE", () => {
            const result = engine.classifyData("customer PII records");
            expect(result.classified).toBe(true);
            expect(result.sensitivity).toBe("SENSITIVE");
        });

        it("classifies no hint as INTERNAL by default", () => {
            const result = engine.classifyData();
            expect(result.classified).toBe(false);
            expect(result.sensitivity).toBe("INTERNAL");
        });

        it("classifies financial data as CONFIDENTIAL", () => {
            const result = engine.classifyData("financial statements");
            expect(result.classified).toBe(true);
            expect(result.sensitivity).toBe("CONFIDENTIAL");
        });
    });

    describe("health()", () => {
        it("returns true when dependent engines are healthy", () => {
            expect(engine.health()).toBe(true);
        });
    });
});
