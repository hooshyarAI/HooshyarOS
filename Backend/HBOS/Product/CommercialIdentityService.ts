import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { SecurityLayerEngine } from "../Engines/SecurityLayerEngine";
import { UserManagementEngine } from "../Engines/UserManagementEngine";
import { OrganizationModelEngine } from "../Engines/OrganizationModelEngine";
import { SQLiteIdentityStore } from "./SQLiteIdentityStore";
import type { CommercialPermission, CommercialRole, CommercialSession, IdentityAuditEvent } from "./Contracts/CommercialIdentityContract";

const permissions: Record<CommercialRole, ReadonlySet<CommercialPermission>> = {
    OWNER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS"]),
    ADMIN: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS"]),
    MANAGER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION"]),
    VIEWER: new Set(["READ_DASHBOARD"])
};

function defaultDatabasePath(): string {
    const configured = process.env.HOOSHYAR_DB_PATH?.trim();
    if (configured) return configured;
    const dataDirectory = process.env.HOOSHYAR_DATA_DIR?.trim() || resolve(".hooshyar", "data");
    return resolve(dataDirectory, "hooshyar.sqlite");
}

export class CommercialIdentityService {
    private readonly security = new SecurityLayerEngine();
    private readonly users = new UserManagementEngine();
    private readonly organizations = new OrganizationModelEngine();
    private readonly identityStore: SQLiteIdentityStore;

    constructor(databasePath = defaultDatabasePath()) {
        this.identityStore = new SQLiteIdentityStore({ databasePath });
    }

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

        this.identityStore.saveSession(session);
        this.identityStore.appendAuditEvent({
            type: "SESSION_CREATED",
            username: session.username,
            organization: session.organization,
            createdAt: session.createdAt
        });
        return { ...session };
    }

    getSession(token: string | undefined): CommercialSession | null {
        if (!token) return null;
        const session = this.identityStore.getSession(token.trim());
        return session?.active ? { ...session } : null;
    }

    authorize(token: string | undefined, organization: string, permission: CommercialPermission): CommercialSession {
        const session = this.getSession(token);
        const normalizedOrganization = organization?.trim() ?? "";
        if (!session || session.organization !== normalizedOrganization || !permissions[session.role].has(permission)) {
            if (session) {
                this.identityStore.appendAuditEvent({
                    type: "AUTHORIZATION_DENIED",
                    username: session.username,
                    organization: normalizedOrganization,
                    permission,
                    createdAt: new Date().toISOString()
                });
            }
            throw new Error("AUTHORIZATION_DENIED");
        }

        this.identityStore.appendAuditEvent({
            type: "AUTHORIZATION_ALLOWED",
            username: session.username,
            organization: session.organization,
            permission,
            createdAt: new Date().toISOString()
        });
        return session;
    }

    logout(token: string | undefined): boolean {
        if (!token) return false;
        const session = this.identityStore.getSession(token.trim());
        if (!session?.active) return false;
        const revoked = this.identityStore.revokeSession(token.trim());
        if (revoked) {
            this.identityStore.appendAuditEvent({
                type: "SESSION_REVOKED",
                username: session.username,
                organization: session.organization,
                createdAt: new Date().toISOString()
            });
        }
        return revoked;
    }

    auditTrail(): IdentityAuditEvent[] {
        return this.identityStore.auditTrail().map(event => ({ ...event }));
    }

    close(): void {
        this.identityStore.close();
    }
}
