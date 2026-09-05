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
    expiresAt: string;
    active: boolean;
}

export interface IdentityAuditEvent {
    type: "SESSION_CREATED" | "SESSION_REVOKED" | "AUTHORIZATION_ALLOWED" | "AUTHORIZATION_DENIED" | "SESSION_EXPIRED";
    username: string;
    organization: string;
    permission?: CommercialPermission;
    createdAt: string;
}

const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;

const permissions: Record<CommercialRole, ReadonlySet<CommercialPermission>> = {
    OWNER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS"]),
    ADMIN: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS"]),
    MANAGER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION"]),
    VIEWER: new Set(["READ_DASHBOARD"])
};

const isExpired = (session: CommercialSession, now: number = Date.now()): boolean => {
    const expiresAt = Date.parse(session.expiresAt);
    return !Number.isFinite(expiresAt) || expiresAt <= now;
};

export class CommercialIdentityService {
    private readonly security = new SecurityLayerEngine();
    private readonly users = new UserManagementEngine();
    private readonly organizations = new OrganizationModelEngine();
    private readonly sessions = new Map<string, CommercialSession>();
    private readonly auditEvents: IdentityAuditEvent[] = [];
    private sessionTtlMs: number = DEFAULT_SESSION_TTL_MS;
    private now: () => number = () => Date.now();

    initialize(): void {
        this.security.initialize();
        this.users.initialize();
        this.organizations.initialize();
    }

    setSessionTtl(ttlMs: number): void {
        if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("invalid_session_ttl");
        this.sessionTtlMs = ttlMs;
    }

    setNowProvider(provider: () => number): void {
        if (typeof provider !== "function") throw new Error("invalid_now_provider");
        this.now = provider;
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

    createSession(username: string, organization: string, role: CommercialRole = "OWNER"): CommercialSession {
        const normalizedUser = username?.trim() ?? "";
        const normalizedOrganization = organization?.trim() ?? "";
        if (!normalizedUser || !normalizedOrganization) throw new Error("username_and_organization_required");
        if (this.users.registerUser(normalizedUser).status !== "READY") throw new Error("user_registration_blocked");
        if (this.organizations.createOrganization(normalizedOrganization).status !== "READY") throw new Error("organization_registration_blocked");
        if (this.security.authorize(normalizedUser).status !== "READY") throw new Error("authorization_initialization_failed");

        const createdAt = new Date(this.now()).toISOString();
        const expiresAt = new Date(this.now() + this.sessionTtlMs).toISOString();
        const session: CommercialSession = {
            token: `hs_${randomUUID()}`,
            username: normalizedUser,
            organization: normalizedOrganization,
            tenantId: `tenant-${Buffer.from(normalizedOrganization, "utf8").toString("hex")}`,
            role,
            createdAt,
            expiresAt,
            active: true
        };
        this.sessions.set(session.token, session);
        this.auditEvents.push({ type: "SESSION_CREATED", username: session.username, organization: session.organization, createdAt });
        return { ...session };
    }

    getSession(token: string | undefined): CommercialSession | null {
        if (!token) return null;
        const session = this.sessions.get(token.trim());
        if (!session || !session.active) return null;
        if (isExpired(session, this.now())) {
            session.active = false;
            this.auditEvents.push({ type: "SESSION_EXPIRED", username: session.username, organization: session.organization, createdAt: new Date(this.now()).toISOString() });
            return null;
        }
        return { ...session };
    }

    authorize(token: string | undefined, organization: string, permission: CommercialPermission): CommercialSession {
        const session = this.getSession(token);
        const normalizedOrganization = organization?.trim() ?? "";
        if (!session || session.organization !== normalizedOrganization || !permissions[session.role].has(permission)) {
            if (session) this.auditEvents.push({ type: "AUTHORIZATION_DENIED", username: session.username, organization: normalizedOrganization, permission, createdAt: new Date(this.now()).toISOString() });
            throw new Error("AUTHORIZATION_DENIED");
        }
        this.auditEvents.push({ type: "AUTHORIZATION_ALLOWED", username: session.username, organization: session.organization, permission, createdAt: new Date(this.now()).toISOString() });
        return session;
    }

    logout(token: string | undefined): boolean {
        if (!token) return false;
        const session = this.sessions.get(token.trim());
        if (!session || !session.active) return false;
        session.active = false;
        this.auditEvents.push({ type: "SESSION_REVOKED", username: session.username, organization: session.organization, createdAt: new Date(this.now()).toISOString() });
        return true;
    }

    auditTrail(): IdentityAuditEvent[] {
        return this.auditEvents.map(event => ({ ...event }));
    }
}
