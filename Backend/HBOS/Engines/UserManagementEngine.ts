import { Engine } from "../Core/Engine";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { deriveTenantId } from "../Core/TenantIdentity";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Phase 13-1.1 — Real UserManagementEngine.
 *
 * Owns persistent user identity, credential material and session lifecycle for
 * the commercial runtime. Passwords are never stored in plaintext: each account
 * carries a random per-user salt and a scrypt-derived hash.
 *
 * The engine deliberately exposes tenant-scoped persistence so that tenant
 * isolation is enforced at the repository boundary (every read/write filters by
 * tenantId). It does not contain product-level RBAC; the CommercialIdentityService
 * composes this engine with the permission model.
 */

export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "ANALYST" | "VIEWER";

export type UserStatus = "ACTIVE" | "BLOCKED" | "PENDING_VERIFICATION";

export interface UserRecord {
    readonly id: string;
    readonly username: string;
    readonly organization: string;
    readonly tenantId: string;
    readonly role: UserRole;
    readonly status: UserStatus;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastLoginAt?: string;
}

export interface SessionRecord {
    readonly token: string;
    readonly userId: string;
    readonly username: string;
    readonly organization: string;
    readonly tenantId: string;
    readonly role: UserRole;
    readonly createdAt: string;
    readonly expiresAt: string;
    readonly lastActivityAt: string;
}

export interface AuthResult {
    readonly success: boolean;
    readonly user?: UserRecord;
    readonly session?: SessionRecord;
    readonly error?: string;
}

export interface RegistrationError {
    readonly error: string;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
    OWNER: 5,
    ADMIN: 4,
    MANAGER: 3,
    ANALYST: 2,
    VIEWER: 1
};

const USER_TABLE = "users";
const SESSION_TABLE = "sessions";
const SCRYPT_KEY_LENGTH = 64;
const SALT_BYTES = 16;
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

interface UserRow {
    id: string;
    username: string;
    organization: string;
    tenant_id: string;
    password_hash: string | null;
    salt: string | null;
    role: UserRole;
    status: UserStatus;
    created_at: string;
    updated_at: string;
    last_login_at: string | null;
}

interface SessionRow {
    token: string;
    user_id: string;
    username: string;
    organization: string;
    tenant_id: string;
    role: UserRole;
    created_at: string;
    expires_at: string;
    last_activity_at: string;
}

function hashPassword(password: string, salt: Buffer): string {
    return scryptSync(password.normalize("NFKC"), salt, SCRYPT_KEY_LENGTH).toString("hex");
}

function verifyPassword(password: string, saltHex: string | null, expectedHex: string | null): boolean {
    if (!saltHex || !expectedHex) return false;
    try {
        const salt = Buffer.from(saltHex, "hex");
        const expected = Buffer.from(expectedHex, "hex");
        if (salt.length === 0 || expected.length === 0) return false;
        const derived = scryptSync(password.normalize("NFKC"), salt, expected.length);
        return derived.length === expected.length && timingSafeEqual(derived, expected);
    } catch {
        return false;
    }
}

function toUserRecord(row: UserRow): UserRecord {
    return {
        id: row.id,
        username: row.username,
        organization: row.organization,
        tenantId: row.tenant_id,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastLoginAt: row.last_login_at ?? undefined
    };
}

function toSessionRecord(row: SessionRow): SessionRecord {
    return {
        token: row.token,
        userId: row.user_id,
        username: row.username,
        organization: row.organization,
        tenantId: row.tenant_id,
        role: row.role,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        lastActivityAt: row.last_activity_at
    };
}

export class UserManagementEngine implements Engine {
    name = "UserManagementEngine";

    private readonly persistence: SQLitePersistenceStore;
    private sessionTtlMs: number;
    private nowProvider: () => number;

    constructor(persistence?: SQLitePersistenceStore, sessionTtlMs: number = DEFAULT_SESSION_TTL_MS) {
        this.persistence = persistence ?? new SQLitePersistenceStore({ databasePath: ":memory:" });
        this.sessionTtlMs = sessionTtlMs;
        this.nowProvider = () => Date.now();
    }

    initialize(): void {
        this.ensureTables();
    }

    health(): boolean {
        try {
            this.ensureTables();
            this.persistence.database.prepare(`SELECT COUNT(*) AS count FROM ${USER_TABLE}`).get();
            return true;
        } catch {
            return false;
        }
    }

    setNowProvider(provider: () => number): void {
        if (typeof provider !== "function") throw new Error("invalid_now_provider");
        this.nowProvider = provider;
    }

    setSessionTtl(sessionTtlMs: number): void {
        if (!Number.isFinite(sessionTtlMs) || sessionTtlMs <= 0) throw new Error("invalid_session_ttl");
        this.sessionTtlMs = sessionTtlMs;
    }

    getSessionTtl(): number {
        return this.sessionTtlMs;
    }

    static tenantIdForOrganization(organization: string): string {
        return deriveTenantId(organization);
    }

    registerUser(username: string, password: string, organization: string, role: UserRole = "VIEWER"): UserRecord | RegistrationError {
        const cleanUsername = username?.trim() ?? "";
        const cleanOrganization = organization?.trim() ?? "";
        const cleanPassword = password ?? "";

        if (!cleanUsername || !cleanOrganization || !cleanPassword) {
            return { error: "USERNAME_PASSWORD_ORGANIZATION_REQUIRED" };
        }
        if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
            return { error: "PASSWORD_TOO_SHORT" };
        }
        if (!ROLE_HIERARCHY[role]) {
            return { error: "INVALID_ROLE" };
        }

        this.ensureTables();
        const tenantId = deriveTenantId(cleanOrganization);
        const existing = this.persistence.database
            .prepare(`SELECT id FROM ${USER_TABLE} WHERE username = ? AND tenant_id = ?`)
            .get(cleanUsername, tenantId);
        if (existing) {
            return { error: "USER_ALREADY_EXISTS" };
        }

        const now = new Date(this.nowProvider()).toISOString();
        const salt = randomBytes(SALT_BYTES);
        const userId = `usr_${randomBytes(12).toString("hex")}`;

        this.persistence.database.prepare(`
            INSERT INTO ${USER_TABLE}
                (id, username, organization, tenant_id, password_hash, salt, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
        `).run(userId, cleanUsername, cleanOrganization, tenantId, hashPassword(cleanPassword, salt), salt.toString("hex"), role, now, now);

        return {
            id: userId,
            username: cleanUsername,
            organization: cleanOrganization,
            tenantId,
            role,
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now
        };
    }

    /**
     * Bootstrap an organization owner without a stored password.
     *
     * Used only by the legacy `/api/session` onboarding path so that an
     * organization owner can be provisioned and immediately set a password via
     * `setPassword`. Accounts without a password cannot authenticate.
     */
    ensureBootstrapUser(username: string, organization: string, role: UserRole = "OWNER"): UserRecord | RegistrationError {
        const cleanUsername = username?.trim() ?? "";
        const cleanOrganization = organization?.trim() ?? "";
        if (!cleanUsername || !cleanOrganization) return { error: "USERNAME_AND_ORGANIZATION_REQUIRED" };

        this.ensureTables();
        const tenantId = deriveTenantId(cleanOrganization);
        const existing = this.getUserByUsername(cleanUsername, tenantId);
        if (existing) return existing;

        const now = new Date(this.nowProvider()).toISOString();
        const userId = `usr_${randomBytes(12).toString("hex")}`;
        this.persistence.database.prepare(`
            INSERT INTO ${USER_TABLE}
                (id, username, organization, tenant_id, password_hash, salt, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, NULL, ?, 'PENDING_VERIFICATION', ?, ?)
        `).run(userId, cleanUsername, cleanOrganization, tenantId, role, now, now);

        return {
            id: userId,
            username: cleanUsername,
            organization: cleanOrganization,
            tenantId,
            role,
            status: "PENDING_VERIFICATION",
            createdAt: now,
            updatedAt: now
        };
    }

    setPassword(userId: string, password: string): boolean {
        const cleanPassword = password ?? "";
        if (cleanPassword.length < MIN_PASSWORD_LENGTH) return false;
        this.ensureTables();
        const salt = randomBytes(SALT_BYTES);
        const now = new Date(this.nowProvider()).toISOString();
        const result = this.persistence.database
            .prepare(`UPDATE ${USER_TABLE} SET password_hash = ?, salt = ?, status = 'ACTIVE', updated_at = ? WHERE id = ?`)
            .run(hashPassword(cleanPassword, salt), salt.toString("hex"), now, userId);
        return Number(result.changes) > 0;
    }

    authenticate(username: string, password: string, organization: string): AuthResult {
        const cleanUsername = username?.trim() ?? "";
        const cleanOrganization = organization?.trim() ?? "";
        const cleanPassword = password ?? "";
        if (!cleanUsername || !cleanOrganization || !cleanPassword) {
            return { success: false, error: "CREDENTIALS_REQUIRED" };
        }

        this.ensureTables();
        const tenantId = deriveTenantId(cleanOrganization);
        const row = this.persistence.database
            .prepare(`SELECT * FROM ${USER_TABLE} WHERE username = ? AND tenant_id = ?`)
            .get(cleanUsername, tenantId) as unknown as UserRow | undefined;
        if (!row) return { success: false, error: "INVALID_CREDENTIALS" };
        if (row.status === "BLOCKED") return { success: false, error: "ACCOUNT_BLOCKED" };
        if (row.status !== "ACTIVE") return { success: false, error: "ACCOUNT_NOT_ACTIVE" };
        if (!verifyPassword(cleanPassword, row.salt, row.password_hash)) {
            return { success: false, error: "INVALID_CREDENTIALS" };
        }

        const now = new Date(this.nowProvider()).toISOString();
        this.persistence.database
            .prepare(`UPDATE ${USER_TABLE} SET last_login_at = ?, updated_at = ? WHERE id = ?`)
            .run(now, now, row.id);
        row.last_login_at = now;
        row.updated_at = now;

        const session = this.createSessionForUser(toUserRecord(row));
        return { success: true, user: toUserRecord(row), session };
    }

    createSessionForUser(user: UserRecord, ttlMs: number = this.sessionTtlMs): SessionRecord {
        this.ensureTables();
        const token = randomBytes(32).toString("hex");
        const createdAt = new Date(this.nowProvider()).toISOString();
        const expiresAt = new Date(this.nowProvider() + ttlMs).toISOString();
        this.persistence.database.prepare(`
            INSERT INTO ${SESSION_TABLE}
                (token, user_id, username, organization, tenant_id, role, created_at, expires_at, last_activity_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(token, user.id, user.username, user.organization, user.tenantId, user.role, createdAt, expiresAt, createdAt);
        return {
            token,
            userId: user.id,
            username: user.username,
            organization: user.organization,
            tenantId: user.tenantId,
            role: user.role,
            createdAt,
            expiresAt,
            lastActivityAt: createdAt
        };
    }

    getSessionRecord(token: string): SessionRecord | null {
        if (!token?.trim()) return null;
        this.ensureTables();
        const row = this.persistence.database
            .prepare(`SELECT * FROM ${SESSION_TABLE} WHERE token = ?`)
            .get(token) as unknown as SessionRow | undefined;
        return row ? toSessionRecord(row) : null;
    }

    isExpired(session: SessionRecord): boolean {
        const expiresAt = Date.parse(session.expiresAt);
        return !Number.isFinite(expiresAt) || expiresAt <= this.nowProvider();
    }

    validateSession(token: string): SessionRecord | null {
        const session = this.getSessionRecord(token);
        if (!session) return null;
        if (this.isExpired(session)) {
            this.deleteSession(token);
            return null;
        }
        const now = new Date(this.nowProvider()).toISOString();
        this.persistence.database
            .prepare(`UPDATE ${SESSION_TABLE} SET last_activity_at = ? WHERE token = ?`)
            .run(now, token);
        return { ...session, lastActivityAt: now };
    }

    refreshSession(token: string): SessionRecord | null {
        const session = this.getSessionRecord(token);
        if (!session || this.isExpired(session)) return null;
        const now = new Date(this.nowProvider()).toISOString();
        const expiresAt = new Date(this.nowProvider() + this.sessionTtlMs).toISOString();
        const result = this.persistence.database
            .prepare(`UPDATE ${SESSION_TABLE} SET expires_at = ?, last_activity_at = ? WHERE token = ?`)
            .run(expiresAt, now, token);
        if (Number(result.changes) === 0) return null;
        return { ...session, expiresAt, lastActivityAt: now };
    }

    logout(token: string): boolean {
        return this.deleteSession(token);
    }

    deleteSession(token: string): boolean {
        if (!token?.trim()) return false;
        this.ensureTables();
        const result = this.persistence.database
            .prepare(`DELETE FROM ${SESSION_TABLE} WHERE token = ?`)
            .run(token);
        return Number(result.changes) > 0;
    }

    cleanupExpiredSessions(): number {
        this.ensureTables();
        const now = new Date(this.nowProvider()).toISOString();
        const result = this.persistence.database
            .prepare(`DELETE FROM ${SESSION_TABLE} WHERE expires_at <= ?`)
            .run(now);
        return Number(result.changes);
    }

    getUserById(userId: string): UserRecord | null {
        this.ensureTables();
        const row = this.persistence.database
            .prepare(`SELECT * FROM ${USER_TABLE} WHERE id = ?`)
            .get(userId) as unknown as UserRow | undefined;
        return row ? toUserRecord(row) : null;
    }

    getUserByUsername(username: string, tenantId: string): UserRecord | null {
        this.ensureTables();
        const row = this.persistence.database
            .prepare(`SELECT * FROM ${USER_TABLE} WHERE username = ? AND tenant_id = ?`)
            .get(username?.trim() ?? "", tenantId) as unknown as UserRow | undefined;
        return row ? toUserRecord(row) : null;
    }

    listUsers(tenantId: string): UserRecord[] {
        this.ensureTables();
        const rows = this.persistence.database
            .prepare(`SELECT * FROM ${USER_TABLE} WHERE tenant_id = ? ORDER BY created_at ASC`)
            .all(tenantId) as unknown as UserRow[];
        return rows.map(toUserRecord);
    }

    updateUserRole(userId: string, role: UserRole): boolean {
        if (!ROLE_HIERARCHY[role]) return false;
        this.ensureTables();
        const now = new Date(this.nowProvider()).toISOString();
        const result = this.persistence.database
            .prepare(`UPDATE ${USER_TABLE} SET role = ?, updated_at = ? WHERE id = ?`)
            .run(role, now, userId);
        return Number(result.changes) > 0;
    }

    blockUser(userId: string): boolean {
        this.ensureTables();
        const now = new Date(this.nowProvider()).toISOString();
        const result = this.persistence.database
            .prepare(`UPDATE ${USER_TABLE} SET status = 'BLOCKED', updated_at = ? WHERE id = ?`)
            .run(now, userId);
        return Number(result.changes) > 0;
    }

    unblockUser(userId: string): boolean {
        this.ensureTables();
        const now = new Date(this.nowProvider()).toISOString();
        const result = this.persistence.database
            .prepare(`UPDATE ${USER_TABLE} SET status = 'ACTIVE', updated_at = ? WHERE id = ?`)
            .run(now, userId);
        return Number(result.changes) > 0;
    }

    hasRole(userId: string, requiredRole: UserRole): boolean {
        const user = this.getUserById(userId);
        if (!user) return false;
        return (ROLE_HIERARCHY[user.role] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? Number.POSITIVE_INFINITY);
    }

    getRoleLevel(role: UserRole): number {
        return ROLE_HIERARCHY[role] ?? 0;
    }

    shutdown(): void {
        // Shared persistence store is owned by the composition root; do not close it here.
    }

    private ensureTables(): void {
        this.persistence.database.exec(`
            CREATE TABLE IF NOT EXISTS ${USER_TABLE} (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                organization TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                password_hash TEXT,
                salt TEXT,
                role TEXT NOT NULL DEFAULT 'VIEWER',
                status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_login_at TEXT,
                UNIQUE(username, tenant_id)
            );
            CREATE INDEX IF NOT EXISTS idx_users_tenant ON ${USER_TABLE}(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_users_username ON ${USER_TABLE}(username);

            CREATE TABLE IF NOT EXISTS ${SESSION_TABLE} (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                organization TEXT NOT NULL,
                tenant_id TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                last_activity_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON ${SESSION_TABLE}(user_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON ${SESSION_TABLE}(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON ${SESSION_TABLE}(expires_at);
        `);
    }
}
