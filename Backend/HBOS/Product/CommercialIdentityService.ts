import { SecurityLayerEngine } from "../Engines/SecurityLayerEngine";
import { UserManagementEngine, UserRole, SessionRecord } from "../Engines/UserManagementEngine";
import { OrganizationModelEngine } from "../Engines/OrganizationModelEngine";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal } from "../Security/Principals";
import { Authorization, AuthorizationResult } from "../Security/Authorization";

/**
 * Phase 13-1.3 / 13-1.4 — Commercial identity, RBAC and session lifecycle.
 *
 * This service composes the persistent UserManagementEngine and
 * OrganizationModelEngine and owns the commercial permission model. It does not
 * duplicate them: users, password material, organizations and sessions are all
 * persisted by the engines.
 */

export type CommercialRole = UserRole;
export type CommercialPermission = "READ_DASHBOARD" | "INGEST_DATA" | "CREATE_DECISION" | "MANAGE_USERS";

export interface CommercialSession {
    token: string;
    userId: string;
    username: string;
    organization: string;
    tenantId: string;
    role: CommercialRole;
    createdAt: string;
    expiresAt: string;
    active: boolean;
}

export interface IdentityAuditEvent {
    type:
        | "SESSION_CREATED"
        | "SESSION_REVOKED"
        | "SESSION_REFRESHED"
        | "SESSION_EXPIRED"
        | "AUTHENTICATION_SUCCEEDED"
        | "AUTHENTICATION_FAILED"
        | "AUTHORIZATION_ALLOWED"
        | "AUTHORIZATION_DENIED";
    username: string;
    organization: string;
    permission?: CommercialPermission;
    createdAt: string;
}

export interface CommercialLoginResult {
    readonly success: boolean;
    readonly session?: CommercialSession;
    readonly error?: string;
}

const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;

const permissions: Record<CommercialRole, ReadonlySet<CommercialPermission>> = {
    OWNER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS"]),
    ADMIN: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS"]),
    MANAGER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION"]),
    ANALYST: new Set(["READ_DASHBOARD", "INGEST_DATA"]),
    VIEWER: new Set(["READ_DASHBOARD"])
};

/**
 * Commercial permissions are enforced through the canonical security layer:
 * each commercial permission maps to a frozen Security/Authorization action and
 * each role maps to an explicit grant set. AuthorizationGuard then applies
 * deny-by-default and TenantIsolation verifies the tenant boundary.
 */
const PERMISSION_ACTION: Record<CommercialPermission, Authorization> = {
    READ_DASHBOARD: Authorization.READ,
    INGEST_DATA: Authorization.WRITE,
    CREATE_DECISION: Authorization.EXECUTE,
    MANAGE_USERS: Authorization.ADMINISTER
};

const ROLE_AUTHORIZATIONS: Record<CommercialRole, Authorization[]> = {
    OWNER: [Authorization.READ, Authorization.WRITE, Authorization.EXECUTE, Authorization.APPROVE, Authorization.ACCESS_EVIDENCE, Authorization.ADMINISTER],
    ADMIN: [Authorization.READ, Authorization.WRITE, Authorization.EXECUTE, Authorization.APPROVE, Authorization.ACCESS_EVIDENCE, Authorization.ADMINISTER],
    MANAGER: [Authorization.READ, Authorization.WRITE, Authorization.EXECUTE, Authorization.APPROVE, Authorization.ACCESS_EVIDENCE],
    ANALYST: [Authorization.READ, Authorization.WRITE, Authorization.ACCESS_EVIDENCE],
    VIEWER: [Authorization.READ]
};

const toCommercialSession = (session: SessionRecord): CommercialSession => ({
    token: session.token,
    userId: session.userId,
    username: session.username,
    organization: session.organization,
    tenantId: session.tenantId,
    role: session.role,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    active: true
});

export class CommercialIdentityService {
    private readonly security = new SecurityLayerEngine();
    private readonly users: UserManagementEngine;
    private readonly organizations: OrganizationModelEngine;
    private readonly auditEvents: IdentityAuditEvent[] = [];
    private sessionTtlMs: number = DEFAULT_SESSION_TTL_MS;
    private now: () => number = () => Date.now();

    constructor(persistence?: SQLitePersistenceStore, sessionTtlMs: number = DEFAULT_SESSION_TTL_MS) {
        this.sessionTtlMs = sessionTtlMs;
        this.users = new UserManagementEngine(persistence, sessionTtlMs);
        this.organizations = new OrganizationModelEngine(persistence);
    }

    initialize(): void {
        this.security.initialize();
        this.users.initialize();
        this.organizations.initialize();
    }

    setSessionTtl(ttlMs: number): void {
        if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("invalid_session_ttl");
        this.sessionTtlMs = ttlMs;
        this.users.setSessionTtl(ttlMs);
    }

    setNowProvider(provider: () => number): void {
        if (typeof provider !== "function") throw new Error("invalid_now_provider");
        this.now = provider;
        this.users.setNowProvider(provider);
    }

    static async hashPassword(password: string): Promise<string> {
        if (typeof password !== "string" || !password) throw new Error("password_required");
        const { scrypt, randomBytes } = await import("node:crypto");
        return new Promise<string>((resolve, reject) => {
            const salt = randomBytes(16);
            scrypt(password.normalize("NFKC"), salt, 64, (err, derivedKey) => {
                if (err) return reject(err);
                resolve(`scrypt$${salt.toString("hex")}$${Buffer.from(derivedKey).toString("hex")}`);
            });
        });
    }

    static async verifyPassword(password: string, hash: string): Promise<boolean> {
        if (typeof password !== "string" || typeof hash !== "string" || !hash) return false;
        const parts = hash.split("$");
        if (parts.length !== 3 || parts[0] !== "scrypt") return false;
        const { scrypt } = await import("node:crypto");
        return new Promise<boolean>((resolve) => {
            try {
                const salt = Buffer.from(parts[1], "hex");
                const expected = Buffer.from(parts[2], "hex");
                if (expected.length === 0 || salt.length === 0) return resolve(false);
                scrypt(password.normalize("NFKC"), salt, expected.length, (err, derivedKey) => {
                    if (err) return resolve(false);
                    if (derivedKey.length !== expected.length) return resolve(false);
                    resolve(Buffer.from(derivedKey).equals(expected));
                });
            } catch {
                resolve(false);
            }
        });
    }

    hashPassword(password: string): Promise<string> {
        return CommercialIdentityService.hashPassword(password);
    }

    verifyPassword(password: string, hash: string): Promise<boolean> {
        return CommercialIdentityService.verifyPassword(password, hash);
    }

    /**
     * Register a real password-bearing account. The first member of an
     * organization becomes OWNER; later members default to VIEWER.
     */
    registerUser(username: string, password: string, organization: string): CommercialLoginResult {
        const normalizedUser = username?.trim() ?? "";
        const normalizedOrganization = organization?.trim() ?? "";
        if (!normalizedUser || !normalizedOrganization) {
            return { success: false, error: "USERNAME_AND_ORGANIZATION_REQUIRED" };
        }

        const tenantId = OrganizationModelEngine.tenantIdForOrganization(normalizedOrganization);
        const isFirstMember = this.organizations.listMembers(tenantId).length === 0;
        const role: UserRole = isFirstMember ? "OWNER" : "VIEWER";

        const registered = this.users.registerUser(normalizedUser, password, normalizedOrganization, role);
        if ("error" in registered) {
            this.auditEvents.push({
                type: "AUTHENTICATION_FAILED",
                username: normalizedUser,
                organization: normalizedOrganization,
                createdAt: new Date(this.now()).toISOString()
            });
            return { success: false, error: registered.error };
        }

        this.organizations.createOrganization(normalizedOrganization);
        this.organizations.addMember(registered.tenantId, registered.id, registered.role);

        const session = this.users.createSessionForUser(registered, this.sessionTtlMs);
        this.auditEvents.push({
            type: "SESSION_CREATED",
            username: registered.username,
            organization: registered.organization,
            createdAt: new Date(this.now()).toISOString()
        });
        return { success: true, session: toCommercialSession(session) };
    }

    /**
     * Legacy `/api/session` onboarding path: provisions the organization owner
     * without a password. The account cannot authenticate until a password is
     * set. Kept for backward-compatible single-tenant onboarding.
     */
    createSession(username: string, organization: string, role: CommercialRole = "OWNER"): CommercialSession {
        const normalizedUser = username?.trim() ?? "";
        const normalizedOrganization = organization?.trim() ?? "";
        if (!normalizedUser || !normalizedOrganization) throw new Error("username_and_organization_required");

        const organizationRecord = this.organizations.createOrganization(normalizedOrganization);
        if (organizationRecord.status !== "ACTIVE") throw new Error("organization_registration_blocked");

        const user = this.users.ensureBootstrapUser(normalizedUser, normalizedOrganization, role);
        if ("error" in user) throw new Error("user_registration_blocked");
        this.organizations.addMember(user.tenantId, user.id, user.role);

        if (this.security.health() === false) throw new Error("authorization_initialization_failed");

        const session = this.users.createSessionForUser(user, this.sessionTtlMs);
        this.auditEvents.push({ type: "SESSION_CREATED", username: session.username, organization: session.organization, createdAt: new Date(this.now()).toISOString() });
        return toCommercialSession(session);
    }

    login(username: string, password: string, organization: string): CommercialLoginResult {
        const normalizedOrganization = organization?.trim() ?? "";
        const result = this.users.authenticate(username, password, normalizedOrganization);
        if (!result.success || !result.session || !result.user) {
            this.auditEvents.push({
                type: "AUTHENTICATION_FAILED",
                username: username?.trim() ?? "",
                organization: normalizedOrganization,
                createdAt: new Date(this.now()).toISOString()
            });
            return { success: false, error: result.error ?? "AUTHENTICATION_FAILED" };
        }

        this.organizations.createOrganization(normalizedOrganization);
        this.organizations.addMember(result.user.tenantId, result.user.id, result.user.role);
        this.auditEvents.push({
            type: "AUTHENTICATION_SUCCEEDED",
            username: result.user.username,
            organization: result.user.organization,
            createdAt: new Date(this.now()).toISOString()
        });
        return { success: true, session: toCommercialSession(result.session) };
    }

    getSession(token: string | undefined): CommercialSession | null {
        if (!token) return null;
        const record = this.users.getSessionRecord(token.trim());
        if (!record) return null;
        if (this.users.isExpired(record)) {
            this.users.deleteSession(record.token);
            this.auditEvents.push({ type: "SESSION_EXPIRED", username: record.username, organization: record.organization, createdAt: new Date(this.now()).toISOString() });
            return null;
        }
        this.users.validateSession(record.token);
        return toCommercialSession(record);
    }

    refreshSession(token: string | undefined): CommercialSession | null {
        if (!token) return null;
        const refreshed = this.users.refreshSession(token.trim());
        if (!refreshed) return null;
        this.auditEvents.push({ type: "SESSION_REFRESHED", username: refreshed.username, organization: refreshed.organization, createdAt: new Date(this.now()).toISOString() });
        return toCommercialSession(refreshed);
    }

    authorize(token: string | undefined, organization: string, permission: CommercialPermission): CommercialSession {
        const session = this.getSession(token);
        const normalizedOrganization = organization?.trim() ?? "";
        const allowed = Boolean(session && session.organization === normalizedOrganization && this.evaluateSecurity(session, permission));
        if (!allowed) {
            if (session) this.auditEvents.push({ type: "AUTHORIZATION_DENIED", username: session.username, organization: normalizedOrganization, permission, createdAt: new Date(this.now()).toISOString() });
            throw new Error("AUTHORIZATION_DENIED");
        }
        this.auditEvents.push({ type: "AUTHORIZATION_ALLOWED", username: session!.username, organization: session!.organization, permission, createdAt: new Date(this.now()).toISOString() });
        return session!;
    }

    hasPermission(token: string | undefined, organization: string, permission: CommercialPermission): boolean {
        const session = this.getSession(token);
        const normalizedOrganization = organization?.trim() ?? "";
        const allowed = Boolean(session && session.organization === normalizedOrganization && this.evaluateSecurity(session, permission));
        if (allowed) {
            this.auditEvents.push({ type: "AUTHORIZATION_ALLOWED", username: session!.username, organization: session!.organization, permission, createdAt: new Date(this.now()).toISOString() });
        } else if (session) {
            this.auditEvents.push({ type: "AUTHORIZATION_DENIED", username: session.username, organization: normalizedOrganization, permission, createdAt: new Date(this.now()).toISOString() });
        }
        return allowed;
    }

    private evaluateSecurity(session: CommercialSession, permission: CommercialPermission): boolean {
        const context = SecurityContext.forHumanUser(
            Principal.humanUser(session.userId, session.tenantId),
            [...(ROLE_AUTHORIZATIONS[session.role] ?? [])],
            `session:${session.token}`
        );
        const decision = this.security.evaluatePolicy(context, PERMISSION_ACTION[permission], { tenantId: session.tenantId });
        return decision.result === AuthorizationResult.PERMITTED;
    }

    permissionsFor(role: CommercialRole): CommercialPermission[] {
        return [...permissions[role]];
    }

    logout(token: string | undefined): boolean {
        if (!token) return false;
        const record = this.users.getSessionRecord(token.trim());
        if (!record) return false;
        const revoked = this.users.logout(token.trim());
        if (revoked) {
            this.auditEvents.push({ type: "SESSION_REVOKED", username: record.username, organization: record.organization, createdAt: new Date(this.now()).toISOString() });
        }
        return revoked;
    }

    cleanupExpiredSessions(): number {
        return this.users.cleanupExpiredSessions();
    }

    auditTrail(): IdentityAuditEvent[] {
        return this.auditEvents.map(event => ({ ...event }));
    }
}
