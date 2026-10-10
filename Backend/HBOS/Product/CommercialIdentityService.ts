import {
    createHash,
    randomBytes,
    randomUUID,
    scrypt,
    timingSafeEqual,
} from "node:crypto";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { SecurityLayerEngine } from "../Engines/SecurityLayerEngine";
import { UserManagementEngine } from "../Engines/UserManagementEngine";
import { OrganizationModelEngine } from "../Engines/OrganizationModelEngine";

export type CommercialRole = "OWNER" | "ADMIN" | "MANAGER" | "VIEWER";
export type CommercialPermission =
    | "READ_DASHBOARD"
    | "INGEST_DATA"
    | "CREATE_DECISION"
    | "MANAGE_USERS"
    | "MANAGE_TARGETS";

export interface CommercialSession {
    token: string;
    username: string;
    organization: string;
    organizationKey: string;
    tenantId: string;
    role: CommercialRole;
    createdAt: string;
    expiresAt: string;
    active: boolean;
}

export interface IdentityAuditEvent {
    type:
        | "ACCOUNT_CREATED"
        | "MEMBER_JOINED"
        | "LOGIN_SUCCEEDED"
        | "LOGIN_FAILED"
        | "SESSION_REVOKED"
        | "AUTHORIZATION_ALLOWED"
        | "AUTHORIZATION_DENIED"
        | "INVITATION_CREATED";
    username: string;
    organization: string;
    tenantId?: string;
    permission?: CommercialPermission;
    createdAt: string;
}

interface StoredUser {
    username: string;
    usernameKey: string;
    organization: string;
    organizationKey: string;
    tenantId: string;
    role: CommercialRole;
    passwordSalt: string;
    passwordHash: string;
    createdAt: string;
}

interface StoredOrganization {
    name: string;
    organizationKey: string;
    tenantId: string;
    ownerAccountKey: string;
    createdAt: string;
}

interface StoredInvitation {
    codeHash: string;
    organization: string;
    organizationKey: string;
    tenantId: string;
    role: Exclude<CommercialRole, "OWNER">;
    createdBy: string;
    createdAt: string;
    expiresAt: string;
}

interface IdentityRegistry {
    version: 1;
    users: Record<string, StoredUser>;
    organizations: Record<string, StoredOrganization>;
    invitations: Record<string, StoredInvitation>;
    auditEvents: IdentityAuditEvent[];
}

const REGISTRY_SCOPE = { tenantId: "__hooshyaros_platform_identity__" };
const REGISTRY_KEY = "commercial-identity-registry:v1";
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const MAX_AUDIT_EVENTS = 2000;
const DUMMY_SALT = "hooshyaros-auth-dummy-salt-v1";
const DUMMY_HASH = "0".repeat(128);

const permissions: Record<CommercialRole, ReadonlySet<CommercialPermission>> = {
    OWNER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS", "MANAGE_TARGETS"]),
    ADMIN: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION", "MANAGE_USERS", "MANAGE_TARGETS"]),
    MANAGER: new Set(["READ_DASHBOARD", "INGEST_DATA", "CREATE_DECISION"]),
    VIEWER: new Set(["READ_DASHBOARD"]),
};

const normalize = (value: string): string =>
    value.trim().normalize("NFKC").replace(/\s+/g, " ").toLowerCase();

const keyOf = (value: string): string =>
    createHash("sha256").update(normalize(value), "utf8").digest("hex");

const hashInvitationCode = (value: string): string =>
    createHash("sha256").update(value.trim(), "utf8").digest("hex");

const accountKey = (usernameKey: string, organizationKey: string): string =>
    `${organizationKey}:${usernameKey}`;

const derivePasswordHash = (password: string, salt: string): Promise<string> =>
    new Promise((resolve, reject) => {
        scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derivedKey) => {
            if (error) reject(error);
            else resolve(derivedKey.toString("hex"));
        });
    });

const emptyRegistry = (): IdentityRegistry => ({
    version: 1,
    users: {},
    organizations: {},
    invitations: {},
    auditEvents: [],
});

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseRegistry = (value: unknown | null): IdentityRegistry => {
    if (value === null) return emptyRegistry();
    if (!isObjectRecord(value) || value.version !== 1 ||
        !isObjectRecord(value.users) || !isObjectRecord(value.organizations) ||
        !isObjectRecord(value.invitations) || !Array.isArray(value.auditEvents)) {
        throw new Error("IDENTITY_REGISTRY_CORRUPT");
    }
    return value as unknown as IdentityRegistry;
};

const appendAudit = (registry: IdentityRegistry, event: IdentityAuditEvent): void => {
    registry.auditEvents.push(event);
    if (registry.auditEvents.length > MAX_AUDIT_EVENTS) {
        registry.auditEvents.splice(0, registry.auditEvents.length - MAX_AUDIT_EVENTS);
    }
};

export class CommercialIdentityService {
    private readonly security = new SecurityLayerEngine();
    private readonly users = new UserManagementEngine();
    private readonly organizations = new OrganizationModelEngine();
    private readonly sessions = new Map<string, CommercialSession>();
    private readonly loginFailures = new Map<string, { windowStartedAt: number; count: number; blockedUntil: number }>();
    private readonly persistence: SQLitePersistenceStore;
    private readonly ownsPersistence: boolean;

    constructor(persistence?: SQLitePersistenceStore) {
        this.ownsPersistence = !persistence;
        this.persistence = persistence ?? new SQLitePersistenceStore({ databasePath: ":memory:" });
    }

    initialize(): void {
        this.security.initialize();
        this.users.initialize();
        this.organizations.initialize();
    }

    close(): void {
        if (this.ownsPersistence) this.persistence.close();
    }

    async registerOrganizationOwner(
        username: string,
        organization: string,
        password: string,
    ): Promise<CommercialSession> {
        const normalizedUser = username?.trim() ?? "";
        const normalizedOrganization = organization?.trim() ?? "";
        this.assertIdentityFields(normalizedUser, normalizedOrganization);
        this.assertPassword(password);
        if (this.users.registerUser(normalizedUser).status !== "READY") throw new Error("USER_REGISTRATION_BLOCKED");
        if (this.organizations.createOrganization(normalizedOrganization).status !== "READY") throw new Error("ORGANIZATION_REGISTRATION_BLOCKED");

        const usernameKey = keyOf(normalizedUser);
        const organizationKey = keyOf(normalizedOrganization);
        const key = accountKey(usernameKey, organizationKey);
        const passwordSalt = randomBytes(16).toString("hex");
        const passwordHash = await derivePasswordHash(password, passwordSalt);
        let createdUser: StoredUser | undefined;
        const now = new Date().toISOString();

        await this.mutateRegistry(registry => {
            if (registry.organizations[organizationKey]) throw new Error("ORGANIZATION_ALREADY_EXISTS");
            if (registry.users[key]) throw new Error("ACCOUNT_ALREADY_EXISTS");
            const tenantId = `tenant:${randomUUID()}`;
            createdUser = {
                username: normalizedUser,
                usernameKey,
                organization: normalizedOrganization,
                organizationKey,
                tenantId,
                role: "OWNER",
                passwordSalt,
                passwordHash,
                createdAt: now,
            };
            registry.organizations[organizationKey] = {
                name: normalizedOrganization,
                organizationKey,
                tenantId,
                ownerAccountKey: key,
                createdAt: now,
            };
            registry.users[key] = createdUser;
            appendAudit(registry, {
                type: "ACCOUNT_CREATED",
                username: normalizedUser,
                organization: normalizedOrganization,
                tenantId,
                createdAt: now,
            });
            return registry;
        });

        if (!createdUser) throw new Error("ACCOUNT_REGISTRATION_FAILED");
        return this.openSession(createdUser);
    }

    async joinOrganization(
        username: string,
        password: string,
        invitationCode: string,
    ): Promise<CommercialSession> {
        const normalizedUser = username?.trim() ?? "";
        this.assertUsername(normalizedUser);
        this.assertPassword(password);
        const normalizedCode = invitationCode?.trim() ?? "";
        if (!normalizedCode || normalizedCode.length > 200) throw new Error("INVITATION_INVALID");

        const invitationHash = hashInvitationCode(normalizedCode);
        const invitationRecord = await this.readRegistry();
        const invitation = invitationRecord.invitations[invitationHash];
        if (!invitation || Date.parse(invitation.expiresAt) <= Date.now()) throw new Error("INVITATION_INVALID");

        const usernameKey = keyOf(normalizedUser);
        const key = accountKey(usernameKey, invitation.organizationKey);
        const passwordSalt = randomBytes(16).toString("hex");
        const passwordHash = await derivePasswordHash(password, passwordSalt);
        let joinedUser: StoredUser | undefined;
        const now = new Date().toISOString();

        await this.mutateRegistry(registry => {
            const currentInvitation = registry.invitations[invitationHash];
            if (!currentInvitation || Date.parse(currentInvitation.expiresAt) <= Date.now()) {
                throw new Error("INVITATION_INVALID");
            }
            if (registry.users[key]) throw new Error("ACCOUNT_ALREADY_EXISTS");
            const org = registry.organizations[currentInvitation.organizationKey];
            if (!org || org.tenantId !== currentInvitation.tenantId) throw new Error("INVITATION_INVALID");
            joinedUser = {
                username: normalizedUser,
                usernameKey,
                organization: currentInvitation.organization,
                organizationKey: currentInvitation.organizationKey,
                tenantId: currentInvitation.tenantId,
                role: currentInvitation.role,
                passwordSalt,
                passwordHash,
                createdAt: now,
            };
            registry.users[key] = joinedUser;
            delete registry.invitations[invitationHash];
            appendAudit(registry, {
                type: "MEMBER_JOINED",
                username: normalizedUser,
                organization: currentInvitation.organization,
                tenantId: currentInvitation.tenantId,
                createdAt: now,
            });
            return registry;
        });

        if (!joinedUser) throw new Error("ACCOUNT_REGISTRATION_FAILED");
        return this.openSession(joinedUser);
    }

    async login(username: string, organization: string, password: string): Promise<CommercialSession> {
        const normalizedUser = username?.trim() ?? "";
        const normalizedOrganization = organization?.trim() ?? "";
        this.assertIdentityFields(normalizedUser, normalizedOrganization);
        if (typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH) throw new Error("AUTHENTICATION_FAILED");

        const usernameKey = keyOf(normalizedUser);
        const organizationKey = keyOf(normalizedOrganization);
        const key = accountKey(usernameKey, organizationKey);
        this.assertLoginAllowed(key);

        const registry = await this.readRegistry();
        const user = registry.users[key];
        const candidateHash = await derivePasswordHash(password, user?.passwordSalt ?? DUMMY_SALT);
        const expectedHash = Buffer.from(user?.passwordHash ?? DUMMY_HASH, "hex");
        const candidateBuffer = Buffer.from(candidateHash, "hex");
        const validHash = expectedHash.length === candidateBuffer.length && timingSafeEqual(expectedHash, candidateBuffer);

        if (!user || !validHash) {
            const failures = this.recordLoginFailure(key);
            await this.recordEvent({
                type: "LOGIN_FAILED",
                username: normalizedUser,
                organization: normalizedOrganization,
                createdAt: new Date().toISOString(),
            });
            if (failures >= 8) throw new Error("AUTHENTICATION_RATE_LIMITED");
            throw new Error("AUTHENTICATION_FAILED");
        }

        this.loginFailures.delete(key);
        await this.recordEvent({
            type: "LOGIN_SUCCEEDED",
            username: user.username,
            organization: user.organization,
            tenantId: user.tenantId,
            createdAt: new Date().toISOString(),
        });
        return this.openSession(user);
    }

    async createInvitation(
        token: string,
        role: Exclude<CommercialRole, "OWNER">,
    ): Promise<{ code: string; role: Exclude<CommercialRole, "OWNER">; expiresAt: string }> {
        const session = this.getSession(token);
        if (!session || !permissions[session.role].has("MANAGE_USERS")) throw new Error("AUTHORIZATION_DENIED");
        if (!["ADMIN", "MANAGER", "VIEWER"].includes(role) ||
            (role === "ADMIN" && session.role !== "OWNER")) throw new Error("INVITATION_ROLE_NOT_ALLOWED");

        const code = randomBytes(24).toString("base64url");
        const codeHash = hashInvitationCode(code);
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS).toISOString();

        await this.mutateRegistry(registry => {
            const organization = registry.organizations[session.organizationKey];
            if (!organization || organization.tenantId !== session.tenantId) throw new Error("AUTHORIZATION_DENIED");
            registry.invitations[codeHash] = {
                codeHash,
                organization: session.organization,
                organizationKey: session.organizationKey,
                tenantId: session.tenantId,
                role,
                createdBy: session.username,
                createdAt,
                expiresAt,
            };
            appendAudit(registry, {
                type: "INVITATION_CREATED",
                username: session.username,
                organization: session.organization,
                tenantId: session.tenantId,
                createdAt,
            });
            return registry;
        });
        return { code, role, expiresAt };
    }

    getSession(token: string | undefined): CommercialSession | null {
        if (!token) return null;
        const session = this.sessions.get(token.trim());
        if (!session) return null;
        if (!session.active || Date.parse(session.expiresAt) <= Date.now()) {
            session.active = false;
            this.sessions.delete(session.token);
            return null;
        }
        return { ...session };
    }

    async authorize(
        token: string | undefined,
        organization: string,
        permission: CommercialPermission,
    ): Promise<CommercialSession> {
        const session = this.getSession(token);
        const normalizedOrganizationKey = keyOf(organization ?? "");
        if (!session || session.organizationKey !== normalizedOrganizationKey ||
            !permissions[session.role].has(permission)) {
            await this.recordEvent({
                type: "AUTHORIZATION_DENIED",
                username: session?.username ?? "",
                organization: organization?.trim() ?? "",
                tenantId: session?.tenantId,
                permission,
                createdAt: new Date().toISOString(),
            });
            throw new Error("AUTHORIZATION_DENIED");
        }
        await this.recordEvent({
            type: "AUTHORIZATION_ALLOWED",
            username: session.username,
            organization: session.organization,
            tenantId: session.tenantId,
            permission,
            createdAt: new Date().toISOString(),
        });
        return session;
    }

    async logout(token: string | undefined): Promise<boolean> {
        if (!token) return false;
        const session = this.sessions.get(token.trim());
        if (!session || !session.active) return false;
        session.active = false;
        this.sessions.delete(session.token);
        await this.recordEvent({
            type: "SESSION_REVOKED",
            username: session.username,
            organization: session.organization,
            tenantId: session.tenantId,
            createdAt: new Date().toISOString(),
        });
        return true;
    }

    async auditTrail(): Promise<IdentityAuditEvent[]> {
        const registry = await this.readRegistry();
        return registry.auditEvents.map(event => ({ ...event }));
    }

    private openSession(user: StoredUser): CommercialSession {
        const now = new Date();
        const session: CommercialSession = {
            token: randomBytes(32).toString("hex"),
            username: user.username,
            organization: user.organization,
            organizationKey: user.organizationKey,
            tenantId: user.tenantId,
            role: user.role,
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
            active: true,
        };
        this.sessions.set(session.token, session);
        return { ...session };
    }

    private assertIdentityFields(username: string, organization: string): void {
        this.assertUsername(username);
        const org = organization?.trim() ?? "";
        if (!org || org.length > 120 || !normalize(org)) throw new Error("SESSION_FIELDS_REQUIRED");
    }

    private assertUsername(username: string): void {
        if (!username || username.length > 120 || !normalize(username)) throw new Error("SESSION_FIELDS_REQUIRED");
    }

    private assertPassword(password: string): void {
        if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
            throw new Error("PASSWORD_POLICY_INVALID");
        }
    }

    private assertLoginAllowed(key: string): void {
        const attempt = this.loginFailures.get(key);
        if (!attempt) return;
        const now = Date.now();
        if (attempt.blockedUntil > now) throw new Error("AUTHENTICATION_RATE_LIMITED");
        if (now - attempt.windowStartedAt > 15 * 60 * 1000) this.loginFailures.delete(key);
    }

    private recordLoginFailure(key: string): number {
        const now = Date.now();
        const previous = this.loginFailures.get(key);
        const attempt = !previous || now - previous.windowStartedAt > 15 * 60 * 1000
            ? { windowStartedAt: now, count: 0, blockedUntil: 0 }
            : previous;
        attempt.count += 1;
        if (attempt.count >= 8) attempt.blockedUntil = now + 15 * 60 * 1000;
        this.loginFailures.set(key, attempt);
        return attempt.count;
    }

    private async readRegistry(): Promise<IdentityRegistry> {
        const record = await this.persistence.read(REGISTRY_SCOPE, REGISTRY_KEY);
        return parseRegistry(record?.value ?? null);
    }

    private async mutateRegistry(updater: (registry: IdentityRegistry) => IdentityRegistry): Promise<IdentityRegistry> {
        const record = await this.persistence.mutate(REGISTRY_SCOPE, REGISTRY_KEY, current => updater(parseRegistry(current)));
        return parseRegistry(record.value);
    }

    private async recordEvent(event: IdentityAuditEvent): Promise<void> {
        await this.mutateRegistry(registry => {
            appendAudit(registry, event);
            return registry;
        });
    }
}
