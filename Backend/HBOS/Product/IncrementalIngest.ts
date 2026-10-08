/**
 * Stage 08-AUTO.2 — Change Detection / Incremental Ingest.
 *
 * Pure supporting service. Wraps the canonical
 * FinancialDataIngestionAdapter.ingestFile with a SHA-256 short-circuit:
 * if the file's content hash matches a previously stored hash for the
 * (tenantId, sourceName) pair, the ingest is skipped and an
 * "unchanged" result is returned. New evidence fields
 * `sourceVersion` (monotonic) and `previousSha256` are tracked in a
 * small in-memory state map for the watcher pipeline. The state map is
 * tenant-scoped so cross-tenant leakage is impossible.
 *
 * This module is NOT a new Engine.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type {
  FinancialDataIngestionAdapter,
  FinancialIngestionResult,
} from "./FinancialDataIngestionAdapter";

export const INCREMENTAL_ERROR_CODES = {
  TENANT_REQUIRED: "ingestion-incremental-tenant-required",
  SOURCE_REQUIRED: "ingestion-incremental-source-required",
  PATH_REQUIRED: "ingestion-incremental-path-required",
} as const;

export interface IncrementalIngestOptions {
  /** Force re-ingestion even when content hash matches. Default false. */
  readonly force?: boolean;
}

export interface IncrementalIngestOutcome {
  readonly status: "ingested" | "unchanged" | "skipped";
  readonly sourceName: string;
  readonly currentSha256: string;
  readonly previousSha256: string | null;
  readonly sourceVersion: number;
  readonly result?: FinancialIngestionResult;
  readonly reason?: string;
}

interface PerTenantState {
  perSource: Map<string, { sha256: string; version: number }>;
}

export class IncrementalIngestGate {
  private readonly adapter: FinancialDataIngestionAdapter;
  private readonly state: Map<string, PerTenantState> = new Map();

  constructor(adapter: FinancialDataIngestionAdapter) {
    this.adapter = adapter;
  }

  private getState(tenantId: string): PerTenantState {
    let s = this.state.get(tenantId);
    if (!s) {
      s = { perSource: new Map() };
      this.state.set(tenantId, s);
    }
    return s;
  }

  /** For tests: wipe state for a tenant. */
  reset(tenantId: string): void { this.state.delete(tenantId); }

  async ingest(params: {
    readonly tenantId: string;
    readonly sourcePath: string;
    readonly options?: IncrementalIngestOptions;
  }): Promise<IncrementalIngestOutcome> {
    const tenantId = params.tenantId?.trim() ?? "";
    if (!tenantId) throw new Error(INCREMENTAL_ERROR_CODES.TENANT_REQUIRED);
    const path = params.sourcePath?.trim() ?? "";
    if (!path) throw new Error(INCREMENTAL_ERROR_CODES.PATH_REQUIRED);

    const sourceName = basename(path);
    if (!sourceName) throw new Error(INCREMENTAL_ERROR_CODES.SOURCE_REQUIRED);

    const raw = await readFile(path);
    const currentSha256 = createHash("sha256").update(raw).digest("hex");

    const state = this.getState(tenantId);
    const prev = state.perSource.get(sourceName);
    const previousSha256 = prev?.sha256 ?? null;
    const previousVersion = prev?.version ?? 0;

    if (!params.options?.force && prev && prev.sha256 === currentSha256) {
      return {
        status: "unchanged",
        sourceName,
        currentSha256,
        previousSha256,
        sourceVersion: previousVersion,
        reason: "content-hash-unchanged",
      };
    }

    const result = await this.adapter.ingestFile(tenantId, path);
    const newVersion = previousVersion + 1;
    state.perSource.set(sourceName, { sha256: currentSha256, version: newVersion });
    return {
      status: "ingested",
      sourceName,
      currentSha256,
      previousSha256,
      sourceVersion: newVersion,
      result,
    };
  }

  /**
   * Pure helper: given a buffer and a previous sha256, decide whether
   * the content has changed. Exposed for callers that already have the
   * hash in hand.
   */
  static isChanged(currentSha256: string, previousSha256: string | null): boolean {
    if (previousSha256 === null) return true;
    return currentSha256 !== previousSha256;
  }
}