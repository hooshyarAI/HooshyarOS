/**
 * Phase 05C-F1 + F2 Tests - Retention Policy and Backup Security
 */
import { RetentionStore, RecordType } from "../Entities/RetentionPolicy";
import { BackupSecurityValidator } from "../Entities/BackupSecurity";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";

const RETENTION_DB = join(__dirname, "test-retention.sqlite");
const BACKUP_FILE = join(__dirname, "test-backup.json");

function cleanupRetention() {
    try { if (existsSync(RETENTION_DB)) unlinkSync(RETENTION_DB); } catch { /* ignore */ }
}

function cleanupBackup() {
    try { if (existsSync(BACKUP_FILE)) unlinkSync(BACKUP_FILE); } catch { /* ignore */ }
}

describe("RetentionStore", () => {
    afterEach(() => cleanupRetention());

    it("creates a retention policy", () => {
        const store = new RetentionStore(RETENTION_DB);

        const policy = store.createPolicy({
            recordType: "AUDIT_EVENT",
            tenantId: "tenant-retention",
            minimumDays: 30,
            maximumDays: 365
        });

        expect(policy.policyId).toMatch(/^RET-AUDIT_EVENT/);
        expect(policy.recordType).toBe("AUDIT_EVENT");
        expect(policy.tenantId).toBe("tenant-retention");
        expect(policy.minimumDays).toBe(30);
        expect(policy.maximumDays).toBe(365);
        expect(policy.legalHold).toBe(false);

        store.close();
    });

    it("rejects invalid retention bounds", () => {
        const store = new RetentionStore(RETENTION_DB);

        expect(() => {
            store.createPolicy({
                recordType: "AUDIT_EVENT",
                minimumDays: 0, // Invalid: < 1
                maximumDays: 30
            });
        }).toThrow("minimumDays must be at least 1");

        expect(() => {
            store.createPolicy({
                recordType: "AUDIT_EVENT",
                minimumDays: 100,
                maximumDays: 50 // Invalid: < minimumDays
            });
        }).toThrow("maximumDays must be >= minimumDays");

        store.close();
    });

    it("sets legal hold on a policy", () => {
        const store = new RetentionStore(RETENTION_DB);

        const policy = store.createPolicy({
            recordType: "SECURITY_EVENT",
            tenantId: "tenant-hold",
            minimumDays: 7,
            maximumDays: 90
        });

        expect(policy.legalHold).toBe(false);

        const updated = store.setLegalHold(policy.policyId, true, "admin-user");

        expect(updated.legalHold).toBe(true);

        store.close();
    });

    it("checkRetention returns canDelete=false for new records", () => {
        const store = new RetentionStore(RETENTION_DB);

        store.createPolicy({
            recordType: "MEMORY_EVENT",
            minimumDays: 30,
            maximumDays: 365
        });

        const now = new Date();
        const result = store.checkRetention(now.toISOString(), "MEMORY_EVENT");

        expect(result.canDelete).toBe(false);
        expect(result.legalHoldActive).toBe(false);
        expect(result.daysUntilDeletion).toBeGreaterThan(0);

        store.close();
    });

    it("checkRetention returns canDelete=true when minimum days exceeded and no legal hold", () => {
        const store = new RetentionStore(RETENTION_DB);

        store.createPolicy({
            recordType: "KNOWLEDGE_EVENT",
            minimumDays: 1,
            maximumDays: 2
        });

        // Record from 3 days ago
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const result = store.checkRetention(threeDaysAgo.toISOString(), "KNOWLEDGE_EVENT");

        expect(result.canDelete).toBe(true);
        expect(result.reason).toContain("exceeded");

        store.close();
    });

    it("checkRetention returns canDelete=false when legal hold is active", () => {
        const store = new RetentionStore(RETENTION_DB);

        const policy = store.createPolicy({
            recordType: "DECISION_EVENT",
            minimumDays: 1,
            maximumDays: 30
        });

        store.setLegalHold(policy.policyId, true);

        const result = store.checkRetention(new Date().toISOString(), "DECISION_EVENT");

        expect(result.canDelete).toBe(false);
        expect(result.legalHoldActive).toBe(true);
        expect(result.reason).toContain("Legal hold");

        store.close();
    });

    it("uses global policy when tenant-specific not found", () => {
        const store = new RetentionStore(RETENTION_DB);

        store.createPolicy({
            recordType: "ENCRYPTION_KEY",
            tenantId: undefined, // Global
            minimumDays: 90,
            maximumDays: 730
        });

        const result = store.checkRetention(new Date().toISOString(), "ENCRYPTION_KEY", "unknown-tenant");

        // Should use global policy
        expect(result.legalHoldActive).toBe(false);

        store.close();
    });
});

describe("BackupSecurityValidator", () => {
    afterEach(() => cleanupBackup());

    it("generates backup manifest with security metadata", () => {
        const validator = new BackupSecurityValidator();

        const manifest = validator.generateBackupManifest({
            tenantId: "tenant-backup",
            components: ["AUDIT_EVENTS", "SECURITY_EVENTS"],
            dataWasEncrypted: true,
            encryptionKeyVersion: 3,
            encryptionAlgorithm: "AES-256-GCM",
            initiatedBy: "backup-service"
        });

        expect(manifest.backupId).toMatch(/^BACKUP-/);
        expect(manifest.tenantId).toBe("tenant-backup");
        expect(manifest.dataWasEncrypted).toBe(true);
        expect(manifest.encryptionKeyVersion).toBe(3);
        expect(manifest.components).toContain("AUDIT_EVENTS");
    });

    it("verifies backup integrity", () => {
        const validator = new BackupSecurityValidator();

        // Create a backup
        const manifest = validator.generateBackupManifest({
            tenantId: "tenant-verify",
            components: ["AUDIT_EVENTS"],
            dataWasEncrypted: false
        });

        const contents = { AUDIT_EVENTS: [{ id: "evt-1", data: "test" }] };
        validator.createBackupFile({
            backupPath: BACKUP_FILE,
            metadata: manifest,
            contents
        });

        // Verify it
        const result = validator.verifyBackupIntegrity(BACKUP_FILE, "tenant-verify");

        expect(result.valid).toBe(true);
        expect(result.status).toBe("VALID");
    });

    it("detects tenant mismatch in backup", () => {
        const validator = new BackupSecurityValidator();

        const manifest = validator.generateBackupManifest({
            tenantId: "tenant-a",
            components: ["AUDIT_EVENTS"],
            dataWasEncrypted: false
        });

        const contents = { AUDIT_EVENTS: [] };
        validator.createBackupFile({
            backupPath: BACKUP_FILE,
            metadata: manifest,
            contents
        });

        // Verify with wrong tenant
        const result = validator.verifyBackupIntegrity(BACKUP_FILE, "tenant-b");

        expect(result.valid).toBe(false);
        expect(result.status).toBe("TENANT_MISMATCH");
    });

    it("detects corrupted backup when content hash doesn't match", () => {
        const validator = new BackupSecurityValidator();
        const corruptFile = join(__dirname, "test-backup-corrupt2.json");

        try {
            const manifest = validator.generateBackupManifest({
                tenantId: "tenant-corrupt",
                components: ["AUDIT_EVENTS"],
                dataWasEncrypted: false
            });

            // Create backup with some content
            const contents = { AUDIT_EVENTS: [{ id: "evt-1" }] };
            validator.createBackupFile({
                backupPath: corruptFile,
                metadata: manifest,
                contents
            });

            // Corrupt the file by modifying the content hash in metadata
            const fileContent = require("node:fs").readFileSync(corruptFile, "utf8");
            const parsed = JSON.parse(fileContent);
            // Tamper with the stored content hash
            parsed.metadata.contentHash = "0000000000000000000000000000000000000000000000000000000000000000";
            require("node:fs").writeFileSync(corruptFile, JSON.stringify(parsed), "utf8");

            const result = validator.verifyBackupIntegrity(corruptFile, "tenant-corrupt");

            expect(result.valid).toBe(false);
            expect(result.status).toBe("CORRUPTED");
        } finally {
            try { require("node:fs").unlinkSync(corruptFile); } catch { /* ignore */ }
        }
    });

    it("verifies encryption metadata compatibility", () => {
        const validator = new BackupSecurityValidator();

        const manifest = validator.generateBackupManifest({
            tenantId: "tenant-enc",
            components: ["ENCRYPTION_KEYS"],
            dataWasEncrypted: true,
            encryptionKeyVersion: 2
        });

        const contents = { ENCRYPTION_KEYS: [] };
        validator.createBackupFile({
            backupPath: BACKUP_FILE,
            metadata: manifest,
            contents
        });

        // Compatible - current version is same or higher
        const compatible = validator.verifyEncryptionMetadata(BACKUP_FILE, 2);
        expect(compatible.valid).toBe(true);

        // Incompatible - backup requires newer key version
        const incompatible = validator.verifyEncryptionMetadata(BACKUP_FILE, 1);
        expect(incompatible.valid).toBe(false);
        expect(incompatible.status).toBe("ENCRYPTION_MISMATCH");
    });

    it("computes content hash deterministically", () => {
        const validator = new BackupSecurityValidator();

        const contents1 = { AUDIT_EVENTS: [{ id: "evt-1", data: "test" }] };
        const contents2 = { AUDIT_EVENTS: [{ id: "evt-1", data: "test" }] };
        const contents3 = { AUDIT_EVENTS: [{ data: "test", id: "evt-1" }] }; // Different order

        const hash1 = validator.computeContentHash(contents1);
        const hash2 = validator.computeContentHash(contents2);
        const hash3 = validator.computeContentHash(contents3);

        expect(hash1).toBe(hash2);
        // Note: JSON.stringify with sort order makes this deterministic
    });
});
