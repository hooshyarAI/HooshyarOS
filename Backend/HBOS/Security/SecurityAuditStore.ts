import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export interface SecurityAuditEvent {
    eventId?: string;
    eventType: "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "AUTHORIZATION_DENIED" | "ROLE_ASSIGNED" | "LOGOUT";
    userId?: string;
    sessionIdHash?: string;
    permission?: string;
    role?: string;
    reason?: string;
    occurredAt?: string;
}

export class SecurityAuditStore {
    private readonly db: DatabaseSync;

    constructor(databasePath: string) {
        this.db = new DatabaseSync(databasePath);
        this.db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = FULL;
            PRAGMA busy_timeout = 5000;
            CREATE TABLE IF NOT EXISTS security_audit (
                event_id TEXT PRIMARY KEY,
                event_type TEXT NOT NULL,
                user_id TEXT,
                session_id_hash TEXT,
                permission TEXT,
                role TEXT,
                reason TEXT,
                occurred_at TEXT NOT NULL
            );
        `);
    }

    record(event: SecurityAuditEvent): string {
        const eventId = event.eventId ?? randomUUID();
        const occurredAt = event.occurredAt ?? new Date().toISOString();
        this.db.prepare(`
            INSERT INTO security_audit
            (event_id,event_type,user_id,session_id_hash,permission,role,reason,occurred_at)
            VALUES (?,?,?,?,?,?,?,?)
        `).run(eventId, event.eventType, event.userId ?? null, event.sessionIdHash ?? null, event.permission ?? null, event.role ?? null, event.reason ?? null, occurredAt);
        return eventId;
    }

    recordSessionEvent(eventType: SecurityAuditEvent["eventType"], userId: string, sessionToken: string, reason?: string): string {
        const sessionIdHash = createHash("sha256").update(sessionToken).digest("hex");
        return this.record({ eventType, userId, sessionIdHash, reason });
    }

    listByUser(userId: string): SecurityAuditEvent[] {
        return this.db.prepare(`
            SELECT event_id AS eventId,event_type AS eventType,user_id AS userId,session_id_hash AS sessionIdHash,permission,role,reason,occurred_at AS occurredAt
            FROM security_audit WHERE user_id = ? ORDER BY rowid ASC
        `).all(userId) as unknown as SecurityAuditEvent[];
    }

    close(): void {
        this.db.close();
    }
}
