import { randomUUID } from "node:crypto";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { InterdisciplinaryDecisionKnowledgeService } from "./InterdisciplinaryDecisionKnowledgeService";

export interface KnowledgeOutcomeInput {
  readonly task: string;
  readonly knowledgeVersion: string;
  readonly methodId: string;
  readonly metricCode: string;
  readonly predictedValue: number;
  readonly actualValue: number;
  readonly unit: string;
  readonly observedAt: string;
  readonly sourceEvidenceRef: string;
}

export interface KnowledgeOutcomeRecord extends KnowledgeOutcomeInput {
  readonly outcomeId: string;
  readonly absoluteError: number;
  readonly signedError: number;
  readonly symmetricAbsolutePercentageError: number;
  readonly recordedAt: string;
}

export interface KnowledgeOutcomeSummaryFilter {
  readonly task?: string;
  readonly methodId?: string;
  readonly metricCode?: string;
}

const STORE_KEY = "interdisciplinary-knowledge-outcomes:v1";
const MAX_RECORDS_PER_TENANT = 1000;
const MINIMUM_SAMPLES_FOR_HUMAN_REVIEW = 10;
const MAX_ABSOLUTE_VALUE = 1e15;

function isRecord(value: unknown): value is KnowledgeOutcomeRecord {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<KnowledgeOutcomeRecord>;
  return typeof v.outcomeId === "string"
    && typeof v.task === "string"
    && typeof v.knowledgeVersion === "string"
    && typeof v.methodId === "string"
    && typeof v.metricCode === "string"
    && Number.isFinite(v.predictedValue)
    && Number.isFinite(v.actualValue)
    && Number.isFinite(v.absoluteError)
    && Number.isFinite(v.signedError)
    && Number.isFinite(v.symmetricAbsolutePercentageError)
    && typeof v.unit === "string"
    && typeof v.observedAt === "string"
    && typeof v.sourceEvidenceRef === "string"
    && typeof v.recordedAt === "string";
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`knowledge-outcome-${field}-invalid`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`knowledge-outcome-${field}-invalid`);
  }
  return normalized;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > MAX_ABSOLUTE_VALUE) {
    throw new Error(`knowledge-outcome-${field}-invalid`);
  }
  return value;
}

/**
 * Persisted, tenant-scoped outcome evidence for evaluating knowledge/method quality.
 * Observations can signal a review; this service never changes/promotes methods automatically.
 */
export class KnowledgeOutcomeLearningService {
  readonly version = "knowledge-outcome-learning-2026-10-10.v1";

  constructor(
    private readonly persistence: SQLitePersistenceStore,
    private readonly knowledge = new InterdisciplinaryDecisionKnowledgeService(),
  ) {}

  async recordOutcome(tenantId: string, input: unknown): Promise<{
    readonly recorded: true;
    readonly outcomeId: string;
    readonly retainedRecords: number;
    readonly automaticPromotionAllowed: false;
  }> {
    if (typeof tenantId !== "string" || !tenantId.trim()) {
      throw new Error("knowledge-outcome-tenant-required");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("knowledge-outcome-input-invalid");
    }

    const value = input as Partial<KnowledgeOutcomeInput>;
    const task = requiredString(value.task, "task", 64).toUpperCase();
    const taskProfiles = this.knowledge.getCatalogue().taskProfiles as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(taskProfiles, task)) {
      throw new Error("knowledge-outcome-task-invalid");
    }

    const knowledgeVersion = requiredString(value.knowledgeVersion, "knowledge-version", 100);
    const methodId = requiredString(value.methodId, "method-id", 96);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,95}$/.test(methodId)) {
      throw new Error("knowledge-outcome-method-id-invalid");
    }
    const metricCode = requiredString(value.metricCode, "metric-code", 96);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,95}$/.test(metricCode)) {
      throw new Error("knowledge-outcome-metric-code-invalid");
    }
    const predictedValue = finiteNumber(value.predictedValue, "predicted-value");
    const actualValue = finiteNumber(value.actualValue, "actual-value");
    const unit = requiredString(value.unit, "unit", 24);
    const sourceEvidenceRef = requiredString(value.sourceEvidenceRef, "source-evidence-ref", 200);
    const observedAtInput = requiredString(value.observedAt, "observed-at", 40);
    const observedAtDate = new Date(observedAtInput);
    if (
      !/^\d{4}-\d{2}-\d{2}T/.test(observedAtInput)
      || Number.isNaN(observedAtDate.getTime())
      || observedAtDate.getTime() > Date.now() + 5 * 60 * 1000
    ) {
      throw new Error("knowledge-outcome-observed-at-invalid");
    }
    const observedAt = observedAtDate.toISOString();
    const absoluteError = Math.abs(actualValue - predictedValue);
    const signedError = actualValue - predictedValue;
    const denominator = Math.abs(actualValue) + Math.abs(predictedValue);
    const symmetricAbsolutePercentageError = denominator === 0
      ? 0
      : (2 * absoluteError / denominator) * 100;

    const record: KnowledgeOutcomeRecord = {
      outcomeId: randomUUID(),
      task,
      knowledgeVersion,
      methodId,
      metricCode,
      predictedValue,
      actualValue,
      absoluteError,
      signedError,
      symmetricAbsolutePercentageError,
      unit,
      observedAt,
      sourceEvidenceRef,
      recordedAt: new Date().toISOString(),
    };

    const stored = await this.persistence.mutate({ tenantId: tenantId.trim() }, STORE_KEY, (current) => {
      if (current === null) return [record];
      if (!Array.isArray(current) || !current.every(isRecord)) {
        throw new Error("knowledge-outcome-store-invalid");
      }
      return [...current, record].slice(-MAX_RECORDS_PER_TENANT);
    });
    if (!Array.isArray(stored.value) || !stored.value.every(isRecord)) {
      throw new Error("knowledge-outcome-store-invalid");
    }
    return {
      recorded: true,
      outcomeId: record.outcomeId,
      retainedRecords: stored.value.length,
      automaticPromotionAllowed: false,
    };
  }

  async summarize(tenantId: string, filter: KnowledgeOutcomeSummaryFilter = {}) {
    if (typeof tenantId !== "string" || !tenantId.trim()) {
      throw new Error("knowledge-outcome-tenant-required");
    }
    const task = filter.task?.trim().toUpperCase();
    const methodId = filter.methodId?.trim();
    const metricCode = filter.metricCode?.trim();
    const taskProfiles = this.knowledge.getCatalogue().taskProfiles as Record<string, unknown>;
    if (task && !Object.prototype.hasOwnProperty.call(taskProfiles, task)) {
      throw new Error("knowledge-outcome-task-invalid");
    }
    if (methodId && !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,95}$/.test(methodId)) {
      throw new Error("knowledge-outcome-method-id-invalid");
    }
    if (metricCode && !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,95}$/.test(metricCode)) {
      throw new Error("knowledge-outcome-metric-code-invalid");
    }

    const stored = await this.persistence.read({ tenantId: tenantId.trim() }, STORE_KEY);
    if (stored === null) {
      return this.emptySummary(task, methodId, metricCode);
    }
    if (!Array.isArray(stored.value) || !stored.value.every(isRecord)) {
      throw new Error("knowledge-outcome-store-invalid");
    }

    const filtered = stored.value.filter((record) =>
      (!task || record.task === task)
      && (!methodId || record.methodId === methodId)
      && (!metricCode || record.metricCode === metricCode)
    );
    const groups = new Map<string, KnowledgeOutcomeRecord[]>();
    for (const record of filtered) {
      const key = JSON.stringify([record.task, record.methodId, record.metricCode, record.unit, record.knowledgeVersion]);
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }

    const summaries = [...groups.values()].map((records) => {
      const first = records[0];
      const meanAbsoluteError = records.reduce((sum, record) => sum + record.absoluteError, 0) / records.length;
      const meanSquaredError = records.reduce((sum, record) => sum + record.absoluteError ** 2, 0) / records.length;
      const meanBias = records.reduce((sum, record) => sum + record.signedError, 0) / records.length;
      const symmetricAbsolutePercentageError = records.reduce((sum, record) => sum + record.symmetricAbsolutePercentageError, 0) / records.length;
      const latestObservedAt = records.reduce((latest, record) => record.observedAt > latest ? record.observedAt : latest, records[0].observedAt);
      return {
        task: first.task,
        methodId: first.methodId,
        metricCode: first.metricCode,
        unit: first.unit,
        knowledgeVersion: first.knowledgeVersion,
        sampleCount: records.length,
        meanAbsoluteError: Number(meanAbsoluteError.toFixed(8)),
        rootMeanSquaredError: Number(Math.sqrt(meanSquaredError).toFixed(8)),
        meanBias: Number(meanBias.toFixed(8)),
        meanSymmetricAbsolutePercentageError: Number(symmetricAbsolutePercentageError.toFixed(8)),
        latestObservedAt,
        reviewStatus: records.length >= MINIMUM_SAMPLES_FOR_HUMAN_REVIEW
          ? "HUMAN_REVIEW_CANDIDATE" as const
          : "COLLECTING_EVIDENCE" as const,
        automaticPromotionAllowed: false as const,
      };
    }).sort((a, b) => a.task.localeCompare(b.task) || a.methodId.localeCompare(b.methodId) || a.metricCode.localeCompare(b.metricCode));

    return {
      serviceVersion: this.version,
      tenantScoped: true,
      totalRetainedRecords: stored.value.length,
      filteredRecordCount: filtered.length,
      minimumSamplesForHumanReview: MINIMUM_SAMPLES_FOR_HUMAN_REVIEW,
      automaticPromotionAllowed: false as const,
      reviewRule: "Metrics are descriptive evidence, not proof of causal impact; no knowledge/method is promoted without documented review and regression tests.",
      filters: { task: task ?? null, methodId: methodId ?? null, metricCode: metricCode ?? null },
      groups: summaries,
    };
  }

  private emptySummary(task?: string, methodId?: string, metricCode?: string) {
    return {
      serviceVersion: this.version,
      tenantScoped: true,
      totalRetainedRecords: 0,
      filteredRecordCount: 0,
      minimumSamplesForHumanReview: MINIMUM_SAMPLES_FOR_HUMAN_REVIEW,
      automaticPromotionAllowed: false as const,
      reviewRule: "Metrics are descriptive evidence, not proof of causal impact; no knowledge/method is promoted without documented review and regression tests.",
      filters: { task: task ?? null, methodId: methodId ?? null, metricCode: metricCode ?? null },
      groups: [],
    };
  }
}
