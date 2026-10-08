/**
 * Phase 05C-D4 - Encryption Service
 * 
 * Provides field-level encryption for CONFIDENTIAL and SENSITIVE_FINANCIAL_PERSONAL data.
 * 
 * Architecture:
 * - AES-256-GCM for authenticated encryption
 * - Per-tenant DEK (Data Encryption Key)
 * - KEK (Key Encryption Key) derived from root key
 * - Envelope encryption: KEK wraps DEK, DEK encrypts fields
 * - Random IV per encryption operation
 * 
 * Security properties:
 * - Confidentiality: AES-256-GCM authenticated encryption
 * - Integrity: GCM authentication tag verification
 * - No deterministic encryption (IV prevents pattern detection)
 * 
 * Offline capability:
 * - Local keystore for KEK
 * - Per-tenant DEKs stored encrypted in database
 * - No cloud/network dependency
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from "crypto";

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
    /** Root key source - must be provided via environment or secure config */
    rootKeySource: "environment" | "config";
    /** Root key (32 bytes hex encoded) - NEVER hard-code */
    rootKey?: string;
    /** Key derivation salt */
    salt?: string;
}

/**
 * Encrypted data structure (stored in database)
 */
export interface EncryptedValue {
    readonly algorithm: "AES-256-GCM";
    readonly iv: string;      // hex encoded IV
    readonly ciphertext: string; // hex encoded ciphertext
    readonly tag: string;     // hex encoded auth tag
    readonly version: number; // key version for rotation
}

/**
 * Per-tenant DEK metadata
 */
interface DEKMetadata {
    tenantId: string;
    encryptedDEK: string;  // DEK encrypted by KEK
    version: number;
    createdAt: string;
    rotatedAt?: string;
}

/**
 * Result of encryption operation
 */
export interface EncryptionResult {
    success: boolean;
    data?: EncryptedValue;
    error?: string;
}

/**
 * Result of decryption operation
 */
export interface DecryptionResult {
    success: boolean;
    data?: string;
    error?: string;
}

/**
 * Key provider interface - allows future KMS/HSM integration
 */
export interface IKeyProvider {
    /**
     * Initialize key provider
     */
    initialize(): Promise<void>;

    /**
     * Get DEK for tenant (creates if not exists)
     */
    getDEK(tenantId: string): Promise<{ key: Buffer; version: number }>;

    /**
     * Rotate DEK for tenant
     */
    rotateDEK(tenantId: string): Promise<{ key: Buffer; version: number }>;

    /**
     * Check if key provider is healthy
     */
    health(): Promise<boolean>;

    /**
     * Set database connection for DEK storage (LocalKeyProvider specific)
     */
    setDatabase(db: any): void;
}

/**
 * Local key provider - offline capable
 * 
 * Key hierarchy:
 * Root Key (from environment) -> KEK -> Per-tenant DEK -> Field encryption
 */
export class LocalKeyProvider implements IKeyProvider {
    private rootKey!: Buffer;
    private kek!: Buffer;
    private dekCache: Map<string, { key: Buffer; version: number }> = new Map();
    private dekMetadata: Map<string, DEKMetadata> = new Map();
    private db: any;
    private initialized: boolean = false;
    private readonly ALGORITHM = "aes-256-gcm";
    private readonly KEY_LENGTH = 32; // 256 bits
    private readonly IV_LENGTH = 12;  // 96 bits for GCM
    private readonly TAG_LENGTH = 16; // 128 bits

    constructor(private config: EncryptionConfig) {}

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Get root key from environment or config
        const rootKeyHex = this.getRootKey();
        this.rootKey = Buffer.from(rootKeyHex, "hex");

        // Derive KEK from root key using scrypt
        const salt = this.config.salt || "hooshyaros-kek-salt";
        this.kek = scryptSync(this.rootKey, salt, this.KEY_LENGTH);

        this.initialized = true;
    }

    private getRootKey(): string {
        // Try environment first
        const envKey = process.env["HOOSHyarOS_ROOT_KEY"];
        if (envKey) {
            return envKey;
        }

        // Try config
        if (this.config.rootKey) {
            return this.config.rootKey;
        }

        // Fail secure - no hard-coded fallback
        throw new Error("ENCRYPTION_ROOT_KEY_REQUIRED: Set HOOSHyarOS_ROOT_KEY environment variable or provide rootKey in config");
    }

    async getDEK(tenantId: string): Promise<{ key: Buffer; version: number }> {
        if (!this.initialized) {
            throw new Error("Key provider not initialized");
        }

        // Check cache first
        const cached = this.dekCache.get(tenantId);
        if (cached) {
            return cached;
        }

        // Try to load from database
        const metadata = await this.loadDEKMetadata(tenantId);
        
        if (metadata) {
            // Decrypt existing DEK
            const dek = this.unwrapDEK(metadata.encryptedDEK);
            const result = { key: dek, version: metadata.version };
            this.dekCache.set(tenantId, result);
            return result;
        }

        // Create new DEK
        return this.createAndStoreDEK(tenantId);
    }

    async rotateDEK(tenantId: string): Promise<{ key: Buffer; version: number }> {
        if (!this.initialized) {
            throw new Error("Key provider not initialized");
        }

        // Create new DEK
        const newDEK = randomBytes(this.KEY_LENGTH);
        const currentMetadata = this.dekMetadata.get(tenantId);
        const newVersion = (currentMetadata?.version || 0) + 1;

        // Encrypt DEK with KEK
        const encryptedDEK = this.wrapDEK(newDEK);
        const metadata: DEKMetadata = {
            tenantId,
            encryptedDEK,
            version: newVersion,
            createdAt: currentMetadata?.createdAt || new Date().toISOString(),
            rotatedAt: new Date().toISOString()
        };

        // Store metadata
        await this.storeDEKMetadata(metadata);
        this.dekMetadata.set(tenantId, metadata);

        const result = { key: newDEK, version: newVersion };
        this.dekCache.set(tenantId, result);
        return result;
    }

    async health(): Promise<boolean> {
        try {
            return this.initialized && this.rootKey.length === this.KEY_LENGTH;
        } catch {
            return false;
        }
    }

    private async loadDEKMetadata(tenantId: string): Promise<DEKMetadata | null> {
        if (!this.db) return null;
        
        try {
            const row = this.db.prepare(
                "SELECT tenant_id, encrypted_dek, version, created_at, rotated_at FROM encryption_keys WHERE tenant_id = ?"
            ).get(tenantId);
            
            if (!row) return null;

            const metadata: DEKMetadata = {
                tenantId: row.tenant_id,
                encryptedDEK: row.encrypted_dek,
                version: row.version,
                createdAt: row.created_at,
                rotatedAt: row.rotated_at
            };
            
            this.dekMetadata.set(tenantId, metadata);
            return metadata;
        } catch {
            return null;
        }
    }

    private async storeDEKMetadata(metadata: DEKMetadata): Promise<void> {
        if (!this.db) return;

        this.db.prepare(`
            INSERT OR REPLACE INTO encryption_keys (tenant_id, encrypted_dek, version, created_at, rotated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            metadata.tenantId,
            metadata.encryptedDEK,
            metadata.version,
            metadata.createdAt,
            metadata.rotatedAt || null
        );
    }

    private wrapDEK(dek: Buffer): string {
        const iv = randomBytes(this.IV_LENGTH);
        const cipher = createCipheriv(this.ALGORITHM, this.kek, iv);
        
        let ciphertext = cipher.update(dek);
        ciphertext = Buffer.concat([ciphertext, cipher.final()]);
        const tag = cipher.getAuthTag();

        // Return IV + ciphertext + tag as hex
        return Buffer.concat([iv, ciphertext, tag]).toString("hex");
    }

    private unwrapDEK(wrappedDEK: string): Buffer {
        const data = Buffer.from(wrappedDEK, "hex");
        
        const iv = data.subarray(0, this.IV_LENGTH);
        const ciphertext = data.subarray(this.IV_LENGTH, data.length - this.TAG_LENGTH);
        const tag = data.subarray(data.length - this.TAG_LENGTH);

        const decipher = createDecipheriv(this.ALGORITHM, this.kek, iv);
        decipher.setAuthTag(tag);

        let dek = decipher.update(ciphertext);
        dek = Buffer.concat([dek, decipher.final()]);
        return dek;
    }

    private async createAndStoreDEK(tenantId: string): Promise<{ key: Buffer; version: number }> {
        const dek = randomBytes(this.KEY_LENGTH);
        const encryptedDEK = this.wrapDEK(dek);
        
        const metadata: DEKMetadata = {
            tenantId,
            encryptedDEK,
            version: 1,
            createdAt: new Date().toISOString()
        };

        await this.storeDEKMetadata(metadata);
        this.dekMetadata.set(tenantId, metadata);

        const result = { key: dek, version: 1 };
        this.dekCache.set(tenantId, result);
        return result;
    }

    /**
     * Set database connection for DEK storage
     */
    setDatabase(db: any): void {
        this.db = db;
    }

    /**
     * Clear DEK cache (for testing or security)
     */
    clearCache(): void {
        this.dekCache.clear();
    }
}

/**
 * Encryption service for field-level encryption
 */
export class EncryptionService {
    private keyProvider: IKeyProvider;
    private readonly ALGORITHM = "aes-256-gcm";
    private readonly IV_LENGTH = 12;

    constructor(keyProvider: IKeyProvider) {
        this.keyProvider = keyProvider;
    }

    /**
     * Encrypt a plaintext value for a specific tenant
     */
    async encrypt(tenantId: string, plaintext: string): Promise<EncryptionResult> {
        try {
            if (!plaintext) {
                return { success: true, data: undefined }; // Empty values don't need encryption
            }

            const { key, version } = await this.keyProvider.getDEK(tenantId);
            const iv = randomBytes(this.IV_LENGTH);
            
            const cipher = createCipheriv(this.ALGORITHM, key, iv);
            
            let ciphertext = cipher.update(plaintext, "utf8");
            ciphertext = Buffer.concat([ciphertext, cipher.final()]);
            const tag = cipher.getAuthTag();

            const encryptedValue: EncryptedValue = {
                algorithm: "AES-256-GCM",
                iv: iv.toString("hex"),
                ciphertext: ciphertext.toString("hex"),
                tag: tag.toString("hex"),
                version
            };

            return { success: true, data: encryptedValue };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Decrypt an encrypted value for a specific tenant
     */
    async decrypt(tenantId: string, encrypted: EncryptedValue): Promise<DecryptionResult> {
        try {
            if (!encrypted || !encrypted.ciphertext) {
                return { success: true, data: undefined };
            }

            // Get the DEK (may need to try different versions for rotation)
            let dek: Buffer;
            let version: number;
            
            try {
                const result = await this.keyProvider.getDEK(tenantId);
                dek = result.key;
                version = result.version;
            } catch {
                return { success: false, error: "KEY_NOT_FOUND" };
            }

            const iv = Buffer.from(encrypted.iv, "hex");
            const ciphertext = Buffer.from(encrypted.ciphertext, "hex");
            const tag = Buffer.from(encrypted.tag, "hex");

            // If version mismatch, try to re-wrap with current key
            if (encrypted.version !== version) {
                // Key was rotated - DEK should still work for old versions
                // But if we need to handle version mismatch, we'd need key versioning
            }

            const decipher = createDecipheriv(this.ALGORITHM, dek, iv);
            decipher.setAuthTag(tag);

            let plaintext = decipher.update(ciphertext);
            plaintext = Buffer.concat([plaintext, decipher.final()]);

            return { success: true, data: plaintext.toString("utf8") };
        } catch (error) {
            // Fail secure - decryption error means data corruption or wrong key
            return { success: false, error: "DECRYPTION_FAILED" };
        }
    }

    /**
     * Serialize encrypted value to string for storage
     */
    static serialize(value: EncryptedValue): string {
        return JSON.stringify(value);
    }

    /**
     * Deserialize encrypted value from string
     */
    static deserialize(serialized: string): EncryptedValue | null {
        try {
            const parsed = JSON.parse(serialized);
            if (parsed.algorithm !== "AES-256-GCM") {
                return null;
            }
            return parsed as EncryptedValue;
        } catch {
            return null;
        }
    }

    /**
     * Check if a value is encrypted
     */
    static isEncrypted(value: unknown): value is EncryptedValue {
        if (!value || typeof value !== "object") return false;
        const obj = value as Record<string, unknown>;
        return (
            obj.algorithm === "AES-256-GCM" &&
            typeof obj.iv === "string" &&
            typeof obj.ciphertext === "string" &&
            typeof obj.tag === "string" &&
            typeof obj.version === "number"
        );
    }
}

/**
 * Fields that require encryption by classification
 */
export const ENCRYPTED_FIELDS = {
    // User identity is CONFIDENTIAL
    user: ["identity"] as const,
    
    // Decision content is CONFIDENTIAL
    decision: ["message", "explanation", "limitations", "reasoningRef"] as const,
    
    // Evidence content is CONFIDENTIAL
    evidence: ["explanation", "limitations"] as const,
    
    // Tenant name is INTERNAL (storage-level acceptable)
    tenant: ["name"] as const,
    
    // Project name is INTERNAL (storage-level acceptable)
    project: ["name"] as const,
} as const;

/**
 * Fields that should NEVER be encrypted (PUBLIC or indexed)
 */
export const PLAINTEXT_FIELDS = [
    "id",
    "tenantId",
    "projectId",
    "status",
    "traceId",
    "inputHash",
    "outputHash",
    "verificationStatus",
    "confidence",
    "createdAt",
    "timestamp",
    "actorId",
    "actorType",
    "action",
    "target",
    "result"
] as const;
