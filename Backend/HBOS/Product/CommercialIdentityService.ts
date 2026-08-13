import { randomUUID } from "node:crypto";

export type CommercialRole = "OWNER" | "ADMIN" | "USER";
export type CommercialPermission = "READ_DASHBOARD" | "INGEST_DATA" | "CREATE_DECISION";

export interface CommercialSession {
    token: string;
    username: string;
    organization: string;
    tenantId: string;
    role: CommercialRole;
    permissions: CommercialPermission[];
    createdAt: string;
}

export interface SecurityAuditEvent {
    type: "SESSION_CREATED" | "SESSION_REVOKED" | "AUTHORIZATION_DENIED";
    username?: string;
    tenantId?: string;
    permission?: CommercialPermission;
    createdAt: string;
}

export class CommercialIdentityService {
    private readonly sessions = new Map<string, CommercialSession>();
    private readonly auditEvents: SecurityAuditEvent[] = [];
    private initialized = false;

    initialize(): void {
        this.initialized = true;
    }

    health(): boolean {
        return this.initialized;
    }

    createSession(username: string, organization: string, role: CommercialRole = "OWNER"): CommercialSession {
        const normalizedUsername = username?.trim() ?? "";
        const normalizedOrganization = organization?.trim() ?? "";
        if (!normalizedUsername || !normalizedOrganization) {
            throw new Error("username_and_organization_required");
        }
        const token = `hs_${randomUUID().replace(/-/g, "")}`;
        const session: CommercialSession = {
            token,
            username: normalizedUsername,
            organization: normalizedOrganization,
            tenantId: this.tenantIdFor(normalizedOrganization),
            role,
            permissions: this.permissionsFor(role),
            createdAt: new Date().toISOString()
        };
        this.sessions.set(token, session);
        this.auditEvents.push({ type: "SESSION_CREATED", username: session.username, tenantId: session.tenantId, createdAt: session.createdAt });
        return session;
    }

    getSession(token: string | undefined): CommercialSession | null {
        if (!token) return null;
        return this.sessions.get(token) ?? null;
    }

    logout(token: string | undefined): boolean {
        const session = this.getSession(token);
        if (!session) return false;
        this.sessions.delete(session.token);
        this.auditEvents.push({ type: "SESSION_REVOKED", username: session.username, tenantId: session.tenantId, createdAt: new Date().toISOString() });
        return true;
    }

    authorize(token: string | undefined, organization: string, permission: CommercialPermission): CommercialSession {
        const session = this.getSession(token);
        const normalizedOrganization = organization?.trim() ?? "";
        if (!session || !normalizedOrganization || session.tenantId !== this.tenantIdFor(normalizedOrganization) || !session.permissions.includes(permission)) {
            this.auditEvents.push({
                type: "AUTHORIZATION_DENIED",
                username: session?.username,
                tenantId: session?.tenantId,
                permission,
                createdAt: new Date().toISOString()
            });
            throw new Error(session ? "AUTHORIZATION_DENIED" : "INVALID_SESSION");
        }
        return session;
    }

    listAuditEvents(): SecurityAuditEvent[] {
        return [...this.auditEvents];
    }

    private permissionsFor(role: CommercialRole): CommercialPermission[] {
        if (role === "OWNER" || role === "ADMIN") return ["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION"];
        return ["READ_DASHBOARD"];
    }

    private tenantIdFor(organization: string): string {
        return `tenant-${Buffer.from(organization.trim(), "utf8").toString("hex") || "demo"}`;
    }
}
