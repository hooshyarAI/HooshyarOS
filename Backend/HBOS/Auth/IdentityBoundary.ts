import { createHash, randomUUID } from "node:crypto";
import { JsonPersistenceBoundary } from "../Infrastructure/JsonPersistenceBoundary";

export type Role = "OWNER" | "ADMIN" | "MANAGER" | "ANALYST" | "VIEWER";
export interface IdentityRecord { id: string; username: string; passwordHash: string; organizationId: string; role: Role; active: boolean; }
export interface SessionRecord { token: string; userId: string; organizationId: string; role: Role; expiresAt: number; }

/** Fail-closed identity/session boundary for commercial MVP runtime. */
export class IdentityBoundary {
    constructor(private readonly persistence = new JsonPersistenceBoundary()) {}

    register(username: string, password: string, organizationId: string, role: Role = "OWNER"): IdentityRecord | null {
        const u = username?.trim();
        const org = organizationId?.trim();
        if (!u || !org || !password || password.length < 8) return null;
        const users = this.persistence.read<IdentityRecord[]>("identities", []);
        if (users.some(user => user.username === u && user.organizationId === org)) return null;
        const user: IdentityRecord = { id: randomUUID(), username: u, passwordHash: this.hash(password), organizationId: org, role, active: true };
        this.persistence.write("identities", [...users, user]);
        return user;
    }

    authenticate(username: string, password: string): SessionRecord | null {
        const user = this.persistence.read<IdentityRecord[]>("identities", []).find(item => item.username === username?.trim() && item.active);
        if (!user || user.passwordHash !== this.hash(password)) return null;
        const session: SessionRecord = { token: randomUUID(), userId: user.id, organizationId: user.organizationId, role: user.role, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
        const sessions = this.persistence.read<SessionRecord[]>("sessions", []).filter(item => item.expiresAt > Date.now());
        this.persistence.write("sessions", [...sessions, session]);
        return session;
    }

    authorize(token: string, organizationId: string, allowedRoles: Role[] = []): boolean {
        const session = this.persistence.read<SessionRecord[]>("sessions", []).find(item => item.token === token && item.expiresAt > Date.now());
        return Boolean(session && session.organizationId === organizationId && (allowedRoles.length === 0 || allowedRoles.includes(session.role)));
    }

    logout(token: string): void {
        const sessions = this.persistence.read<SessionRecord[]>("sessions", []).filter(item => item.token !== token);
        this.persistence.write("sessions", sessions);
    }

    private hash(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
}
