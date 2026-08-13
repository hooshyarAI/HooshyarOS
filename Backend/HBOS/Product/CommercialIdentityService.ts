import { randomUUID } from "node:crypto";
import { SecurityLayerEngine } from "../Engines/SecurityLayerEngine";
import { UserManagementEngine } from "../Engines/UserManagementEngine";
import { OrganizationModelEngine } from "../Engines/OrganizationModelEngine";

export type CommercialRole = "OWNER" | "ADMIN" | "MANAGER" | "VIEWER";
export type CommercialPermission = "READ_DASHBOARD" | "INGEST_DATA" | "CREATE_DECISION" | "MANAGE_USERS";

export interface CommercialSession {
    token: string;
    username: string;
    organization: string;
    tenantId: string;
    role: CommercialRole;
    createdAt: string;
    active: boolean;
}

export interface IdentityAuditEvent {
    type: "SESSION_CREATED" | "SESSION_REVOKED" | "AUTHORIZATION_ALLOWED" | "AUTHORIZATION_DENIED";
    username: string;
    organization: string;
    permission?: CommercialPermission;
    createdAt: string;
}

const permissions: Record<CommercialRole, ReadonlySet<CommercialPermission>> = {
    OWNER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS"]),
    ADMIN: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS"]),
    MANAGER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION"]),
    VIEWER: new Set(["READ_DASHBOARD"])
};

export class CommercialIdentityService {
    private readonly security = new SecurityLayerEngine();
    private readonly users = new UserManagementEngine();
    private readonly organizations = new OrganizationModelEngine();
    private readonly sessions = new Map<string, CommercialSession>();
    private readonly auditEvents: IdentityAuditEvent[] = [];

    initialize(): void {
        this.security.initialize();
        this.users.initialize();
        this.organizations.initialize();
    }

    createSession(username: string, organization: string, role: CommercialRole = "OWNER"): CommercialSession {
        const normalizedUser = username?.trim() ?? "";
        const normalizedOrganization = organization?.trim() ?? "";
        if (!normalizedUser || !normalizedOrganization) throw new Error("username_and_organization_required");
        if (this.users.registerUser(normalizedUser).status !== "READY") throw new Error("user_registration_blocked");
        if (this.organizations.createOrganization(normalizedOrganization).status !== "READY") throw new Error("organization_registration_blocked");
        if (this.security.authorize(normalizedUser).status !== "READY") throw new Error("authorization_initialization_failed");

        const session: CommercialSession = {
            token: `hs_${randomUUID()}`,
            username: normalizedUser,
            organization: normalizedOrganization,
            tenantId: `tenant-${Buffer.from(normalizedOrganization, "utf8").toString("hex")}`,
            role,
            createdAt: new Date().toISOString(),
            active: true
        };
        this.sessions.set(session.token, session);
        this.auditEvents.push({ type: "SESSION_CREATED", username: session.username, organization: session.organization, createdAt: session.createdAt });
        return { ...session };
    }

    getSession(token: string | undefined): CommercialSession | null {
        if (!token) return null;
        const session = this.sessions.get(token.trim());
        return session?.active ? { ...session } : null;
    }

    authorize(token: string | undefined, organization: string, permission: CommercialPermission): CommercialSession {
        const session = this.getSession(token);
        const normalizedOrganization = organization?.trim() ?? "";
        if (!session || session.organization !== normalizedOrganization || !permissions[session.role].has(permission)) {
            if (session) this.auditEvents.push({ type: "AUTHORIZATION_DENIED", username: session.username, organization: normalizedOrganization, permission, createdAt: new Date().toISOString() });
            throw new Error("AUTHORIZATION_DENIED");
        }
        this.auditEvents.push({ type: "AUTHORIZATION_ALLOWED", username: session.username, organization: session.organization, permission, createdAt: new Date().toISOString() });
        return session;
    }

    logout(token: string | undefined): boolean {
        if (!token) return false;
        const session = this.sessions.get(token.trim());
        if (!session || !session.active) return false;
        session.active = false;
        this.auditEvents.push({ type: "SESSION_REVOKED", username: session.username, organization: session.organization, createdAt: new Date().toISOString() });
        return true;
    }

    auditTrail(): IdentityAuditEvent[] {
        return this.auditEvents.map(event => ({ ...event }));
    }
}
