import {
    CommercialIdentityService,
    CommercialPermission,
    CommercialSession
} from "./CommercialIdentityService";

export interface CommercialAuthorizationRequest {
    token?: string;
    organization: string;
    permission: CommercialPermission;
    tenantId?: string;
}

export interface CommercialAuthorizationResult {
    allowed: boolean;
    session: CommercialSession | null;
    reason?: "AUTHENTICATION_REQUIRED" | "TENANT_SCOPE_MISMATCH" | "AUTHORIZATION_DENIED";
}

/**
 * Single enforcement boundary for commercial operations.
 * Business/runtime code must use this boundary rather than inspecting sessions directly.
 */
export class CommercialAuthorizationBoundary {
    constructor(private readonly identity: CommercialIdentityService) {}

    authorize(request: CommercialAuthorizationRequest): CommercialAuthorizationResult {
        if (!request.token?.trim()) {
            return { allowed: false, session: null, reason: "AUTHENTICATION_REQUIRED" };
        }

        const session = this.identity.getSession(request.token);
        if (!session) {
            return { allowed: false, session: null, reason: "AUTHORIZATION_DENIED" };
        }
        if (request.tenantId?.trim() && request.tenantId.trim() !== session.tenantId) {
            return { allowed: false, session: null, reason: "TENANT_SCOPE_MISMATCH" };
        }

        try {
            const authorized = this.identity.authorize(
                request.token,
                request.organization,
                request.permission
            );
            return { allowed: true, session: authorized };
        } catch {
            return { allowed: false, session: null, reason: "AUTHORIZATION_DENIED" };
        }
    }
}
