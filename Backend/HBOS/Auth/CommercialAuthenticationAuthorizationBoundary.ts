import {
    CommercialIdentityService,
    CommercialPermission,
    CommercialRole,
    CommercialSession,
    IdentityAuditEvent
} from "../Product/CommercialIdentityService";

/**
 * Canonical commercial authentication + authorization boundary.
 *
 * This boundary intentionally reuses CommercialIdentityService rather than
 * creating a duplicate identity/security engine.
 */
export class CommercialAuthenticationAuthorizationBoundary {
    name = "CommercialAuthenticationAuthorizationBoundary";

    private readonly identity = new CommercialIdentityService();

    initialize(): void {
        this.identity.initialize();
    }

    createSession(
        username: string,
        organization: string,
        role: CommercialRole = "OWNER"
    ): CommercialSession {
        return this.identity.createSession(username, organization, role);
    }

    getSession(token: string | undefined): CommercialSession | null {
        return this.identity.getSession(token);
    }

    authorize(
        token: string | undefined,
        organization: string,
        permission: CommercialPermission
    ): CommercialSession {
        return this.identity.authorize(token, organization, permission);
    }

    logout(token: string | undefined): boolean {
        return this.identity.logout(token);
    }

    auditTrail(): IdentityAuditEvent[] {
        return this.identity.auditTrail();
    }
}
