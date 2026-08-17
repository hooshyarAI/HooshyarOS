import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export interface AuthenticatedUser {
    userId: string;
}

export class UserCredentialStore {
    private readonly database: DatabaseSync;

    constructor(databasePath: string) {
        this.database = new DatabaseSync(databasePath);
        this.database.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = FULL;
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        `);
    }

    createUser(userId: string, username: string, password: string): void {
        if (!userId.trim() || !username.trim()) throw new Error("User identity is required");
        this.validatePassword(password);
        const salt = randomBytes(16);
        const hash = this.derive(password, salt);

        this.database.prepare(`
            INSERT INTO users (user_id, username, password_salt, password_hash, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, username.trim().toLowerCase(), salt.toString("hex"), hash.toString("hex"), new Date().toISOString());
    }

    authenticate(username: string, password: string): AuthenticatedUser | null {
        if (!username || !password) return null;
        const row = this.database.prepare(`
            SELECT user_id, password_salt, password_hash FROM users WHERE username = ?
        `).get(username.trim().toLowerCase()) as { user_id: string; password_salt: string; password_hash: string } | undefined;

        if (!row) return null;
        const expected = Buffer.from(row.password_hash, "hex");
        const actual = this.derive(password, Buffer.from(row.password_salt, "hex"));
        if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
        return { userId: row.user_id };
    }

    close(): void {
        this.database.close();
    }

    private derive(password: string, salt: Buffer): Buffer {
        return scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    }

    private validatePassword(password: string): void {
        if (password.length < 12) throw new Error("Password must contain at least 12 characters");
    }
}
