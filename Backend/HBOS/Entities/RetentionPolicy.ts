/**
 * Phase 05C-F1 - Audit Retention Contract
 *
 * Defines enforceable retention metadata and policy for audit records.
 *
 * Design principles:
 * - Retention policy is configurable, not hard-coded
 * - Legal hold flag overrides retention period
 * - Minimum and maximum retention bounds prevent abuse
 * - Retention applies per tenant and per record type
 * - Policy changes do not affect records already in legal hold
 *
 * Retention policy fields:
 * - minimumDays: minimum retention period (prevents premature deletion)
 * - maximumDays: maximum retention period (regulatory/compliance limit)
 * - legalHold: overrides retention period until explicitly released
 * - recordType: the type of records this policy applies to
 * - tenantId: tenant scope (undefined = global/system)
 *
 * IMPORTANT:
 * - Do not invent legal retention periods
 * - Actual retention periods must be configured by tenant administrator
 * - This contract provides the ENFORCEMENT mechanism, not the policy
 */

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Retention period unit
 */
export type RetentionUnit = "DAYS" | "WEEKS" | "MONTHS" | "YEARS";

/**
 * Record type for retention classification
 */
export type RecordType =
    | "AUDIT_EVENT"
    | "SECURITY_EVENT"
    | "DECISION_EVENT"
    | "KNOWLEDGE_EVENT"
    | "MEMORY_EVENT"
    | "ENCRYPTION_KEY"
    | "PROJECT_DATA";

/**
 * Retention policy
 */
export interface RetentionPolicy {
    /** Unique policy identifier */
    readonly policyId: string;
    /** Record type this policy applies to */
    readonly recordType: RecordType;
    /** Tenant scope (undefined = global/system) */
    readonly tenantId: string | undefined;
    /** Minimum retention period */
    readonly minimumDays: number;
    /** Maximum retention period */
    readonly maximumDays: number;
    /** Whether records are in legal hold */
    readonly legalHold: boolean;
    /** When the policy was created */
    readonly createdAt: string;
    /** When the policy was last modified */
    readonly modifiedAt: string;
    /** Who created the policy */
    readonly createdBy: string | undefined;
}

/**
 * Retention policy configuration (for creation)
 */
export interface RetentionPolicyConfig {
    recordType: RecordType;
    tenantId?: string;
    minimumDays: number;
    maximumDays: number;
    legalHold?: boolean;
    createdBy?: string;
}

/**
 * Retention check result
 */
export interface RetentionCheckResult {
    /** Whether the record can be deleted */
    canDelete: boolean;
    /** Reason for the decision */
    reason: string;
    /** Days until eligible for deletion (if canDelete is false) */
    daysUntilDeletion?: number;
    /** Whether legal hold is active */
    legalHoldActive: boolean;
}

/**
 * Retention metadata stored with each record
 */
export interface RecordRetentionMetadata {
    /** When the record was created */
    readonly createdAt: string;
    /** Policy ID governing this record */
    readonly retentionPolicyId: string | undefined;
    /** Whether this record is in legal hold */
    readonly legalHold: boolean;
    /** When deletion is first allowed (computed) */
    readonly deletableAfter: string | undefined;
}

/**
 * Retention policy store
 */
export class RetentionStore {
    private readonly database: DatabaseSync;

    constructor(private readonly databasePath: string) {
        const resolved = resolve(databasePath);
        mkdirSync(dirname(resolved), { recursive: true });
        this.database = new DatabaseSync(resolved);
        this.initialize();
    }

    private initialize(): void {
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS retention_policies (
                policy_id TEXT PRIMARY KEY,
                record_type TEXT NOT NULL,
                tenant_id TEXT,
                minimum_days INTEGER NOT NULL DEFAULT 30,
                maximum_days INTEGER NOT NULL DEFAULT 2555,
                legal_hold INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                modified_at TEXT NOT NULL,
                created_by TEXT,
                UNIQUE(record_type, tenant_id)
            )
        `);

        this.database.exec(`
            CREATE INDEX IF NOT EXISTS idx_retention_policy_tenant
            ON retention_policies(tenant_id)
        `);
    }

    /**
     * Create or update a retention policy
     */
    createPolicy(config: RetentionPolicyConfig): RetentionPolicy {
        const policyId = `RET-${config.recordType}-${config.tenantId ?? "GLOBAL"}-${Date.now().toString(36)}`;
        const now = new Date().toISOString();

        // Validate bounds
        if (config.minimumDays < 1) {
            throw new Error("minimumDays must be at least 1");
        }
        if (config.maximumDays < config.minimumDays) {
            throw new Error("maximumDays must be >= minimumDays");
        }
        if (config.maximumDays > 3650) {
            throw new Error("maximumDays cannot exceed 3650 (10 years)");
        }

        this.database.prepare(`
            INSERT OR REPLACE INTO retention_policies (
                policy_id, record_type, tenant_id, minimum_days, maximum_days,
                legal_hold, created_at, modified_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            policyId,
            config.recordType,
            config.tenantId ?? null,
            config.minimumDays,
            config.maximumDays,
            config.legalHold ? 1 : 0,
            now,
            now,
            config.createdBy ?? null
        );

        return this.getPolicy(policyId)!;
    }

    /**
     * Get a retention policy by ID
     */
    getPolicy(policyId: string): RetentionPolicy | undefined {
        const row = this.database.prepare(
            "SELECT * FROM retention_policies WHERE policy_id = ?"
        ).get(policyId) as unknown as RetentionPolicyRow | undefined;

        return row ? this.rowToPolicy(row) : undefined;
    }

    /**
     * Get retention policy for a record type and tenant
     */
    getPolicyForRecordType(recordType: RecordType, tenantId?: string): RetentionPolicy | undefined {
        // Try tenant-specific policy first
        let row = tenantId
            ? this.database.prepare(
                "SELECT * FROM retention_policies WHERE record_type = ? AND tenant_id = ?"
            ).get(recordType, tenantId) as unknown as RetentionPolicyRow | undefined
            : undefined;

        // Fall back to global policy
        if (!row) {
            row = this.database.prepare(
                "SELECT * FROM retention_policies WHERE record_type = ? AND tenant_id IS NULL"
            ).get(recordType) as unknown as RetentionPolicyRow | undefined;
        }

        return row ? this.rowToPolicy(row) : undefined;
    }

    /**
     * Set legal hold on a policy
     */
    setLegalHold(policyId: string, hold: boolean, modifiedBy?: string): RetentionPolicy {
        const now = new Date().toISOString();
        this.database.prepare(`
            UPDATE retention_policies
            SET legal_hold = ?, modified_at = ?, created_by = COALESCE(?, created_by)
            WHERE policy_id = ?
        `).run(hold ? 1 : 0, now, modifiedBy ?? null, policyId);

        return this.getPolicy(policyId)!;
    }

    /**
     * Check if a record can be deleted
     */
    checkRetention(recordCreatedAt: string, recordType: RecordType, tenantId?: string): RetentionCheckResult {
        const policy = this.getPolicyForRecordType(recordType, tenantId);
        const createdAt = new Date(recordCreatedAt);
        const now = new Date();

        // No policy = use default (30 days minimum, 365 days maximum)
        const minDays = policy?.minimumDays ?? 30;
        const maxDays = policy?.maximumDays ?? 365;
        const legalHold = policy?.legalHold ?? false;

        // Calculate boundaries
        const minDate = new Date(createdAt);
        minDate.setDate(minDate.getDate() + minDays);

        const maxDate = new Date(createdAt);
        maxDate.setDate(maxDate.getDate() + maxDays);

        // Legal hold overrides everything
        if (legalHold) {
            return {
                canDelete: false,
                reason: "Legal hold is active on this record type",
                legalHoldActive: true
            };
        }

        // Too new - minimum retention not met
        if (now < minDate) {
            const daysUntil = Math.ceil((minDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
                canDelete: false,
                reason: `Minimum retention period of ${minDays} days not met`,
                daysUntilDeletion: daysUntil,
                legalHoldActive: false
            };
        }

        // Too old - maximum retention exceeded
        if (now > maxDate) {
            return {
                canDelete: true,
                reason: `Maximum retention period of ${maxDays} days exceeded`,
                legalHoldActive: false
            };
        }

        // Within retention window
        const daysUntilDeletion = Math.ceil((maxDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
            canDelete: false,
            reason: `Within retention window (${minDays}-${maxDays} days)`,
            daysUntilDeletion,
            legalHoldActive: false
        };
    }

    /**
     * List all retention policies
     */
    listPolicies(tenantId?: string): RetentionPolicy[] {
        const rows = tenantId
            ? this.database.prepare(
                "SELECT * FROM retention_policies WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY record_type"
            ).all(tenantId) as unknown as RetentionPolicyRow[]
            : this.database.prepare(
                "SELECT * FROM retention_policies ORDER BY record_type"
            ).all() as unknown as RetentionPolicyRow[];

        return rows.map(r => this.rowToPolicy(r));
    }

    /**
     * Delete a retention policy
     */
    deletePolicy(policyId: string): void {
        this.database.prepare("DELETE FROM retention_policies WHERE policy_id = ?").run(policyId);
    }

    /**
     * Close the store
     */
    close(): void {
        if (this.database.isOpen) this.database.close();
    }

    private rowToPolicy(row: RetentionPolicyRow): RetentionPolicy {
        return {
            policyId: row.policy_id,
            recordType: row.record_type as RecordType,
            tenantId: row.tenant_id ?? undefined,
            minimumDays: row.minimum_days,
            maximumDays: row.maximum_days,
            legalHold: Boolean(row.legal_hold),
            createdAt: row.created_at,
            modifiedAt: row.modified_at,
            createdBy: row.created_by ?? undefined
        };
    }
}

interface RetentionPolicyRow {
    policy_id: string;
    record_type: string;
    tenant_id: string | null;
    minimum_days: number;
    maximum_days: number;
    legal_hold: number;
    created_at: string;
    modified_at: string;
    created_by: string | null;
}
