/**
 * Phase 05C-D2 - SQLite Persistence Adapter
 * 
 * Phase-1 implementation of repository interfaces using SQLite.
 * 
 * Features:
 * - WAL mode for better concurrency and crash recovery
 * - Tenant isolation enforced at repository boundary
 * - Atomic transactions for Decision + Evidence
 * - Indexes on tenantId for efficient filtering
 * - Offline-first: fully local, no network required
 */

import { 
    IRepository,
    ITenantRepository,
    IUserRepository,
    IProjectRepository,
    IDecisionRepository,
    IEvidenceRepository,
    IAuditRepository,
    ITransactionManager,
    RepositoryResult,
    Tenant,
    User,
    Project,
    ProjectDecisionRecord,
    EvidenceRecord,
    AuditEvent
} from "./IRepository";
import { SecurityContext } from "../Security/SecurityContext";
import { AuthorizationGuard } from "../Security/AuthorizationGuard";
import { Authorization, AuthorizationResult } from "../Security/Authorization";
import { 
    EncryptionService, 
    LocalKeyProvider, 
    IKeyProvider,
    EncryptedValue,
    ENCRYPTED_FIELDS,
    EncryptionConfig
} from "../Security/EncryptionService";

/**
 * SQLite adapter configuration
 */
export interface SQLiteConfig {
    databasePath: string;
    enableWAL?: boolean;
    enableForeignKeys?: boolean;
    encryption?: EncryptionConfig;
}

/**
 * Result factory
 */
function success<T>(data: T): RepositoryResult<T> {
    return { success: true, data };
}

function failure<T>(error: string): RepositoryResult<T> {
    return { success: false, error };
}

/**
 * SQLite adapter implementing all repository interfaces
 * 
 * Phase 05C-D4: Integrated field-level encryption for CONFIDENTIAL data.
 * Uses AES-256-GCM with per-tenant DEKs.
 */
export class SQLiteAdapter implements ITransactionManager {
    
    private db: any; // SQLite database connection
    private config: SQLiteConfig;
    private initialized: boolean = false;
    private encryptionService!: EncryptionService;
    private keyProvider!: IKeyProvider;
    private encryptionEnabled: boolean = false;

    constructor(config: SQLiteConfig) {
        this.config = {
            databasePath: config.databasePath || ":memory:",
            enableWAL: config.enableWAL !== false,
            enableForeignKeys: config.enableForeignKeys !== false,
            encryption: config.encryption
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Use better-sqlite3 synchronously
        const Database = require("better-sqlite3");
        this.db = new Database(this.config.databasePath);

        // Enable WAL mode for better concurrency and crash recovery
        if (this.config.enableWAL) {
            this.db.pragma("journal_mode = WAL");
        }

        // Enable foreign keys
        if (this.config.enableForeignKeys) {
            this.db.pragma("foreign_keys = ON");
        }

        // Create tables
        this.createTables();
        this.createEncryptionTables();

        // Initialize encryption if configured
        if (this.config.encryption) {
            await this.initializeEncryption();
        }

        this.initialized = true;
    }

    private async initializeEncryption(): Promise<void> {
        try {
            this.keyProvider = new LocalKeyProvider(this.config.encryption!);
            this.keyProvider.setDatabase(this.db);
            await this.keyProvider.initialize();
            this.encryptionService = new EncryptionService(this.keyProvider);
            this.encryptionEnabled = true;
        } catch (error) {
            // Fail secure - encryption was requested but failed to initialize
            // Do not silently disable - this is a configuration error
            throw new Error(`Encryption initialization failed: ${error}`);
        }
    }

    private createEncryptionTables(): void {
        // Encryption keys table - stores per-tenant DEKs wrapped by KEK
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS encryption_keys (
                tenant_id TEXT PRIMARY KEY,
                encrypted_dek TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                rotated_at TEXT
            )
        `);
    }

    // ===== Encryption Helpers =====

    /**
     * Encrypt a field value if encryption is enabled
     */
    private async encryptField(tenantId: string, fieldName: string, value: string | null | undefined): Promise<string | null> {
        if (!this.encryptionEnabled || !value) {
            return value as string | null;
        }

        // Check if this field requires encryption
        const encryptedFieldsList = [
            ...ENCRYPTED_FIELDS.user,
            ...ENCRYPTED_FIELDS.decision,
            ...ENCRYPTED_FIELDS.evidence
        ];

        if (!encryptedFieldsList.includes(fieldName as any)) {
            return value;
        }

        const result = await this.encryptionService.encrypt(tenantId, value);
        if (result.success && result.data) {
            return EncryptionService.serialize(result.data);
        }
        
        // Fail secure - if encryption fails, don't store the value
        throw new Error(`ENCRYPTION_FAILED: ${fieldName}`);
    }

    /**
     * Decrypt a field value if encryption is enabled
     */
    private async decryptField(tenantId: string, fieldName: string, value: string | null | undefined): Promise<string | null> {
        if (!this.encryptionEnabled || !value) {
            return value as string | null;
        }

        // Check if this field requires decryption
        const encryptedFieldsList = [
            ...ENCRYPTED_FIELDS.user,
            ...ENCRYPTED_FIELDS.decision,
            ...ENCRYPTED_FIELDS.evidence
        ];

        if (!encryptedFieldsList.includes(fieldName as any)) {
            return value;
        }

        // Try to deserialize as encrypted value
        const encrypted = EncryptionService.deserialize(value);
        if (!encrypted) {
            // Not encrypted, return as-is
            return value;
        }

        const result = await this.encryptionService.decrypt(tenantId, encrypted);
        if (result.success && result.data !== undefined) {
            return result.data;
        }

        // Fail secure - decryption failure
        throw new Error(`DECRYPTION_FAILED: ${fieldName}`);
    }

    /**
     * Check if encryption is enabled
     */
    isEncryptionEnabled(): boolean {
        return this.encryptionEnabled;
    }

    private createTables(): void {
        // Tenants table (system scope)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tenants (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at TEXT NOT NULL
            )
        `);

        // Users table (tenant-scoped)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                identity TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at TEXT NOT NULL,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id)
            )
        `);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)`);

        // Projects table (tenant-scoped)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'PLANNING',
                created_at TEXT NOT NULL,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id)
            )
        `);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id)`);

        // Decisions table (tenant-scoped with provenance)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS decisions (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT NOT NULL,
                trace_id TEXT,
                input_hash TEXT,
                reasoning_ref TEXT,
                explanation TEXT,
                confidence REAL,
                limitations TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        `);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON decisions(tenant_id)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_decisions_trace ON decisions(trace_id)`);

        // Evidence table (tenant-scoped, append-only)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS evidence (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                trace_id TEXT NOT NULL,
                input_hash TEXT,
                output_hash TEXT,
                verification_status TEXT NOT NULL,
                explanation TEXT,
                confidence REAL,
                limitations TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id)
            )
        `);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_evidence_tenant ON evidence(tenant_id)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_evidence_trace ON evidence(trace_id)`);

        // Audit events table (tenant-scoped)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS audit_events (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                actor_id TEXT NOT NULL,
                actor_type TEXT NOT NULL,
                action TEXT NOT NULL,
                target TEXT NOT NULL,
                result TEXT NOT NULL,
                trace_id TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (tenant_id) REFERENCES tenants(id)
            )
        `);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(tenant_id)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_id)`);
    }

    async health(): Promise<boolean> {
        try {
            const result = this.db.prepare("SELECT 1").get();
            return result !== undefined;
        } catch {
            return false;
        }
    }

    // ===== Transaction Manager Implementation =====

    async execute<T>(operations: () => Promise<T>): Promise<{ success: boolean; transactionId: string; data?: T; error?: string }> {
        const transactionId = crypto.randomUUID();
        try {
            this.db.exec("BEGIN TRANSACTION");
            const data = await operations();

            // Check if result indicates failure (e.g., RepositoryResult with success: false)
            if (data && typeof data === 'object' && 'success' in data && data.success === false) {
                this.db.exec("ROLLBACK");
                return { success: false, transactionId, error: (data as any).error || "Operation failed" };
            }

            this.db.exec("COMMIT");
            return { success: true, transactionId, data };
        } catch (error) {
            this.db.exec("ROLLBACK");
            return { success: false, transactionId, error: String(error) };
        }
    }

    async begin(transactionId: string): Promise<{ success: boolean; transactionId: string; error?: string }> {
        try {
            this.db.exec(`SAVEPOINT ${transactionId}`);
            return { success: true, transactionId };
        } catch (error) {
            return { success: false, transactionId, error: String(error) };
        }
    }

    async commit(transactionId: string): Promise<{ success: boolean; transactionId: string; error?: string }> {
        try {
            this.db.exec(`RELEASE SAVEPOINT ${transactionId}`);
            return { success: true, transactionId };
        } catch (error) {
            return { success: false, transactionId, error: String(error) };
        }
    }

    async rollback(transactionId: string): Promise<{ success: boolean; transactionId: string; error?: string }> {
        try {
            this.db.exec(`ROLLBACK TO SAVEPOINT ${transactionId}`);
            return { success: true, transactionId };
        } catch (error) {
            return { success: false, transactionId, error: String(error) };
        }
    }

    // ===== Tenant Repository =====

    async createTenant(tenant: Omit<Tenant, "id" | "createdAt">): Promise<RepositoryResult<Tenant>> {
        try {
            const id = crypto.randomUUID();
            const createdAt = new Date().toISOString();
            this.db.prepare(`
                INSERT INTO tenants (id, name, status, created_at)
                VALUES (?, ?, ?, ?)
            `).run(id, tenant.name, tenant.status, createdAt);
            return success({ id, ...tenant, createdAt });
        } catch (error) {
            return failure(String(error));
        }
    }

    async findTenantById(id: string): Promise<RepositoryResult<Tenant | null>> {
        try {
            const row = this.db.prepare("SELECT * FROM tenants WHERE id = ?").get(id);
            if (!row) return success(null);
            return success({
                id: row.id,
                name: row.name,
                status: row.status,
                createdAt: row.created_at
            });
        } catch (error) {
            return failure(String(error));
        }
    }

    async findTenantByName(name: string): Promise<RepositoryResult<Tenant | null>> {
        try {
            const row = this.db.prepare("SELECT * FROM tenants WHERE name = ?").get(name);
            if (!row) return success(null);
            return success({
                id: row.id,
                name: row.name,
                status: row.status,
                createdAt: row.created_at
            });
        } catch (error) {
            return failure(String(error));
        }
    }

    // ===== User Repository =====

    async createUser(context: SecurityContext, user: Omit<User, "id" | "tenantId" | "createdAt">): Promise<RepositoryResult<User>> {
        const authResult = AuthorizationGuard.check(context, Authorization.WRITE);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }
        if (!context.tenantId) {
            return failure("Tenant context required");
        }

        try {
            const id = crypto.randomUUID();
            const createdAt = new Date().toISOString();
            
            // Encrypt identity field if encryption is enabled
            const encryptedIdentity = await this.encryptField(context.tenantId, "identity", user.identity);
            
            this.db.prepare(`
                INSERT INTO users (id, tenant_id, identity, status, created_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(id, context.tenantId, encryptedIdentity, user.status, createdAt);
            return success({ id, tenantId: context.tenantId, ...user, createdAt });
        } catch (error) {
            return failure(String(error));
        }
    }

    async findUserById(context: SecurityContext, id: string): Promise<RepositoryResult<User | null>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const row = this.db.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ?")
                .get(id, context.tenantId);
            if (!row) return success(null);
            
            // Decrypt identity field
            const decryptedIdentity = await this.decryptField(context.tenantId, "identity", row.identity);
            
            return success({
                id: row.id,
                tenantId: row.tenant_id,
                identity: decryptedIdentity || row.identity,
                status: row.status,
                createdAt: row.created_at
            });
        } catch (error) {
            return failure(String(error));
        }
    }

    async findUsersByTenant(context: SecurityContext): Promise<RepositoryResult<User[]>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const rows = this.db.prepare("SELECT * FROM users WHERE tenant_id = ?")
                .all(context.tenantId);
            
            const users = await Promise.all(rows.map(async row => {
                const decryptedIdentity = await this.decryptField(context.tenantId, "identity", row.identity);
                return {
                    id: row.id,
                    tenantId: row.tenant_id,
                    identity: decryptedIdentity || row.identity,
                    status: row.status,
                    createdAt: row.created_at
                };
            }));
            
            return success(users);
        } catch (error) {
            return failure(String(error));
        }
    }

    // ===== Project Repository =====

    async createProject(context: SecurityContext, project: Omit<Project, "id" | "tenantId" | "createdAt">): Promise<RepositoryResult<Project>> {
        const authResult = AuthorizationGuard.check(context, Authorization.WRITE);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }
        if (!context.tenantId) {
            return failure("Tenant context required");
        }

        try {
            const id = crypto.randomUUID();
            const createdAt = new Date().toISOString();
            this.db.prepare(`
                INSERT INTO projects (id, tenant_id, name, status, created_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(id, context.tenantId, project.name, project.status, createdAt);
            return success({ id, tenantId: context.tenantId, ...project, createdAt });
        } catch (error) {
            return failure(String(error));
        }
    }

    async findProjectById(context: SecurityContext, id: string): Promise<RepositoryResult<Project | null>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const row = this.db.prepare("SELECT * FROM projects WHERE id = ? AND tenant_id = ?")
                .get(id, context.tenantId);
            if (!row) return success(null);
            return success({
                id: row.id,
                tenantId: row.tenant_id,
                name: row.name,
                status: row.status,
                createdAt: row.created_at
            });
        } catch (error) {
            return failure(String(error));
        }
    }

    async findProjectsByTenant(context: SecurityContext): Promise<RepositoryResult<Project[]>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const rows = this.db.prepare("SELECT * FROM projects WHERE tenant_id = ?")
                .all(context.tenantId);
            return success(rows.map(row => ({
                id: row.id,
                tenantId: row.tenant_id,
                name: row.name,
                status: row.status,
                createdAt: row.created_at
            })));
        } catch (error) {
            return failure(String(error));
        }
    }

    async updateProject(context: SecurityContext, project: Project): Promise<RepositoryResult<Project>> {
        const authResult = AuthorizationGuard.check(context, Authorization.WRITE);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            this.db.prepare(`
                UPDATE projects SET name = ?, status = ?
                WHERE id = ? AND tenant_id = ?
            `).run(project.name, project.status, project.id, context.tenantId);
            return success(project);
        } catch (error) {
            return failure(String(error));
        }
    }

    async deleteProject(context: SecurityContext, id: string): Promise<RepositoryResult<void>> {
        const authResult = AuthorizationGuard.check(context, Authorization.WRITE);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            this.db.prepare("DELETE FROM projects WHERE id = ? AND tenant_id = ?")
                .run(id, context.tenantId);
            return success(undefined as any);
        } catch (error) {
            return failure(String(error));
        }
    }

    // ===== Decision Repository =====

    async createDecision(
        context: SecurityContext,
        decision: Omit<ProjectDecisionRecord, "id" | "tenantId" | "createdAt">
    ): Promise<RepositoryResult<ProjectDecisionRecord>> {
        const authResult = AuthorizationGuard.check(context, Authorization.WRITE);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }
        if (!context.tenantId) {
            return failure("Tenant context required");
        }

        try {
            const id = crypto.randomUUID();
            const createdAt = new Date().toISOString();
            
            // Encrypt CONFIDENTIAL decision fields
            const encryptedMessage = await this.encryptField(context.tenantId, "message", decision.message);
            const encryptedExplanation = await this.encryptField(context.tenantId, "explanation", decision.explanation);
            const encryptedLimitations = decision.limitations 
                ? await this.encryptField(context.tenantId, "limitations", JSON.stringify(decision.limitations))
                : null;
            const encryptedReasoningRef = await this.encryptField(context.tenantId, "reasoningRef", decision.reasoningRef);
            
            this.db.prepare(`
                INSERT INTO decisions (id, tenant_id, project_id, status, message,
                    trace_id, input_hash, reasoning_ref, explanation, confidence, limitations, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, context.tenantId, decision.projectId, decision.status, encryptedMessage,
                decision.traceId || null, decision.inputHash || null, encryptedReasoningRef,
                encryptedExplanation, decision.confidence || null,
                encryptedLimitations, createdAt
            );
            return success({ id, tenantId: context.tenantId, ...decision, createdAt });
        } catch (error) {
            return failure(String(error));
        }
    }

    async findDecisionById(context: SecurityContext, id: string): Promise<RepositoryResult<ProjectDecisionRecord | null>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const row = this.db.prepare("SELECT * FROM decisions WHERE id = ? AND tenant_id = ?")
                .get(id, context.tenantId);
            if (!row) return success(null);
            return success(await this.rowToDecision(row, context.tenantId));
        } catch (error) {
            return failure(String(error));
        }
    }

    async findDecisionsByTenant(context: SecurityContext, limit?: number): Promise<RepositoryResult<ProjectDecisionRecord[]>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const sql = limit
                ? "SELECT * FROM decisions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?"
                : "SELECT * FROM decisions WHERE tenant_id = ? ORDER BY created_at DESC";
            const rows = limit
                ? this.db.prepare(sql).all(context.tenantId, limit)
                : this.db.prepare(sql).all(context.tenantId);
            
            const decisions = await Promise.all(
                rows.map(row => this.rowToDecision(row, context.tenantId))
            );
            return success(decisions);
        } catch (error) {
            return failure(String(error));
        }
    }

    async findDecisionByTraceId(context: SecurityContext, traceId: string): Promise<RepositoryResult<ProjectDecisionRecord | null>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const row = this.db.prepare("SELECT * FROM decisions WHERE trace_id = ? AND tenant_id = ?")
                .get(traceId, context.tenantId);
            if (!row) return success(null);
            return success(await this.rowToDecision(row, context.tenantId));
        } catch (error) {
            return failure(String(error));
        }
    }

    private async rowToDecision(row: any, tenantId: string): Promise<ProjectDecisionRecord> {
        // Decrypt CONFIDENTIAL fields
        const decryptedMessage = await this.decryptField(tenantId, "message", row.message);
        const decryptedExplanation = await this.decryptField(tenantId, "explanation", row.explanation);
        const decryptedReasoningRef = await this.decryptField(tenantId, "reasoningRef", row.reasoning_ref);
        const decryptedLimitations = row.limitations 
            ? await this.decryptField(tenantId, "limitations", row.limitations)
            : undefined;

        return {
            id: row.id,
            tenantId: row.tenant_id,
            projectId: row.project_id,
            status: row.status,
            message: decryptedMessage || row.message,
            traceId: row.trace_id || undefined,
            inputHash: row.input_hash || undefined,
            reasoningRef: decryptedReasoningRef || row.reasoning_ref || undefined,
            explanation: decryptedExplanation || row.explanation || undefined,
            confidence: row.confidence || undefined,
            limitations: decryptedLimitations ? JSON.parse(decryptedLimitations) : undefined,
            createdAt: row.created_at
        };
    }

    // ===== Evidence Repository =====

    async appendEvidence(
        context: SecurityContext,
        evidence: Omit<EvidenceRecord, "id" | "tenantId" | "createdAt">
    ): Promise<RepositoryResult<EvidenceRecord>> {
        const authResult = AuthorizationGuard.check(context, Authorization.WRITE);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }
        if (!context.tenantId) {
            return failure("Tenant context required");
        }

        try {
            const id = crypto.randomUUID();
            const createdAt = new Date().toISOString();
            
            // Encrypt CONFIDENTIAL evidence fields
            const encryptedExplanation = await this.encryptField(context.tenantId, "explanation", evidence.explanation);
            const encryptedLimitations = evidence.limitations
                ? await this.encryptField(context.tenantId, "limitations", JSON.stringify(evidence.limitations))
                : null;
            
            this.db.prepare(`
                INSERT INTO evidence (id, tenant_id, trace_id, input_hash, output_hash,
                    verification_status, explanation, confidence, limitations, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, context.tenantId, evidence.traceId, evidence.inputHash || null,
                evidence.outputHash || null, evidence.verificationStatus,
                encryptedExplanation, evidence.confidence || null,
                encryptedLimitations, createdAt
            );
            return success({ id, tenantId: context.tenantId, ...evidence, createdAt });
        } catch (error) {
            return failure(String(error));
        }
    }

    async findEvidenceById(context: SecurityContext, id: string): Promise<RepositoryResult<EvidenceRecord | null>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const row = this.db.prepare("SELECT * FROM evidence WHERE id = ? AND tenant_id = ?")
                .get(id, context.tenantId);
            if (!row) return success(null);
            return success(await this.rowToEvidence(row, context.tenantId));
        } catch (error) {
            return failure(String(error));
        }
    }

    async findEvidenceByTraceId(context: SecurityContext, traceId: string): Promise<RepositoryResult<EvidenceRecord | null>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const row = this.db.prepare("SELECT * FROM evidence WHERE trace_id = ? AND tenant_id = ?")
                .get(traceId, context.tenantId);
            if (!row) return success(null);
            return success(await this.rowToEvidence(row, context.tenantId));
        } catch (error) {
            return failure(String(error));
        }
    }

    async findEvidenceByTenant(context: SecurityContext, limit?: number): Promise<RepositoryResult<EvidenceRecord[]>> {
        const authResult = AuthorizationGuard.check(context, Authorization.READ);
        if (authResult.result !== AuthorizationResult.PERMITTED) {
            return failure(authResult.reason);
        }

        try {
            const sql = limit
                ? "SELECT * FROM evidence WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?"
                : "SELECT * FROM evidence WHERE tenant_id = ? ORDER BY created_at DESC";
            const rows = limit
                ? this.db.prepare(sql).all(context.tenantId, limit)
                : this.db.prepare(sql).all(context.tenantId);
            
            const evidence = await Promise.all(
                rows.map(row => this.rowToEvidence(row, context.tenantId))
            );
            return success(evidence);
        } catch (error) {
            return failure(String(error));
        }
    }

    private async rowToEvidence(row: any, tenantId: string): Promise<EvidenceRecord> {
        // Decrypt CONFIDENTIAL fields
        const decryptedExplanation = await this.decryptField(tenantId, "explanation", row.explanation);
        const decryptedLimitations = row.limitations
            ? await this.decryptField(tenantId, "limitations", row.limitations)
            : undefined;

        return {
            id: row.id,
            tenantId: row.tenant_id,
            traceId: row.trace_id,
            inputHash: row.input_hash || undefined,
            outputHash: row.output_hash || undefined,
            verificationStatus: row.verification_status,
            explanation: decryptedExplanation || row.explanation || undefined,
            confidence: row.confidence || undefined,
            limitations: decryptedLimitations ? JSON.parse(decryptedLimitations) : undefined,
            createdAt: row.created_at
        };
    }

    // ===== Audit Repository =====

    async appendAuditEvent(
        context: SecurityContext,
        event: Omit<AuditEvent, "id" | "tenantId" | "timestamp">
    ): Promise<RepositoryResult<AuditEvent>> {
        if (!context.tenantId) {
            return failure("Tenant context required");
        }

        try {
            const id = crypto.randomUUID();
            const timestamp = new Date().toISOString();
            this.db.prepare(`
                INSERT INTO audit_events (id, tenant_id, actor_id, actor_type, action, target, result, trace_id, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, context.tenantId, event.actorId, event.actorType,
                event.action, event.target, event.result, event.traceId || null, timestamp
            );
            return success({ id, tenantId: context.tenantId, ...event, timestamp });
        } catch (error) {
            return failure(String(error));
        }
    }

    async findAuditEventsByTenant(context: SecurityContext, limit?: number): Promise<RepositoryResult<AuditEvent[]>> {
        if (!context.tenantId) {
            return failure("Tenant context required");
        }

        try {
            const sql = limit
                ? "SELECT * FROM audit_events WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?"
                : "SELECT * FROM audit_events WHERE tenant_id = ? ORDER BY timestamp DESC";
            const rows = limit
                ? this.db.prepare(sql).all(context.tenantId, limit)
                : this.db.prepare(sql).all(context.tenantId);
            return success(rows.map(row => ({
                id: row.id,
                tenantId: row.tenant_id,
                actorId: row.actor_id,
                actorType: row.actor_type,
                action: row.action,
                target: row.target,
                result: row.result,
                traceId: row.trace_id || undefined,
                timestamp: row.timestamp
            })));
        } catch (error) {
            return failure(String(error));
        }
    }

    /**
     * Close the database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
        }
    }

    /**
     * Get the key provider for management operations
     */
    getKeyProvider(): IKeyProvider | undefined {
        return this.keyProvider;
    }

    /**
     * Check if encryption is enabled
     */
    hasEncryption(): boolean {
        return this.encryptionEnabled;
    }
}

/**
 * Repository factory for creating repositories
 */
export class RepositoryFactory {
    private adapter: SQLiteAdapter;

    constructor(config: SQLiteConfig) {
        this.adapter = new SQLiteAdapter(config);
    }

    async initialize(): Promise<void> {
        await this.adapter.initialize();
    }

    getTenantRepository(): ITenantRepository {
        return {
            initialize: async () => {},
            health: () => this.adapter.health(),
            create: async (tenant) => this.adapter.createTenant(tenant),
            findById: async (id) => this.adapter.findTenantById(id),
            findByName: async (name) => this.adapter.findTenantByName(name)
        };
    }

    getUserRepository(): IUserRepository {
        return {
            initialize: async () => {},
            health: () => this.adapter.health(),
            create: async (ctx, user) => this.adapter.createUser(ctx, user),
            findById: async (ctx, id) => this.adapter.findUserById(ctx, id),
            findByTenant: async (ctx) => this.adapter.findUsersByTenant(ctx)
        };
    }

    getProjectRepository(): IProjectRepository {
        return {
            initialize: async () => {},
            health: () => this.adapter.health(),
            create: async (ctx, proj) => this.adapter.createProject(ctx, proj),
            findById: async (ctx, id) => this.adapter.findProjectById(ctx, id),
            findByTenant: async (ctx) => this.adapter.findProjectsByTenant(ctx),
            update: async (ctx, proj) => this.adapter.updateProject(ctx, proj),
            delete: async (ctx, id) => this.adapter.deleteProject(ctx, id)
        };
    }

    getDecisionRepository(): IDecisionRepository {
        return {
            initialize: async () => {},
            health: () => this.adapter.health(),
            create: async (ctx, dec) => this.adapter.createDecision(ctx, dec),
            findById: async (ctx, id) => this.adapter.findDecisionById(ctx, id),
            findByTenant: async (ctx, limit) => this.adapter.findDecisionsByTenant(ctx, limit),
            findByTraceId: async (ctx, traceId) => this.adapter.findDecisionByTraceId(ctx, traceId),
            findByProject: async (ctx, projectId) => {
                // Not implemented in SQLite adapter directly - use findByTenant and filter
                const result = await this.adapter.findDecisionsByTenant(ctx);
                return { success: true, data: result.data?.filter(d => d.projectId === projectId) || [] };
            }
        };
    }

    getEvidenceRepository(): IEvidenceRepository {
        return {
            initialize: async () => {},
            health: () => this.adapter.health(),
            append: async (ctx, ev) => this.adapter.appendEvidence(ctx, ev),
            findById: async (ctx, id) => this.adapter.findEvidenceById(ctx, id),
            findByTraceId: async (ctx, traceId) => this.adapter.findEvidenceByTraceId(ctx, traceId),
            findByTenant: async (ctx, limit) => this.adapter.findEvidenceByTenant(ctx, limit)
        };
    }

    getAuditRepository(): IAuditRepository {
        return {
            initialize: async () => {},
            health: () => this.adapter.health(),
            append: async (ctx, event) => this.adapter.appendAuditEvent(ctx, event),
            findByTenant: async (ctx, limit) => this.adapter.findAuditEventsByTenant(ctx, limit),
            findByActor: async (ctx, actorId, limit) => {
                // Not implemented directly - return empty
                return { success: true, data: [] };
            }
        };
    }

    getTransactionManager(): ITransactionManager {
        return this.adapter;
    }

    async health(): Promise<boolean> {
        return this.adapter.health();
    }

    close(): void {
        this.adapter.close();
    }
}
