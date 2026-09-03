/**
 * Stage 07-J - EvaluationRegistry
 *
 * In-memory registry for EvaluationRecord objects.
 *
 * IMPORTANT:
 * - In-memory only; not persistent across restarts.
 * - Tenant isolation: all queries require and filter by tenantId.
 * - All outputs frozen.
 * - Deterministic.
 */

import { EvaluationRecord } from "./EvaluationTypes";

export class EvaluationRegistry {
    private records: Array<{ record: EvaluationRecord; tenantId: string; methodName: string }> = [];

    register(record: EvaluationRecord): void {
        if (!record || !record.provenance) {
            throw new Error("invalid_request: EvaluationRecord and provenance are required.");
        }
        this.records.push({
            record,
            tenantId: record.provenance.tenant,
            methodName: record.provenance.method
        });
    }

    getForMethod(methodName: string, tenantId: string): EvaluationRecord[] {
        if (!tenantId) {
            throw new Error("tenantId is required for getForMethod.");
        }
        return this.records
            .filter(r => r.tenantId === tenantId && r.methodName === methodName)
            .map(r => r.record);
    }

    getLatest(methodName: string, tenantId: string): EvaluationRecord | null {
        if (!tenantId) {
            throw new Error("tenantId is required for getLatest.");
        }
        const matches = this.records.filter(r => r.tenantId === tenantId && r.methodName === methodName);
        if (matches.length === 0) return null;
        return matches[matches.length - 1].record;
    }

    getAll(tenantId: string): EvaluationRecord[] {
        if (!tenantId) {
            throw new Error("tenantId is required for getAll.");
        }
        return this.records
            .filter(r => r.tenantId === tenantId)
            .map(r => r.record);
    }
}

export const evaluationRegistry = new EvaluationRegistry();
