/**
 * Stage 15-ING.2 — Durable ingestion job/status owner.
 *
 * A supporting service (NOT an Engine and NOT a second ingestion path). It owns
 * exactly one responsibility: the durable, tenant-scoped lifecycle of a
 * long-running ingestion so the product can show REAL progress instead of a
 * frozen button. It delegates every semantic to the canonical
 * `FinancialIngestionService` (whose owner remains `FinancialDataIngestionAdapter`).
 *
 * Durability: each job is persisted through the canonical
 * `SQLitePersistenceStore` under `ingestion-job:<jobId>`, so status survives an
 * ordinary page refresh and process restart. A job started by a previous process
 * can never be reported as still running: on read it is reconciled to a precise
 * `ingestion-job-interrupted` failure. Completion is claimed only after the
 * runner returns real evidence, so the status can never claim success without it.
 *
 * Idempotency: an optional `Idempotency-Key` is claimed atomically with
 * `writeIfAbsent` under `ingestion-job-claim:<actor>:<key>`, so a duplicate
 * submission never executes a second ingestion side effect. The duplicate
 * resolves to the SAME job (replayed) rather than a second run.
 */
import { randomUUID } from "node:crypto";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import type {
  FinancialSourceEvidence,
} from "./FinancialDataIngestionAdapter";
import type { IngestionOutcome, IngestionRequest } from "./FinancialIngestionService";
import {
  ingestionFailureMessageFa,
  ingestionStageMessageFa,
  isTerminalIngestionStage,
  type IngestionProgressEvent,
  type IngestionProgressObserver,
  type IngestionStage,
} from "./IngestionProgress";

const JOB_PREFIX = "ingestion-job:";
const CLAIM_PREFIX = "ingestion-job-claim:";

export type IngestionJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface IngestionJobProgress {
  readonly page?: number;
  readonly pages?: number;
  readonly percent?: number;
}

export interface IngestionJobResultSummary {
  readonly sha256: string;
  readonly sourceName: string;
  readonly sourceType: string;
  readonly transactionCount: number;
  readonly totals: { readonly debit: number; readonly credit: number; readonly balance: number };
  readonly rawSourcePersistenceKey: string;
  readonly evidence: FinancialSourceEvidence;
}

interface IngestionJobRecord {
  readonly jobId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly sourceName: string;
  readonly format: string;
  readonly status: IngestionJobStatus;
  readonly stage: IngestionStage;
  readonly message: string;
  readonly code?: string;
  readonly progress: IngestionJobProgress | null;
  readonly receivedAt: string;
  readonly startedAt?: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly result?: IngestionJobResultSummary;
  /** Internal: the idempotency claim key to release when the job fails. */
  readonly claimKey?: string;
}

/** Public, tenant-safe projection returned to the runtime/client. */
export interface IngestionJobView {
  readonly jobId: string;
  readonly tenantId: string;
  readonly sourceName: string;
  readonly format: string;
  readonly status: IngestionJobStatus;
  readonly stage: IngestionStage;
  readonly message: string;
  readonly code?: string;
  readonly progress: IngestionJobProgress | null;
  readonly receivedAt: string;
  readonly startedAt?: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly result?: IngestionJobResultSummary;
}

export type IngestionJobRunner = (
  tenantId: string,
  request: IngestionRequest,
  observer: IngestionProgressObserver,
) => Promise<IngestionOutcome>;

export interface IngestionJobServiceOptions {
  readonly now?: () => number;
  /** Process start time; jobs received before it cannot still be running. */
  readonly processStartedAtMs?: number;
  readonly runner: IngestionJobRunner;
}

export class IngestionJobService {
  private readonly now: () => number;
  private readonly processStartedAtMs: number;
  private readonly runner: IngestionJobRunner;
  private readonly active = new Set<string>();
  private readonly chains = new Map<string, Promise<unknown>>();

  constructor(
    private readonly persistence: SQLitePersistenceStore,
    options: IngestionJobServiceOptions,
  ) {
    this.now = options.now ?? (() => Date.now());
    this.processStartedAtMs = options.processStartedAtMs ?? this.now();
    this.runner = options.runner;
  }

  /**
   * Start (or resolve) an ingestion job. Returns the SAME job for a repeated
   * `Idempotency-Key`, so a duplicate submission never triggers a second side
   * effect. `replayed` is true when an existing job (running or terminal) was
   * returned instead of starting a new run.
   */
  async start(
    tenantId: string,
    actorId: string,
    request: IngestionRequest,
    idempotencyKey?: string,
  ): Promise<{ readonly job: IngestionJobView; readonly replayed: boolean }> {
    const normalizedTenant = tenantId?.trim() ?? "";
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    const normalizedActor = actorId?.trim() || "unknown";
    const key = idempotencyKey?.trim();

    if (key) {
      const claimKey = `${CLAIM_PREFIX}${normalizedActor}:${key}`;
      const candidateId = randomUUID();
      const claim = await this.persistence.writeIfAbsent(
        { tenantId: normalizedTenant },
        claimKey,
        { jobId: candidateId, createdAt: new Date(this.now()).toISOString() },
      );
      const claimedJobId = (claim.record.value as { jobId?: string } | undefined)?.jobId ?? candidateId;

      if (!claim.created) {
        const existing = await this.readRecord(normalizedTenant, claimedJobId);
        if (existing) return { job: this.toView(await this.reconcile(normalizedTenant, existing)), replayed: true };
      }

      const record = this.initialRecord(claimedJobId, normalizedTenant, normalizedActor, request, claimKey);
      await this.persistence.write({ tenantId: normalizedTenant }, `${JOB_PREFIX}${claimedJobId}`, record);
      this.dispatch(record, request);
      return { job: this.toView(record), replayed: false };
    }

    const record = this.initialRecord(randomUUID(), normalizedTenant, normalizedActor, request);
    await this.persistence.write({ tenantId: normalizedTenant }, `${JOB_PREFIX}${record.jobId}`, record);
    this.dispatch(record, request);
    return { job: this.toView(record), replayed: false };
  }

  async get(tenantId: string, jobId: string): Promise<IngestionJobView | null> {
    const normalizedTenant = tenantId?.trim() ?? "";
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    const record = await this.readRecord(normalizedTenant, jobId?.trim() ?? "");
    if (!record) return null;
    return this.toView(await this.reconcile(normalizedTenant, record));
  }

  async list(tenantId: string, limit: number, offset: number): Promise<{ readonly items: IngestionJobView[]; readonly total: number }> {
    const normalizedTenant = tenantId?.trim() ?? "";
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    const rows = this.persistence.database
      .prepare("SELECT key, value_json FROM persistence_records WHERE tenant_id = ? AND key LIKE ? ORDER BY updated_at DESC, key ASC")
      .all(normalizedTenant, `${JOB_PREFIX}%`) as Array<{ key: string; value_json: string }>;

    const views: IngestionJobView[] = [];
    for (const row of rows) {
      const record = this.parseRecord(row.key, row.value_json);
      if (!record || record.tenantId !== normalizedTenant) continue;
      views.push(this.toView(await this.reconcile(normalizedTenant, record)));
    }
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : views.length;
    const safeOffset = Number.isInteger(offset) && offset > 0 ? offset : 0;
    return { items: views.slice(safeOffset, safeOffset + safeLimit), total: views.length };
  }

  private initialRecord(
    jobId: string,
    tenantId: string,
    actorId: string,
    request: IngestionRequest,
    claimKey?: string,
  ): IngestionJobRecord {
    const receivedAt = new Date(this.now()).toISOString();
    return {
      jobId,
      tenantId,
      actorId,
      sourceName: request.sourceName,
      format: request.format,
      status: "PENDING",
      stage: "RECEIVED",
      message: ingestionStageMessageFa({ stage: "RECEIVED" }),
      progress: null,
      receivedAt,
      updatedAt: receivedAt,
      ...(claimKey ? { claimKey } : {}),
    };
  }

  private dispatch(record: IngestionJobRecord, request: IngestionRequest): void {
    void this.execute(record, request).catch(() => {
      /* execute() records its own terminal state; never an unhandled rejection */
    });
  }

  private async execute(record: IngestionJobRecord, request: IngestionRequest): Promise<void> {
    const { tenantId, jobId } = record;
    this.active.add(jobId);
    const startedAt = new Date(this.now()).toISOString();
    try {
      await this.enqueue(jobId, () =>
        this.applyUpdate(tenantId, jobId, (current) => ({
          ...current,
          status: "RUNNING",
          stage: "VALIDATING",
          message: ingestionStageMessageFa({ stage: "VALIDATING" }),
          startedAt,
          updatedAt: startedAt,
        })),
      );

      const outcome = await this.runner(tenantId, request, (event) =>
        this.observe(tenantId, jobId, event),
      );

      const completedAt = new Date(this.now()).toISOString();
      await this.enqueue(jobId, () =>
        this.applyUpdate(tenantId, jobId, (current) => ({
          ...current,
          status: "COMPLETED",
          stage: "COMPLETED",
          message: ingestionStageMessageFa({ stage: "COMPLETED" }),
          code: undefined,
          result: this.summary(outcome),
          completedAt,
          updatedAt: completedAt,
        })),
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "ingestion-failed";
      const completedAt = new Date(this.now()).toISOString();
      await this.enqueue(jobId, () =>
        this.applyUpdate(tenantId, jobId, (current) => ({
          ...current,
          status: "FAILED",
          stage: "FAILED",
          message: ingestionFailureMessageFa(code),
          code,
          completedAt,
          updatedAt: completedAt,
        })),
      ).catch(() => undefined);
      // Release the idempotency claim so a legitimate retry with the same key
      // can proceed (failure produced no accepted side effect to replay).
      if (record.claimKey) {
        try { await this.persistence.delete({ tenantId }, record.claimKey); } catch { /* claim is a guard, never the job result */ }
      }
    } finally {
      this.active.delete(jobId);
    }
  }

  private observe(tenantId: string, jobId: string, event: IngestionProgressEvent): void {
    void this.enqueue(jobId, () =>
      this.applyUpdate(tenantId, jobId, (current) => {
        if (isTerminalIngestionStage(current.stage)) return current;
        const hasProgress = typeof event.page === "number" || typeof event.pages === "number" || typeof event.percent === "number";
        const progress: IngestionJobProgress | null = hasProgress
          ? {
              page: event.page ?? current.progress?.page,
              pages: event.pages ?? current.progress?.pages,
              percent: event.percent ?? current.progress?.percent,
            }
          : current.progress;
        return {
          ...current,
          status: "RUNNING",
          stage: event.stage,
          message: ingestionStageMessageFa(event),
          code: event.code,
          progress,
          updatedAt: new Date(this.now()).toISOString(),
        };
      }),
    ).catch(() => {
      /* progress is observable state, never the ingestion result */
    });
  }

  /**
   * Never report a job from a previous process as still running. A non-terminal
   * job that is not active in this process but predates it is reconciled to a
   * precise, durable `ingestion-job-interrupted` failure.
   */
  private async reconcile(tenantId: string, record: IngestionJobRecord): Promise<IngestionJobRecord> {
    if (isTerminalIngestionStage(record.stage) || this.active.has(record.jobId)) return record;
    const receivedMs = Date.parse(record.receivedAt);
    if (!Number.isFinite(receivedMs) || receivedMs >= this.processStartedAtMs) return record;

    const completedAt = new Date(this.now()).toISOString();
    const updated = await this.applyUpdate(tenantId, record.jobId, (current) => ({
      ...current,
      status: "FAILED",
      stage: "FAILED",
      message: ingestionFailureMessageFa("ingestion-job-interrupted"),
      code: "ingestion-job-interrupted",
      completedAt,
      updatedAt: completedAt,
    }));
    if (record.claimKey) {
      try { await this.persistence.delete({ tenantId }, record.claimKey); } catch { /* best effort */ }
    }
    return updated;
  }

  private async applyUpdate(
    tenantId: string,
    jobId: string,
    update: (current: IngestionJobRecord) => IngestionJobRecord,
  ): Promise<IngestionJobRecord> {
    const current = await this.readRecord(tenantId, jobId);
    if (!current) throw new Error("ingestion-job-not-found");
    const next = update(current);
    await this.persistence.write({ tenantId }, `${JOB_PREFIX}${jobId}`, next);
    return next;
  }

  private enqueue(jobId: string, task: () => Promise<unknown>): Promise<unknown> {
    const previous = this.chains.get(jobId) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.chains.set(jobId, next.catch(() => undefined));
    return next;
  }

  private async readRecord(tenantId: string, jobId: string): Promise<IngestionJobRecord | null> {
    if (!/^[0-9a-f-]{8,64}$/i.test(jobId)) return null;
    const stored = await this.persistence.read({ tenantId }, `${JOB_PREFIX}${jobId}`);
    if (!stored) return null;
    try {
      const record = stored.value as IngestionJobRecord;
      if (!record || record.tenantId !== tenantId || record.jobId !== jobId) return null;
      return record;
    } catch {
      return null;
    }
  }

  private parseRecord(_key: string, valueJson: string): IngestionJobRecord | null {
    try {
      const record = JSON.parse(valueJson) as IngestionJobRecord;
      if (!record?.jobId || !record.tenantId) return null;
      return record;
    } catch {
      return null;
    }
  }

  private summary(outcome: IngestionOutcome): IngestionJobResultSummary {
    return {
      sha256: outcome.result.evidence.sha256,
      sourceName: outcome.result.evidence.sourceName,
      sourceType: outcome.result.evidence.sourceType,
      transactionCount: outcome.result.model.transactions.length,
      totals: outcome.result.model.totals,
      rawSourcePersistenceKey: outcome.rawSourceRef.persistenceKey,
      evidence: outcome.result.evidence,
    };
  }

  private toView(record: IngestionJobRecord): IngestionJobView {
    const { claimKey: _claimKey, actorId: _actorId, ...view } = record;
    return view;
  }
}
