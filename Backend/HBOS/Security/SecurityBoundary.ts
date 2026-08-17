import { AuthenticationService } from "./AuthenticationService";
import { AuthorizationService } from "./AuthorizationService";
import { DurableAuthorizationStore } from "./DurableAuthorizationStore";
import { SecurityAuditStore } from "./SecurityAuditStore";

export class SecurityBoundary {
    constructor(
        private readonly authentication: AuthenticationService,
        private readonly authorization: AuthorizationService,
        private readonly assignments: DurableAuthorizationStore,
        private readonly audit: SecurityAuditStore
    ) {}

    login(username: string, password: string): { userId: string; token: string; expiresAt: string } | null {
        const result = this.authentication.login(username, password);
        if (!result) {
            this.audit.record({ type: "LOGIN_FAILURE", subject: username });
            return null;
        }
        this.audit.record({ type: "LOGIN_SUCCESS", subject: result.userId, sessionHash: result.tokenHash });
        return result;
    }

    authorize(token: string, permission: string): boolean {
        const session = this.authentication.authenticate(token);
        if (!session) return false;
        const assignment = this.assignments.getAssignment(session.userId);
        const allowed = this.authorization.isAllowed({ userId: session.userId, roles: assignment.roles }, permission);
        if (!allowed) {
            this.audit.record({ type: "AUTHORIZATION_DENIED", subject: session.userId, permission });
        }
        return allowed;
    }

    logout(token: string): void {
        const session = this.authentication.authenticate(token);
        this.authentication.logout(token);
        this.audit.record({ type: "LOGOUT", subject: session?.userId ?? "unknown" });
    }
}
