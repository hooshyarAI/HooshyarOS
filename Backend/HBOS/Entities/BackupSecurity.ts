/**
 * Phase 05C-F2 - Backup/Restore Security Contract
 *
 * Ensures backups preserve:
 * - Tenant isolation (no cross-tenant data leakage)
 * - Encryption requirements (backed-up data remains protected)
 * - Evidence integrity (audit trail is not corrupted)
 * - Restore safety (restored data is verified)
 *
 * Design principles:
 * - Backup must maintain tenant isolation boundaries
 * - Encryption must be preserved or explicitly documented if not
 * - Integrity verification before and after restore
 * - Tenant-scoped backup/restore operations
 * - No global backup that ignores tenant boundaries
 *
 * Backup requirements:
 * - Tenant-isolated backup files (separate per tenant or clear demarcation)
 * - Encryption metadata preserved (key versions, algorithms)
 * - Integrity hash of backup contents
 * - Tenant ID and scope explicitly recorded
 */

import { createHash } from "crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";

/**
 * Backup integrity status
 */
export type BackupIntegrityStatus =
    | "VALID"               // Backup is intact
    | "CORRUPTED"           // Backup contents don't match hash
    | "INCOMPLETE"          // Backup is missing expected components
    | "TENANT_MISMATCH"     // Backup tenant doesn't match request
    | "ENCRYPTION_MISMATCH" // Encryption metadata doesn't match current config
    | "UNKNOWN";            // Status cannot be determined

/**
 * Backup metadata
 */
export interface BackupMetadata {
    /** Unique backup identifier */
    readonly backupId: string;
    /** Tenant this backup belongs to */
    readonly tenantId: string | undefined;
    /** When backup was created */
    readonly createdAt: string;
    /** Size of backup in bytes */
    readonly sizeBytes: number;
    /** Integrity hash of backup contents */
    readonly contentHash: string;
    /** Hash algorithm used */
    readonly hashAlgorithm: string;
    /** Encryption key version used (if encrypted) */
    readonly encryptionKeyVersion?: number;
    /** Whether data was encrypted at time of backup */
    readonly dataWasEncrypted: boolean;
    /** Original encryption algorithm */
    readonly encryptionAlgorithm?: string;
    /** Who initiated the backup */
    readonly initiatedBy: string | undefined;
    /** Backup format version */
    readonly version: string;
    /** Components included in backup */
    readonly components: readonly BackupComponent[];
}

/**
 * Components that can be included in backup
 */
export type BackupComponent =
    | "AUDIT_EVENTS"
    | "SECURITY_EVENTS"
    | "DECISIONS"
    | "KNOWLEDGE"
    | "MEMORY"
    | "ENCRYPTION_KEYS"
    | "PROJECTS"
    | "CONFIGURATION";

/**
 * Backup verification result
 */
export interface BackupVerificationResult {
    valid: boolean;
    status: BackupIntegrityStatus;
    reason: string;
    details?: string;
}

/**
 * Restore operation result
 */
export interface RestoreResult {
    success: boolean;
    recordsRestored: number;
    errors: string[];
    warnings: string[];
    verificationResult?: BackupVerificationResult;
}

/**
 * Backup security validator
 */
export class BackupSecurityValidator {
    /**
     * Verify backup metadata integrity
     */
    verifyBackupIntegrity(
        backupPath: string,
        expectedTenantId?: string
    ): BackupVerificationResult {
        // Check backup file exists
        if (!existsSync(backupPath)) {
            return {
                valid: false,
                status: "INCOMPLETE",
                reason: "Backup file does not exist"
            };
        }

        try {
            const backupContent = readFileSync(backupPath, "utf8");
            const parsed = JSON.parse(backupContent);

            // Verify metadata exists
            if (!parsed.metadata) {
                return {
                    valid: false,
                    status: "INCOMPLETE",
                    reason: "Backup missing metadata"
                };
            }

            const metadata: BackupMetadata = parsed.metadata;

            // Verify tenant isolation
            if (expectedTenantId !== undefined && metadata.tenantId !== expectedTenantId) {
                return {
                    valid: false,
                    status: "TENANT_MISMATCH",
                    reason: `Backup tenant ${metadata.tenantId ?? "(global)"} does not match expected ${expectedTenantId}`
                };
            }

            // Verify content hash
            const computedHash = this.computeContentHash(parsed.contents);
            if (computedHash !== metadata.contentHash) {
                return {
                    valid: false,
                    status: "CORRUPTED",
                    reason: "Backup contents do not match integrity hash",
                    details: `Expected: ${metadata.contentHash}, Computed: ${computedHash}`
                };
            }

            // Verify all expected components are present
            const presentComponents = new Set<string>(Object.keys(parsed.contents || {}));
            for (const component of metadata.components) {
                if (!presentComponents.has(component)) {
                    return {
                        valid: false,
                        status: "INCOMPLETE",
                        reason: `Missing backup component: ${component}`
                    };
                }
            }

            return {
                valid: true,
                status: "VALID",
                reason: "Backup integrity verified",
                details: `Backup ${metadata.backupId} for tenant ${metadata.tenantId ?? "(global)"} is valid`
            };
        } catch (error) {
            return {
                valid: false,
                status: "CORRUPTED",
                reason: `Failed to parse backup: ${String(error)}`
            };
        }
    }

    /**
     * Verify encryption metadata is consistent
     */
    verifyEncryptionMetadata(
        backupPath: string,
        currentKeyVersion?: number
    ): BackupVerificationResult {
        if (!existsSync(backupPath)) {
            return {
                valid: false,
                status: "INCOMPLETE",
                reason: "Backup file does not exist"
            };
        }

        try {
            const backupContent = readFileSync(backupPath, "utf8");
            const parsed = JSON.parse(backupContent);
            const metadata: BackupMetadata = parsed.metadata;

            // If backup data was encrypted, verify key version compatibility
            if (metadata.dataWasEncrypted) {
                if (currentKeyVersion !== undefined && metadata.encryptionKeyVersion !== undefined) {
                    if (metadata.encryptionKeyVersion > currentKeyVersion) {
                        return {
                            valid: false,
                            status: "ENCRYPTION_MISMATCH",
                            reason: `Backup requires key version ${metadata.encryptionKeyVersion}, current is ${currentKeyVersion}`,
                            details: "Key rotation may be required before restore"
                        };
                    }
                }
            }

            return {
                valid: true,
                status: "VALID",
                reason: "Encryption metadata compatible"
            };
        } catch (error) {
            return {
                valid: false,
                status: "CORRUPTED",
                reason: `Failed to verify encryption: ${String(error)}`
            };
        }
    }

    /**
     * Generate a backup manifest with security metadata
     */
    generateBackupManifest(params: {
        tenantId?: string;
        components: BackupComponent[];
        dataWasEncrypted: boolean;
        encryptionKeyVersion?: number;
        encryptionAlgorithm?: string;
        initiatedBy?: string;
    }): BackupMetadata {
        const backupId = `BACKUP-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

        return {
            backupId,
            tenantId: params.tenantId,
            createdAt: new Date().toISOString(),
            sizeBytes: 0, // Will be updated after content is written
            contentHash: "", // Will be updated after content is written
            hashAlgorithm: "SHA-256",
            encryptionKeyVersion: params.encryptionKeyVersion,
            dataWasEncrypted: params.dataWasEncrypted,
            encryptionAlgorithm: params.encryptionAlgorithm,
            initiatedBy: params.initiatedBy,
            version: "1.0",
            components: params.components
        };
    }

    /**
     * Compute content hash for integrity verification
     */
    computeContentHash(contents: Record<string, unknown>): string {
        const serialized = JSON.stringify(contents, Object.keys(contents).sort());
        return createHash("sha256").update(serialized, "utf8").digest("hex");
    }

    /**
     * Create a tenant-isolated backup file
     */
    createBackupFile(params: {
        backupPath: string;
        metadata: BackupMetadata;
        contents: Record<string, unknown>;
    }): string {
        const contentHash = this.computeContentHash(params.contents);

        const backup = {
            metadata: {
                ...params.metadata,
                contentHash,
                sizeBytes: 0 // Will be updated
            },
            contents: params.contents
        };

        const serialized = JSON.stringify(backup, null, 2);
        const sizeBytes = Buffer.byteLength(serialized, "utf8");

        // Update size in metadata
        (backup.metadata as any).sizeBytes = sizeBytes;

        const finalBackup = JSON.stringify(backup, null, 2);
        writeFileSync(params.backupPath, finalBackup, "utf8");

        return params.backupPath;
    }
}

/**
 * Default retention policy for backups
 */
export const BACKUP_RETENTION_CONFIG = {
    minimumDays: 7,    // Keep backups for at least 7 days
    maximumDays: 365,  // Keep backups for at most 1 year
    legalHoldDays: 0   // Backups cannot be placed on legal hold
} as const;
