/**
 * Stage 07-A - TimeSeriesStore
 *
 * Canonical temporal observation storage backed by SQLite.
 *
 * Features:
 * - Append-only observation storage
 * - Tenant-safe filtering at query boundary
 * - Range queries with deterministic ordering
 * - Index on (tenant_id, metric_name, timestamp)
 * - Persistence across restarts
 */

import { createHash, randomUUID } from "node:crypto";
import {
    MetricObservation,
    AppendObservationInput,
    ObservationAppendResult,
    ObservationQueryResult,
    QueryObservationsInput
} from "./TemporalTypes";
import { TemporalValidator, ValidationError } from "./TemporalValidator";
import { TenantIsolation } from "../Security/TenantIsolation";
import { SecurityContext } from "../Security/SecurityContext";
import { Authorization } from "../Security/Authorization";

/**
 * Database row representation
 */
interface TimeSeriesRow {
    id: string;
    tenant_id: string;
    metric_name: string;
    value: number;
    timestamp: string;
    source: string;
    provenance_ref: string | null;
    quality_flags: string | null;
    recorded_at: string;
}

/**
 * TimeSeriesStore configuration
 */
export interface TimeSeriesStoreConfig {
    databasePath: string;
}

/**
 * Result factory
 */
function success<T>(data: T): { success: true; data: T } {
    return { success: true, data };
}

function failure<T>(error: string): { success: false; error: string } {
    return { success: false, error };
}

/**
 * TimeSeriesStore - Canonical temporal observation storage
 */
export class TimeSeriesStore {
    private db: any;
    private initialized: boolean = false;

    constructor(private config: TimeSeriesStoreConfig) {}

    /**
     * Initialize the store (create tables, indexes)
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        const Database = require("better-sqlite3");
        this.db = new Database(this.config.databasePath);
        this.db.pragma("journal_mode = WAL");

        // Create time series table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS time_series_observations (
                id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                metric_name TEXT NOT NULL,
                value REAL NOT NULL,
                timestamp TEXT NOT NULL,
                source TEXT NOT NULL,
                provenance_ref TEXT,
                quality_flags TEXT,
                recorded_at TEXT NOT NULL
            )
        `);

        // Create composite index for efficient tenant+metric+time queries
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_time_series_lookup
            ON time_series_observations(tenant_id, metric_name, timestamp)
        `);

        // Create index for latest queries
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_time_series_latest
            ON time_series_observations(tenant_id, metric_name, timestamp DESC)
        `);

        this.initialized = true;
    }

    /**
     * Health check
     */
    async health(): Promise<boolean> {
        if (!this.initialized) return false;
        try {
            this.db.prepare("SELECT 1").get();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Close the store
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initialized = false;
        }
    }

    /**
     * Append a new observation
     */
    async append(input: AppendObservationInput): Promise<ObservationAppendResult> {
        // Validate input
        const validation = TemporalValidator.validateObservation(input);
        if (!validation.valid) {
            return failure(`Validation failed: ${validation.errors.join("; ")}`);
        }

        try {
            const id = randomUUID();
            const recordedAt = new Date().toISOString();
            const provenanceRef = input.provenanceRef || null;
            const qualityFlags = input.qualityFlags?.length
                ? JSON.stringify(input.qualityFlags)
                : null;

            const stmt = this.db.prepare(`
                INSERT INTO time_series_observations
                (id, tenant_id, metric_name, value, timestamp, source, provenance_ref, quality_flags, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                id,
                input.tenantId.trim(),
                input.metricName.trim(),
                input.value,
                input.timestamp.trim(),
                input.source.trim(),
                provenanceRef,
                qualityFlags,
                recordedAt
            );

            const observation: MetricObservation = {
                id,
                tenantId: input.tenantId.trim(),
                metricName: input.metricName.trim(),
                value: input.value,
                timestamp: input.timestamp.trim(),
                source: input.source.trim(),
                provenanceRef: input.provenanceRef,
                qualityFlags: input.qualityFlags,
                recordedAt
            };

            return { success: true as const, observation };
        } catch (error) {
            return { success: false as const, error: `Failed to append observation: ${error}` };
        }
    }

    /**
     * Query observations within a time range
     */
    async query(input: QueryObservationsInput): Promise<ObservationQueryResult> {
        // Validate time range
        const validation = TemporalValidator.validateTimeRange(input.startTime, input.endTime);
        if (!validation.valid) {
            return { success: false, count: 0, error: validation.errors.join("; ") };
        }

        try {
            let stmt;
            if (input.limit !== undefined && input.limit > 0) {
                stmt = this.db.prepare(`
                    SELECT * FROM time_series_observations
                    WHERE tenant_id = ? AND metric_name = ? AND timestamp >= ? AND timestamp < ?
                    ORDER BY timestamp ASC
                    LIMIT ?
                `);
                const rows = stmt.all(
                    input.tenantId,
                    input.metricName,
                    input.startTime,
                    input.endTime,
                    input.limit
                );
                return {
                    success: true,
                    observations: Object.freeze(rows.map(this.rowToObservation)),
                    count: rows.length
                };
            } else {
                stmt = this.db.prepare(`
                    SELECT * FROM time_series_observations
                    WHERE tenant_id = ? AND metric_name = ? AND timestamp >= ? AND timestamp < ?
                    ORDER BY timestamp ASC
                `);
                const rows = stmt.all(
                    input.tenantId,
                    input.metricName,
                    input.startTime,
                    input.endTime
                );
                return {
                    success: true,
                    observations: Object.freeze(rows.map(this.rowToObservation)),
                    count: rows.length
                };
            }
        } catch (error) {
            return { success: false, count: 0, error: `Query failed: ${error}` };
        }
    }

    /**
     * Get the latest N observations for a metric
     *
     * Returns the N most recent observations, ordered chronologically ASCENDING
     * for deterministic downstream analytics.
     *
     * Implementation:
     * 1. SELECT newest N rows using ORDER BY timestamp DESC, LIMIT N
     * 2. Reverse results so output is ASC (oldest first)
     */
    async latest(tenantId: string, metricName: string, n: number): Promise<ObservationQueryResult> {
        if (!tenantId || !metricName || n <= 0) {
            return { success: false, count: 0, error: "Invalid parameters" };
        }

        try {
            const stmt = this.db.prepare(`
                SELECT * FROM time_series_observations
                WHERE tenant_id = ? AND metric_name = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `);
            const rows = stmt.all(tenantId, metricName, n);
            // Reverse to return in chronological order (ASC) for downstream
            return {
                success: true,
                observations: Object.freeze(rows.map(this.rowToObservation).reverse()),
                count: rows.length
            };
        } catch (error) {
            return { success: false, count: 0, error: `Latest query failed: ${error}` };
        }
    }

    /**
     * Count observations for a metric in a time range
     */
    async count(tenantId: string, metricName: string, startTime?: string, endTime?: string): Promise<number> {
        if (!tenantId || !metricName) {
            return 0;
        }

        try {
            let stmt;
            if (startTime && endTime) {
                stmt = this.db.prepare(`
                    SELECT COUNT(*) as cnt FROM time_series_observations
                    WHERE tenant_id = ? AND metric_name = ? AND timestamp >= ? AND timestamp < ?
                `);
                const result = stmt.get(tenantId, metricName, startTime, endTime);
                return result?.cnt ?? 0;
            } else {
                stmt = this.db.prepare(`
                    SELECT COUNT(*) as cnt FROM time_series_observations
                    WHERE tenant_id = ? AND metric_name = ?
                `);
                const result = stmt.get(tenantId, metricName);
                return result?.cnt ?? 0;
            }
        } catch {
            return 0;
        }
    }

    /**
     * Check if tenant isolation is enforced
     */
    async enforceTenantIsolation(
        context: SecurityContext,
        tenantId: string
    ): Promise<{ allowed: boolean; reason: string }> {
        const mockResource = { tenantId };
        const authResult = TenantIsolation.checkAccess(context, mockResource, Authorization.READ);

        if (authResult.result !== authResult.result) {
            return { allowed: false, reason: authResult.reason };
        }

        // Additional check: ensure query tenant matches context tenant
        if (context.tenantId && context.tenantId !== tenantId) {
            return { allowed: false, reason: "Tenant mismatch in query" };
        }

        return { allowed: true, reason: "OK" };
    }

    /**
     * Convert database row to observation
     */
    private rowToObservation(row: TimeSeriesRow): MetricObservation {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            metricName: row.metric_name,
            value: row.value,
            timestamp: row.timestamp,
            source: row.source,
            provenanceRef: row.provenance_ref || undefined,
            qualityFlags: row.quality_flags ? JSON.parse(row.quality_flags) : undefined,
            recordedAt: row.recorded_at
        };
    }
}
