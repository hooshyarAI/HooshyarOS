export type PlatformEnvironment = "DEV" | "TEST" | "STAGING" | "PRODUCTION";
export type PlatformSurface = "WEB" | "DASHBOARD" | "WINDOWS" | "ANDROID";

export interface PlatformSurfaceContract {
    surface: PlatformSurface;
    environment: PlatformEnvironment;
    apiContractVersion: string;
    usesPublicApiBoundary: boolean;
    serverSideAuthorization: boolean;
    embedsSecrets: boolean;
    includesDevelopmentArtifacts: boolean;
    hasCorrelationId: boolean;
    hasBoundedTimeouts: boolean;
    hasSafeClientErrors: boolean;
    hasArtifactVerification: boolean;
}

export interface PlatformSurfaceValidation {
    allowed: boolean;
    failures: string[];
}

/**
 * Machine-checkable product-surface contract.
 * Governance remains authoritative; this class only enforces explicit invariants.
 */
export class PlatformSurfaceStandard {
    validate(input: PlatformSurfaceContract): PlatformSurfaceValidation {
        const failures: string[] = [];

        if (!input.apiContractVersion.trim()) failures.push("api-contract-version-required");
        if (!input.usesPublicApiBoundary) failures.push("public-api-boundary-required");
        if (!input.serverSideAuthorization) failures.push("server-side-authorization-required");
        if (input.embedsSecrets) failures.push("embedded-secrets-forbidden");
        if (input.includesDevelopmentArtifacts) failures.push("development-artifacts-forbidden");
        if (!input.hasCorrelationId) failures.push("correlation-id-required");
        if (!input.hasBoundedTimeouts) failures.push("bounded-timeouts-required");
        if (!input.hasSafeClientErrors) failures.push("safe-client-errors-required");
        if (!input.hasArtifactVerification) failures.push("artifact-verification-required");

        return { allowed: failures.length === 0, failures };
    }
}
