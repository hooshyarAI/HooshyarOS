/**
 * Phase 05C-D2 - Persistence Repository Contracts
 * 
 * Defines the repository boundary between domain logic and storage.
 * 
 * Architecture:
 * Engine/Service → Repository Contract → SQLite Adapter → Local SQLite Database
 * 
 * Principles:
 * - Repository enforces tenant isolation
 * - Evidence is append-only
 * - SecurityContext never persisted
 * - Secrets never persisted
 * - SQLite for Phase 1, PostgreSQL adapter for future
 */

import { SecurityContext } from "../Security/SecurityContext";
import { Authorization } from "../Security/Authorization";

/**
 * Base result type for repository operations
 */
export interface RepositoryResult<T> {
    readonly success: boolean;
    readonly data?: T;
    readonly error?: string;
}

/**
 * Tenant entity - root of tenant hierarchy
 */
export interface Tenant {
    readonly id: string;
    readonly name: string;
    readonly status: "ACTIVE" | "SUSPENDED" | "DELETED";
    readonly createdAt: string;
}

/**
 * User/Identity entity
 */
export interface User {
    readonly id: string;
    readonly tenantId: string;
    readonly identity: string; // email, username, etc.
    readonly status: "ACTIVE" | "INACTIVE" | "DELETED";
    readonly createdAt: string;
}

/**
 * Project entity - tenant-scoped
 */
export interface Project {
    readonly id: string;
    readonly tenantId: string;
    readonly name: string;
    readonly status: string;
    readonly createdAt: string;
}

/**
 * ProjectDecision entity - tenant-scoped with provenance
 */
export interface ProjectDecisionRecord {
    readonly id: string;
    readonly tenantId: string;
    readonly projectId: string;
    readonly status: string;
    readonly message: string;
    // Provenance fields (Phase 05A/05B)
    readonly traceId?: string;
    readonly inputHash?: string;
    readonly reasoningRef?: string;
    readonly explanation?: string;
    readonly confidence?: number;
    readonly limitations?: readonly string[];
    readonly createdAt: string;
}

/**
 * Evidence record - tenant-scoped, append-only
 */
export interface EvidenceRecord {
    readonly id: string;
    readonly tenantId: string;
    readonly traceId: string;
    readonly inputHash?: string;
    readonly outputHash?: string;
    readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
    readonly explanation?: string;
    readonly confidence?: number;
    readonly limitations?: readonly string[];
    readonly createdAt: string;
}

/**
 * Audit event - tenant-scoped
 */
export interface AuditEvent {
    readonly id: string;
    readonly tenantId: string;
    readonly actorId: string;
    readonly actorType: string;
    readonly action: string;
    readonly target: string;
    readonly result: "SUCCESS" | "FAILURE" | "DENIED";
    readonly traceId?: string;
    readonly timestamp: string;
}

/**
 * Transaction context for atomic operations
 */
export interface TransactionContext {
    readonly transactionId: string;
    readonly timestamp: string;
}

/**
 * Transaction result
 */
export interface TransactionResult {
    readonly success: boolean;
    readonly transactionId: string;
    readonly error?: string;
}

/**
 * Base repository interface
 */
export interface IRepository {
    /**
     * Initialize the repository (create tables, etc.)
     */
    initialize(): Promise<void>;
    
    /**
     * Health check
     */
    health(): Promise<boolean>;
}

/**
 * Tenant repository - system scope, not tenant-scoped
 */
export interface ITenantRepository extends IRepository {
    /**
     * Create a new tenant (system operation)
     */
    create(tenant: Omit<Tenant, "id" | "createdAt">): Promise<RepositoryResult<Tenant>>;
    
    /**
     * Find tenant by ID
     */
    findById(id: string): Promise<RepositoryResult<Tenant | null>>;
    
    /**
     * Find tenant by name
     */
    findByName(name: string): Promise<RepositoryResult<Tenant | null>>;
}

/**
 * User repository - tenant-scoped
 */
export interface IUserRepository extends IRepository {
    /**
     * Create a new user within tenant context
     */
    create(context: SecurityContext, user: Omit<User, "id" | "tenantId" | "createdAt">): Promise<RepositoryResult<User>>;
    
    /**
     * Find user by ID within tenant
     */
    findById(context: SecurityContext, id: string): Promise<RepositoryResult<User | null>>;
    
    /**
     * Find all users within tenant
     */
    findByTenant(context: SecurityContext): Promise<RepositoryResult<User[]>>;
}

/**
 * Project repository - tenant-scoped
 */
export interface IProjectRepository extends IRepository {
    /**
     * Create a new project within tenant
     */
    create(context: SecurityContext, project: Omit<Project, "id" | "tenantId" | "createdAt">): Promise<RepositoryResult<Project>>;
    
    /**
     * Find project by ID within tenant
     */
    findById(context: SecurityContext, id: string): Promise<RepositoryResult<Project | null>>;
    
    /**
     * Find all projects within tenant
     */
    findByTenant(context: SecurityContext): Promise<RepositoryResult<Project[]>>;
    
    /**
     * Update project
     */
    update(context: SecurityContext, project: Project): Promise<RepositoryResult<Project>>;
    
    /**
     * Delete project
     */
    delete(context: SecurityContext, id: string): Promise<RepositoryResult<void>>;
}

/**
 * Decision repository - tenant-scoped with provenance
 */
export interface IDecisionRepository extends IRepository {
    /**
     * Create a decision within tenant (used atomically with evidence)
     */
    create(
        context: SecurityContext,
        decision: Omit<ProjectDecisionRecord, "id" | "tenantId" | "createdAt">
    ): Promise<RepositoryResult<ProjectDecisionRecord>>;
    
    /**
     * Find decision by ID within tenant
     */
    findById(context: SecurityContext, id: string): Promise<RepositoryResult<ProjectDecisionRecord | null>>;
    
    /**
     * Find all decisions for a project within tenant
     */
    findByProject(context: SecurityContext, projectId: string): Promise<RepositoryResult<ProjectDecisionRecord[]>>;
    
    /**
     * Find decisions by tenant
     */
    findByTenant(context: SecurityContext, limit?: number): Promise<RepositoryResult<ProjectDecisionRecord[]>>;
    
    /**
     * Find decision by traceId within tenant
     */
    findByTraceId(context: SecurityContext, traceId: string): Promise<RepositoryResult<ProjectDecisionRecord | null>>;
}

/**
 * Evidence repository - tenant-scoped, append-only
 */
export interface IEvidenceRepository extends IRepository {
    /**
     * Append evidence (append-only, no updates)
     */
    append(
        context: SecurityContext,
        evidence: Omit<EvidenceRecord, "id" | "tenantId" | "createdAt">
    ): Promise<RepositoryResult<EvidenceRecord>>;
    
    /**
     * Find evidence by ID within tenant
     */
    findById(context: SecurityContext, id: string): Promise<RepositoryResult<EvidenceRecord | null>>;
    
    /**
     * Find evidence by traceId within tenant
     */
    findByTraceId(context: SecurityContext, traceId: string): Promise<RepositoryResult<EvidenceRecord | null>>;
    
    /**
     * Find evidence by tenant with pagination
     */
    findByTenant(context: SecurityContext, limit?: number): Promise<RepositoryResult<EvidenceRecord[]>>;
}

/**
 * Audit repository - tenant-scoped
 */
export interface IAuditRepository extends IRepository {
    /**
     * Append audit event
     */
    append(
        context: SecurityContext,
        event: Omit<AuditEvent, "id" | "tenantId" | "timestamp">
    ): Promise<RepositoryResult<AuditEvent>>;
    
    /**
     * Find audit events by tenant
     */
    findByTenant(context: SecurityContext, limit?: number): Promise<RepositoryResult<AuditEvent[]>>;
    
    /**
     * Find audit events for actor
     */
    findByActor(context: SecurityContext, actorId: string, limit?: number): Promise<RepositoryResult<AuditEvent[]>>;
}

/**
 * Transaction manager interface
 */
export interface ITransactionManager extends IRepository {
    /**
     * Execute operations atomically
     */
    execute<T>(operations: () => Promise<T>): Promise<TransactionResult & { data?: T }>;
    
    /**
     * Begin a named transaction
     */
    begin(transactionId: string): Promise<TransactionResult>;
    
    /**
     * Commit a transaction
     */
    commit(transactionId: string): Promise<TransactionResult>;
    
    /**
     * Rollback a transaction
     */
    rollback(transactionId: string): Promise<TransactionResult>;
}
