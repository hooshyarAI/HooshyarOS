/**
 * Phase 05C-E2 - Tamper-Evident Audit Store
 *
 * Provides append-only audit event storage with hash chaining for tamper detection.
 *
 * Design principles:
 * - Append-only semantics: events cannot be modified after write
 * - Hash chaining: each event hash includes previous event hash (if exists)
 * - No false claims of cryptographic immutability: Object.freeze() + hash chain provides
 *   evidence integrity, not cryptographic finality
 * - Durable integrity: SQLite INSERT-only (no UPDATE/DELETE)
 * - Tenant isolation: events stored with tenant context
 * - Offline capable: local SQLite storage, no network dependency
 *
 * Integrity verification:
 * - verifyChain(): re-computes all event hashes and compares to stored
 * - verifyEvent(eventId): verifies single event's hash integrity
 * - Detection: event insertion, deletion, modification
 */

import { AuditEvent, AuditEventResult, AuditEventAction } from "./AuditEvent";
import { AuthorizationResult } from "../Security/Authorization";
import { PrincipalType } from "../Security/Principals";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Stored audit record with hash chain
 */
interface StoredAuditRecord {
    event_id: string;
    actor_id: string | undefined;
    actor_type: string | undefined;
    tenant_id: string | undefined;
    timestamp: string;
    action: string | undefined;
    target: string | undefined;
    result: string | undefined;
    trace_id: string | undefined;
    authorization_result: string | undefined;
    reason: string | undefined;
    metadata_json: string | undefined;
    event_hash: string;       // SHA-256 of this event's content
    prev_event_hash: string | undefined;  // Hash of previous event (chain link)
    sequence: number;        // Monotonic sequence number
}

/**
 * Result of integrity verification
 */
export interface IntegrityCheckResult {
    valid: boolean;
    eventId?: string;
    reason?: string;
    details?: string;
}

/**
 * Append-only audit store with tamper-evident hash chaining
 */
export class AuditStore {
    private readonly database: DatabaseSync;
    private lastEventHash: string | undefined;
    private lastSequence: number = 0;
    private initialized: boolean = false;

    constructor(private readonly databasePath: string) {
        const resolved = resolve(databasePath);
        mkdirSync(dirname(resolved), { recursive: true });
        this.database = new DatabaseSync(resolved);
    }

    /**
     * Initialize the audit store schema
     */
    initialize(): void {
        if (this.initialized) return;

        // Main audit events table - INSERT only, no UPDATE/DELETE
        this.database.exec(`
            CREATE TABLE IF NOT EXISTS audit_events (
                event_id TEXT PRIMARY KEY,
                actor_id TEXT,
                actor_type TEXT,
                tenant_id TEXT,
                timestamp TEXT NOT NULL,
                action TEXT,
                target TEXT,
                result TEXT,
                trace_id TEXT,
                authorization_result TEXT,
                reason TEXT,
                metadata_json TEXT,
                event_hash TEXT NOT NULL,
                prev_event_hash TEXT,
                sequence INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        `);

        // Indexes for efficient querying
        this.database.exec(`
            CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_events(trace_id);
            CREATE INDEX IF NOT EXISTS idx_audit_sequence ON audit_events(sequence);
        `);

        // Load last hash and sequence for chain continuation
        const last = this.database.prepare(
            "SELECT event_hash, sequence FROM audit_events ORDER BY sequence DESC LIMIT 1"
        ).get() as { event_hash?: string; sequence?: number } | undefined;

        if (last) {
            this.lastEventHash = last.event_hash;
            this.lastSequence = last.sequence ?? 0;
        }

        this.initialized = true;
    }

    /**
     * Append an audit event with hash chain
     */
    append(event: AuditEvent): void {
        if (!this.initialized) this.initialize();

        const sequence = this.lastSequence + 1;

        // Build content string for hashing (deterministic)
        const content = this.buildHashContent(event, sequence);

        // Compute event hash including previous hash for chain
        const hashInput = this.lastEventHash
            ? `${this.lastEventHash}:${content}`
            : content;
        const eventHash = ProvenanceTrace.hashInput(hashInput);

        const record: StoredAuditRecord = {
            event_id: event.id,
            actor_id: event.actorId,
            actor_type: event.actorType,
            tenant_id: event.tenantId,
            timestamp: event.timestamp,
            action: event.action,
            target: event.target,
            result: event.result,
            trace_id: event.traceId,
            authorization_result: event.authorizationResult,
            reason: event.reason,
            metadata_json: event.metadata ? JSON.stringify(event.metadata) : undefined,
            event_hash: eventHash,
            prev_event_hash: this.lastEventHash ?? undefined,
            sequence
        };

        // INSERT only - no UPDATE
        this.database.prepare(`
            INSERT INTO audit_events (
                event_id, actor_id, actor_type, tenant_id, timestamp,
                action, target, result, trace_id, authorization_result, reason,
                metadata_json, event_hash, prev_event_hash, sequence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            record.event_id,
            record.actor_id ?? null,
            record.actor_type ?? null,
            record.tenant_id ?? null,
            record.timestamp,
            record.action ?? null,
            record.target ?? null,
            record.result ?? null,
            record.trace_id ?? null,
            record.authorization_result ?? null,
            record.reason ?? null,
            record.metadata_json ?? null,
            record.event_hash,
            record.prev_event_hash ?? null,
            record.sequence
        );

        // Update chain state
        this.lastEventHash = eventHash;
        this.lastSequence = sequence;
    }

    /**
     * Query audit events by tenant
     */
    queryByTenant(tenantId: string, limit = 100): AuditEvent[] {
        if (!this.initialized) this.initialize();

        const rows = this.database.prepare(`
            SELECT * FROM audit_events
            WHERE tenant_id = ?
            ORDER BY sequence DESC
            LIMIT ?
        `).all(tenantId, limit) as unknown as StoredAuditRecord[];

        return rows.map(r => this.rowToEvent(r));
    }

    /**
     * Query audit events by trace ID
     */
    queryByTraceId(traceId: string): AuditEvent[] {
        if (!this.initialized) this.initialize();

        const rows = this.database.prepare(`
            SELECT * FROM audit_events
            WHERE trace_id = ?
            ORDER BY sequence ASC
        `).all(traceId) as unknown as StoredAuditRecord[];

        return rows.map(r => this.rowToEvent(r));
    }

    /**
     * Query audit events by actor
     */
    queryByActor(actorId: string, limit = 100): AuditEvent[] {
        if (!this.initialized) this.initialize();

        const rows = this.database.prepare(`
            SELECT * FROM audit_events
            WHERE actor_id = ?
            ORDER BY sequence DESC
            LIMIT ?
        `).all(actorId, limit) as unknown as StoredAuditRecord[];

        return rows.map(r => this.rowToEvent(r));
    }

    /**
     * Verify the entire audit chain integrity
     */
    verifyChain(): IntegrityCheckResult {
        if (!this.initialized) this.initialize();

        const rows = this.database.prepare(`
            SELECT * FROM audit_events ORDER BY sequence ASC
        `).all() as unknown as StoredAuditRecord[];

        if (rows.length === 0) {
            return { valid: true, reason: "Empty audit log" };
        }

        let expectedPrevHash: string | null = null;
        let expectedSequence = 1;

        for (const row of rows) {
            // Check sequence continuity
            if (row.sequence !== expectedSequence) {
                return {
                    valid: false,
                    eventId: row.event_id,
                    reason: "Sequence gap detected",
                    details: `Expected sequence ${expectedSequence}, got ${row.sequence}`
                };
            }

            // Check prev_event_hash linkage (both null/undefined treated as null for comparison)
            const rowPrevHash = row.prev_event_hash ?? null;
            if (rowPrevHash !== expectedPrevHash) {
                return {
                    valid: false,
                    eventId: row.event_id,
                    reason: "Hash chain broken",
                    details: `Expected prev_hash ${expectedPrevHash ?? "(none)"}, got ${rowPrevHash ?? "(none)"}`
                };
            }

            // Re-compute and verify event hash
            const content = this.buildHashContentFromRow(row);
            const hashInput = expectedPrevHash
                ? `${expectedPrevHash}:${content}`
                : content;
            const computedHash = ProvenanceTrace.hashInput(hashInput);

            if (computedHash !== row.event_hash) {
                return {
                    valid: false,
                    eventId: row.event_id,
                    reason: "Event hash mismatch - event may have been modified",
                    details: `Computed: ${computedHash}, Stored: ${row.event_hash}`
                };
            }

            expectedPrevHash = row.event_hash;
            expectedSequence++;
        }

        return { valid: true, reason: `Verified ${rows.length} events` };
    }

    /**
     * Verify a single event's integrity
     */
    verifyEvent(eventId: string): IntegrityCheckResult {
        if (!this.initialized) this.initialize();

        const row = this.database.prepare(`
            SELECT * FROM audit_events WHERE event_id = ?
        `).get(eventId) as unknown as StoredAuditRecord | undefined;

        if (!row) {
            return { valid: false, reason: "Event not found" };
        }

        const content = this.buildHashContentFromRow(row);
        const hashInput = row.prev_event_hash
            ? `${row.prev_event_hash}:${content}`
            : content;
        const computedHash = ProvenanceTrace.hashInput(hashInput);

        if (computedHash !== row.event_hash) {
            return {
                valid: false,
                eventId: row.event_id,
                reason: "Event hash mismatch - event may have been modified"
            };
        }

        return { valid: true, eventId: row.event_id, reason: "Event hash valid" };
    }

    /**
     * Get event count
     */
    eventCount(): number {
        if (!this.initialized) this.initialize();
        const row = this.database.prepare("SELECT COUNT(*) as count FROM audit_events").get() as { count: number } | undefined;
        return row?.count ?? 0;
    }

    /**
     * Close the audit store
     */
    close(): void {
        if (this.database.isOpen) this.database.close();
        this.initialized = false;
    }

    /**
     * Build deterministic hash content from AuditEvent
     */
    private buildHashContent(event: AuditEvent, sequence: number): string {
        return [
            event.id,
            event.actorId ?? "",
            event.actorType ?? "",
            event.tenantId ?? "",
            event.timestamp,
            event.action ?? "",
            event.target ?? "",
            event.result ?? "",
            event.traceId ?? "",
            event.authorizationResult ?? "",
            event.reason ?? "",
            event.metadata ? JSON.stringify(event.metadata) : "",
            sequence
        ].join("|");
    }

    /**
     * Build hash content from stored row
     */
    private buildHashContentFromRow(row: StoredAuditRecord): string {
        return [
            row.event_id,
            row.actor_id ?? "",
            row.actor_type ?? "",
            row.tenant_id ?? "",
            row.timestamp,
            row.action ?? "",
            row.target ?? "",
            row.result ?? "",
            row.trace_id ?? "",
            row.authorization_result ?? "",
            row.reason ?? "",
            row.metadata_json ?? "",
            row.sequence
        ].join("|");
    }

    /**
     * Convert stored row to AuditEvent
     */
    private rowToEvent(row: StoredAuditRecord): AuditEvent {
        return Object.freeze({
            id: row.event_id,
            actorId: row.actor_id,
            actorType: row.actor_type as PrincipalType | undefined,
            tenantId: row.tenant_id,
            timestamp: row.timestamp,
            action: row.action as AuditEventAction | undefined,
            target: row.target,
            result: row.result as AuditEventResult | undefined,
            traceId: row.trace_id,
            authorizationResult: row.authorization_result as AuthorizationResult | undefined,
            reason: row.reason,
            metadata: row.metadata_json && row.metadata_json.length > 0 ? JSON.parse(row.metadata_json) : undefined
        }) as AuditEvent;
    }
}
