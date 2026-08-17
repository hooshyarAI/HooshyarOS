import { DatabaseSync } from "node:sqlite";

export interface AuthorizationAssignment {
    userId: string;
    roles: string[];
}

export class DurableAuthorizationStore {
    private readonly db: DatabaseSync;

    constructor(databasePath: string) {
        this.db = new DatabaseSync(databasePath);
        this.db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = FULL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
            CREATE TABLE IF NOT EXISTS roles (
                name TEXT PRIMARY KEY
            );
            CREATE TABLE IF NOT EXISTS permissions (
                name TEXT PRIMARY KEY
            );
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_name TEXT NOT NULL REFERENCES roles(name) ON DELETE CASCADE,
                permission_name TEXT NOT NULL REFERENCES permissions(name) ON DELETE CASCADE,
                PRIMARY KEY (role_name, permission_name)
            );
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id TEXT NOT NULL,
                role_name TEXT NOT NULL REFERENCES roles(name) ON DELETE CASCADE,
                PRIMARY KEY (user_id, role_name)
            );
        `);
    }

    defineRole(name: string): void {
        if (!name) throw new Error("Role name is required");
        this.db.prepare("INSERT OR IGNORE INTO roles(name) VALUES (?)").run(name);
    }

    definePermission(name: string): void {
        if (!name) throw new Error("Permission name is required");
        this.db.prepare("INSERT OR IGNORE INTO permissions(name) VALUES (?)").run(name);
    }

    grant(roleName: string, permissionName: string): void {
        this.defineRole(roleName);
        this.definePermission(permissionName);
        this.db.prepare("INSERT OR IGNORE INTO role_permissions(role_name, permission_name) VALUES (?, ?)").run(roleName, permissionName);
    }

    assignRole(userId: string, roleName: string): void {
        if (!userId || !roleName) throw new Error("User and role are required");
        const role = this.db.prepare("SELECT name FROM roles WHERE name = ?").get(roleName) as { name: string } | undefined;
        if (!role) throw new Error("Unknown role");
        this.db.prepare("INSERT OR IGNORE INTO user_roles(user_id, role_name) VALUES (?, ?)").run(userId, roleName);
    }

    getAssignment(userId: string): AuthorizationAssignment {
        const rows = this.db.prepare("SELECT role_name FROM user_roles WHERE user_id = ? ORDER BY role_name").all(userId) as Array<{ role_name: string }>;
        return { userId, roles: rows.map((row) => row.role_name) };
    }

    getPermissions(userId: string): string[] {
        const rows = this.db.prepare(`
            SELECT DISTINCT rp.permission_name
            FROM user_roles ur
            JOIN role_permissions rp ON rp.role_name = ur.role_name
            WHERE ur.user_id = ?
            ORDER BY rp.permission_name
        `).all(userId) as Array<{ permission_name: string }>;
        return rows.map((row) => row.permission_name);
    }

    close(): void {
        this.db.close();
    }
}
