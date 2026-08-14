import { PlatformSurfaceStandard, PlatformSurfaceContract } from "../Architecture/Standards/PlatformSurfaceStandard";

describe("PlatformSurfaceStandard", () => {
    const valid: PlatformSurfaceContract = {
        surface: "WEB",
        environment: "PRODUCTION",
        apiContractVersion: "v1",
        usesPublicApiBoundary: true,
        serverSideAuthorization: true,
        embedsSecrets: false,
        includesDevelopmentArtifacts: false,
        hasCorrelationId: true,
        hasBoundedTimeouts: true,
        hasSafeClientErrors: true,
        hasArtifactVerification: true,
    };

    it("allows a governed production surface", () => {
        const result = new PlatformSurfaceStandard().validate(valid);
        expect(result.allowed).toBe(true);
        expect(result.failures).toEqual([]);
    });

    it("rejects security and packaging boundary violations", () => {
        const result = new PlatformSurfaceStandard().validate({
            ...valid,
            usesPublicApiBoundary: false,
            serverSideAuthorization: false,
            embedsSecrets: true,
            includesDevelopmentArtifacts: true,
            hasArtifactVerification: false,
        });

        expect(result.allowed).toBe(false);
        expect(result.failures).toEqual([
            "public-api-boundary-required",
            "server-side-authorization-required",
            "embedded-secrets-forbidden",
            "development-artifacts-forbidden",
            "artifact-verification-required",
        ]);
    });

    it("requires operational communication controls", () => {
        const result = new PlatformSurfaceStandard().validate({
            ...valid,
            apiContractVersion: "",
            hasCorrelationId: false,
            hasBoundedTimeouts: false,
            hasSafeClientErrors: false,
        });

        expect(result.allowed).toBe(false);
        expect(result.failures).toEqual([
            "api-contract-version-required",
            "correlation-id-required",
            "bounded-timeouts-required",
            "safe-client-errors-required",
        ]);
    });
});
