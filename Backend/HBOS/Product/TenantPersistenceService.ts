import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { dirname, join } from "path";

export interface TenantRecord {
    tenantId: string;
    organizationId: string;
    createdAt: string;
    version: number;
    data: Record<string, unknown>;
}

export interface TenantPersistenceStore {
    save(record: TenantRecord): void;
    load(tenantId: string): TenantRecord | null;
    list(): TenantRecord[];
}

/**
 * Durable local persistence boundary for commercial tenant data.
 *
 * The storage contract is intentionally provider-agnostic so the same
 * application service can later use PostgreSQL/object storage without
 * changing product semantics.
 */
export class LocalTenantPersistenceStore implements TenantPersistenceStore {
    constructor(private readonly rootDirectory: string) {
        mkdirSync(this.rootDirectory, { recursive: true });
    }

    save(record: TenantRecord): void {
        const file = this.fileFor(record.tenantId);
        mkdirSync(dirname(file), { recursive: true });
        const temp = `${file}.tmp`;
        writeFileSync(temp, JSON.stringify(record, null, 2), "utf8");
        renameSync(temp, file);
    }

    load(tenantId: string): TenantRecord | null {
        const file = this.fileFor(tenantId);
        if (!existsSync(file)) return null;
        return JSON.parse(readFileSync(file, "utf8")) as TenantRecord;
    }

    list(): TenantRecord[] {
        const entries = require("fs").readdirSync(this.rootDirectory, { withFileTypes: true });
        return entries
            .filter((entry: { isFile: () => boolean; name: string }) => entry.isFile() && entry.name.endsWith(".json"))
            .map((entry: { name: string }) => JSON.parse(readFileSync(join(this.rootDirectory, entry.name), "utf8")) as TenantRecord);
    }

    private fileFor(tenantId: string): string {
        const safeId = tenantId.replace(/[^a-zA-Z0-9._-]/g, "_");
        return join(this.rootDirectory, `${safeId}.json`);
    }
}

export class TenantPersistenceService {
    constructor(private readonly store: TenantPersistenceStore) {}

    save(tenantId: string, organizationId: string, data: Record<string, unknown>): TenantRecord {
        const normalizedTenant = tenantId?.trim() ?? "";
        const normalizedOrganization = organizationId?.trim() ?? "";
        if (!normalizedTenant || !normalizedOrganization) {
            throw new Error("tenantId and organizationId are required");
        }

        const previous = this.store.load(normalizedTenant);
        const record: TenantRecord = {
            tenantId: normalizedTenant,
            organizationId: normalizedOrganization,
            createdAt: previous?.createdAt ?? new Date().toISOString(),
            version: (previous?.version ?? 0) + 1,
            data: { ...data }
        };
        this.store.save(record);
        return record;
    }

    loadForTenant(tenantId: string, organizationId: string): TenantRecord | null {
        const record = this.store.load(tenantId?.trim() ?? "");
        if (!record) return null;
        if (record.organizationId !== organizationId?.trim()) {
            throw new Error("TENANT_ISOLATION_VIOLATION");
        }
        return { ...record, data: { ...record.data } };
    }
}
