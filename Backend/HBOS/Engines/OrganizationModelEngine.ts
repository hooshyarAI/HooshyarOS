import { Engine } from "../Core/Engine";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { deriveTenantId } from "../Core/TenantIdentity";
import { UserRole } from "./UserManagementEngine";
import { randomBytes } from "node:crypto";

/**
 * Phase 13-1.2 — Real OrganizationModelEngine.
 *
 * Owns persistent organizations and their membership. The tenantId is derived
 * canonically from the organization name, so every organization is also the
 * tenant boundary used by the repository layer for isolation.
 */

export interface OrganizationRecord {
    readonly id: string;
    readonly name: string;
    readonly tenantId: string;
    readonly description?: string;
    readonly status: "ACTIVE" | "BLOCKED" | "PENDING_VERIFICATION";
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly memberCount: number;
}

export interface OrganizationMember {
    readonly tenantId: string;
    readonly userId: string;
    readonly role: UserRole;
    readonly joinedAt: string;
}

interface OrganizationRow {
    id: string;
    name: string;
    tenant_id: string;
    description: string | null;
    status: OrganizationRecord["status"];
    created_at: string;
    updated_at: string;
}

const ORGANIZATION_TABLE = "organizations";
const MEMBER_TABLE = "organization_members";

function toOrganizationRecord(row: OrganizationRow, memberCount: number): OrganizationRecord {
    return {
        id: row.id,
        name: row.name,
        tenantId: row.tenant_id,
        description: row.description ?? undefined,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        memberCount
    };
}

export class OrganizationModelEngine implements Engine {
    name = "OrganizationModelEngine";

    private readonly persistence: SQLitePersistenceStore;

    constructor(persistence?: SQLitePersistenceStore) {
        this.persistence = persistence ?? new SQLitePersistenceStore({ databasePath: ":memory:" });
    }

    initialize(): void {
        this.ensureTables();
    }

    health(): boolean {
        try {
            this.ensureTables();
            this.persistence.database.prepare(`SELECT COUNT(*) AS count FROM ${ORGANIZATION_TABLE}`).get();
            return true;
        } catch {
            return false;
        }
    }

    static tenantIdForOrganization(name: string): string {
        return deriveTenantId(name);
    }

    createOrganization(name: string, description?: string): OrganizationRecord {
        const cleanName = name?.trim() ?? "";
        const now = new Date().toISOString();
        if (!cleanName) {
            return {
                id: "",
                name: "",
                tenantId: "",
                description: undefined,
                status: "BLOCKED",
                createdAt: now,
                updatedAt: now,
                memberCount: 0
            };
        }

        this.ensureTables();
        const tenantId = deriveTenantId(cleanName);
        const existing = this.getOrganizationByTenantId(tenantId);
        if (existing) return existing;

        const organizationId = `org_${randomBytes(8).toString("hex")}`;
        this.persistence.database.prepare(`
            INSERT INTO ${ORGANIZATION_TABLE} (id, name, tenant_id, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
        `).run(organizationId, cleanName, tenantId, description ?? null, now, now);

        return {
            id: organizationId,
            name: cleanName,
            tenantId,
            description,
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now,
            memberCount: 0
        };
    }

    getOrganizationByName(name: string): OrganizationRecord | null {
        const cleanName = name?.trim() ?? "";
        if (!cleanName) return null;
        return this.getOrganizationByTenantId(deriveTenantId(cleanName));
    }

    getOrganizationByTenantId(tenantId: string): OrganizationRecord | null {
        if (!tenantId?.trim()) return null;
        this.ensureTables();
        const row = this.persistence.database
            .prepare(`SELECT * FROM ${ORGANIZATION_TABLE} WHERE tenant_id = ?`)
            .get(tenantId) as unknown as OrganizationRow | undefined;
        if (!row) return null;
        return toOrganizationRecord(row, this.countMembers(tenantId));
    }

    listOrganizations(): OrganizationRecord[] {
        this.ensureTables();
        const rows = this.persistence.database
            .prepare(`SELECT * FROM ${ORGANIZATION_TABLE} ORDER BY created_at ASC`)
            .all() as unknown as OrganizationRow[];
        return rows.map(row => toOrganizationRecord(row, this.countMembers(row.tenant_id)));
    }

    addMember(tenantId: string, userId: string, role: UserRole = "VIEWER"): boolean {
        if (!tenantId?.trim() || !userId?.trim()) return false;
        this.ensureTables();
        const joinedAt = new Date().toISOString();
        const result = this.persistence.database.prepare(`
            INSERT INTO ${MEMBER_TABLE} (tenant_id, user_id, role, joined_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(tenant_id, user_id) DO UPDATE SET role = excluded.role
        `).run(tenantId, userId, role, joinedAt);
        return Number(result.changes) > 0;
    }

    removeMember(tenantId: string, userId: string): boolean {
        if (!tenantId?.trim() || !userId?.trim()) return false;
        this.ensureTables();
        const result = this.persistence.database
            .prepare(`DELETE FROM ${MEMBER_TABLE} WHERE tenant_id = ? AND user_id = ?`)
            .run(tenantId, userId);
        return Number(result.changes) > 0;
    }

    isMember(tenantId: string, userId: string): boolean {
        if (!tenantId?.trim() || !userId?.trim()) return false;
        this.ensureTables();
        const row = this.persistence.database
            .prepare(`SELECT 1 AS present FROM ${MEMBER_TABLE} WHERE tenant_id = ? AND user_id = ?`)
            .get(tenantId, userId);
        return Boolean(row);
    }

    listMembers(tenantId: string): OrganizationMember[] {
        if (!tenantId?.trim()) return [];
        this.ensureTables();
        const rows = this.persistence.database
            .prepare(`SELECT tenant_id, user_id, role, joined_at FROM ${MEMBER_TABLE} WHERE tenant_id = ? ORDER BY joined_at ASC`)
            .all(tenantId) as unknown as Array<{ tenant_id: string; user_id: string; role: UserRole; joined_at: string }>;
        return rows.map(row => ({ tenantId: row.tenant_id, userId: row.user_id, role: row.role, joinedAt: row.joined_at }));
    }

    shutdown(): void {
        // Shared persistence store is owned by the composition root; do not close it here.
    }

    private countMembers(tenantId: string): number {
        this.ensureTables();
        const row = this.persistence.database
            .prepare(`SELECT COUNT(*) AS count FROM ${MEMBER_TABLE} WHERE tenant_id = ?`)
            .get(tenantId) as { count: number } | undefined;
        return Number(row?.count ?? 0);
    }

    private ensureTables(): void {
        this.persistence.database.exec(`
            CREATE TABLE IF NOT EXISTS ${ORGANIZATION_TABLE} (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                tenant_id TEXT NOT NULL UNIQUE,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_orgs_tenant ON ${ORGANIZATION_TABLE}(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_orgs_name ON ${ORGANIZATION_TABLE}(name);

            CREATE TABLE IF NOT EXISTS ${MEMBER_TABLE} (
                tenant_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'VIEWER',
                joined_at TEXT NOT NULL,
                PRIMARY KEY (tenant_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_members_tenant ON ${MEMBER_TABLE}(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_members_user ON ${MEMBER_TABLE}(user_id);
        `);
    }
}
