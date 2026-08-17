import {
    CommercialIdentityService,
    CommercialPermission,
    CommercialSession
} from "./CommercialIdentityService";

export interface CommercialAuthorizationRequest {
    token?: string;
    organization: string;
    permission: CommercialPermission;
}

export interface CommercialAuthorizationResult {
    allowed: boolean;
    session: CommercialSession | null;
    reason?: "AUTHENTICATION_REQUIRED" | "AUTHORIZATION_DENIED";
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

        try {
            const session = this.identity.authorize(
                request.token,
                request.organization,
                request.permission
            );
            return { allowed: true, session };
        } catch {
            return { allowed: false, session: null, reason: "AUTHORIZATION_DENIED" };
        }
    }
}
