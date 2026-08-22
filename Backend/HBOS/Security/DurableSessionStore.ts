import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export interface DurableSession {
    userId: string;
    expiresAt: string;
}

export class DurableSessionStore {
    private readonly database: DatabaseSync;

    constructor(databasePath: string) {
        this.database = new DatabaseSync(databasePath);
        this.database.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = FULL;
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        `);
    }

    create(userId: string, ttlMs: number): string {
        if (!userId.trim()) throw new Error("Session userId is required");
        if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new Error("Session TTL must be a positive integer");

        const token = randomBytes(32).toString("base64url");
        const tokenHash = this.hash(token);
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + ttlMs);

        this.database.prepare(`
            INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(tokenHash, userId, createdAt.toISOString(), expiresAt.toISOString());

        return token;
    }

    get(token: string): DurableSession | null {
        if (!token) return null;
        const row = this.database.prepare(`
            SELECT user_id, expires_at FROM sessions WHERE token_hash = ?
        `).get(this.hash(token)) as { user_id: string; expires_at: string } | undefined;

        if (!row) return null;
        if (Date.parse(row.expires_at) <= Date.now()) {
            this.revoke(token);
            return null;
        }
        return { userId: row.user_id, expiresAt: row.expires_at };
    }

    revoke(token: string): void {
        if (!token) return;
        this.database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(this.hash(token));
    }

    cleanup(): number {
        const result = this.database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString()) as { changes?: number };
        return Number(result.changes ?? 0);
    }

    close(): void {
        this.database.close();
    }

    private hash(token: string): string {
        return createHash("sha256").update(token, "utf8").digest("hex");
    }
}
