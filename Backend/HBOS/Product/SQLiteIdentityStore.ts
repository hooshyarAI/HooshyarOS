import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CommercialPermission, CommercialRole, CommercialSession, IdentityAuditEvent } from "./Contracts/CommercialIdentityContract";

export interface SQLiteIdentityStoreOptions {
  readonly databasePath: string;
}

export class SQLiteIdentityStore {
  private readonly database: DatabaseSync;

  constructor(options: SQLiteIdentityStoreOptions) {
    const databasePath = resolve(options.databasePath);
    mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS commercial_sessions (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        organization TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_commercial_sessions_tenant
        ON commercial_sessions (tenant_id);

      CREATE TABLE IF NOT EXISTS identity_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        username TEXT NOT NULL,
        organization TEXT NOT NULL,
        permission TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_identity_audit_events_tenant
        ON identity_audit_events (organization, username);
    `);
  }

  saveSession(session: CommercialSession): void {
    this.database
      .prepare(
        `INSERT INTO commercial_sessions
          (token, username, organization, tenant_id, role, created_at, active)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET
          username = excluded.username,
          organization = excluded.organization,
          tenant_id = excluded.tenant_id,
          role = excluded.role,
          created_at = excluded.created_at,
          active = excluded.active`
      )
      .run(
        session.token,
        session.username,
        session.organization,
        session.tenantId,
        session.role,
        session.createdAt,
        session.active ? 1 : 0
      );
  }

  getSession(token: string): CommercialSession | null {
    const row = this.database
      .prepare(
        `SELECT token, username, organization, tenant_id, role, created_at, active
         FROM commercial_sessions WHERE token = ?`
      )
      .get(token) as
      | {
          token?: string;
          username?: string;
          organization?: string;
          tenant_id?: string;
          role?: string;
          created_at?: string;
          active?: number;
        }
      | undefined;

    if (!row?.token || !row.username || !row.organization || !row.tenant_id || !row.role || !row.created_at) {
      return null;
    }

    return {
      token: row.token,
      username: row.username,
      organization: row.organization,
      tenantId: row.tenant_id,
      role: row.role as CommercialRole,
      createdAt: row.created_at,
      active: row.active === 1,
    };
  }

  revokeSession(token: string): boolean {
    const result = this.database
      .prepare("UPDATE commercial_sessions SET active = 0 WHERE token = ? AND active = 1")
      .run(token);
    return result.changes > 0;
  }

  appendAuditEvent(event: IdentityAuditEvent): void {
    this.database
      .prepare(
        `INSERT INTO identity_audit_events
          (type, username, organization, permission, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        event.type,
        event.username,
        event.organization,
        event.permission ?? null,
        event.createdAt
      );
  }

  auditTrail(): IdentityAuditEvent[] {
    const rows = this.database
      .prepare(
        `SELECT type, username, organization, permission, created_at
         FROM identity_audit_events ORDER BY id ASC`
      )
      .all() as Array<{
      type?: string;
      username?: string;
      organization?: string;
      permission?: string | null;
      created_at?: string;
    }>;

    return rows
      .filter((row) => row.type && row.username && row.organization && row.created_at)
      .map((row) => ({
        type: row.type as IdentityAuditEvent["type"],
        username: row.username!,
        organization: row.organization!,
        permission: row.permission as CommercialPermission | undefined,
        createdAt: row.created_at!,
      }));
  }

  close(): void {
    if (this.database.isOpen) {
      this.database.close();
    }
  }
}
