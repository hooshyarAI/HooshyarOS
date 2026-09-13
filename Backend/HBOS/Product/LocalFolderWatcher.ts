/**
 * Stage 08-AUTO.1 — Local Folder Acquisition Contract.
 *
 * Pure supporting service that watches a local folder using the Node
 * built-in `fs.watch` (no new dep) and hands off stable file events to
 * the canonical FinancialDataIngestionAdapter. The watcher:
 *   - debounces bursts of events
 *   - ignores transient files (.tmp, .partial, ~$ lock files, hidden)
 *   - supports start() / stop() lifecycle
 *   - does NOT swallow errors; the caller is responsible for plumbing
 *
 * This module is NOT a new Engine.
 */
import { promises as fs, watch, type FSWatcher } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { FinancialDataIngestionAdapter } from "./FinancialDataIngestionAdapter";

export const WATCHER_ERROR_CODES = {
  PATH_REQUIRED: "ingestion-watcher-path-required",
  TENANT_REQUIRED: "ingestion-watcher-tenant-required",
  ALREADY_RUNNING: "ingestion-watcher-already-running",
  NOT_RUNNING: "ingestion-watcher-not-running",
} as const;

export interface LocalFolderWatcherOptions {
  /** Stable file events emitted after debounce. */
  readonly debounceMs?: number;
  /** Polling interval for the initial directory scan (in ms). */
  readonly scanIntervalMs?: number;
}

export interface WatcherFileEvent {
  readonly sourcePath: string;
  readonly sourceName: string;
  readonly event: "add" | "change";
  readonly detectedAt: string;
}

export type WatcherHandler = (event: WatcherFileEvent) => void | Promise<void>;

const TRANSIENT_SUFFIXES = [".tmp", ".partial", ".crdownload", ".swp", ".swx"];
const TEMP_PREFIXES = ["~$", ".#"];
const HIDDEN_PREFIX = ".";

function isTransient(sourceName: string): boolean {
  const lower = sourceName.toLowerCase();
  if (lower.startsWith(HIDDEN_PREFIX)) return true;
  if (TEMP_PREFIXES.some((p) => lower.startsWith(p))) return true;
  if (TRANSIENT_SUFFIXES.some((suf) => lower.endsWith(suf))) return true;
  return false;
}

export class LocalFolderWatcher {
  private readonly tenantId: string;
  private readonly folder: string;
  private readonly adapter: FinancialDataIngestionAdapter;
  private readonly debounceMs: number;
  private readonly scanIntervalMs: number;
  private readonly handler: WatcherHandler;
  private watcher: FSWatcher | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private knownFiles: Set<string> = new Set();
  private running = false;

  constructor(params: {
    readonly tenantId: string;
    readonly folder: string;
    readonly adapter: FinancialDataIngestionAdapter;
    readonly handler: WatcherHandler;
    readonly options?: LocalFolderWatcherOptions;
  }) {
    if (!params.tenantId?.trim()) throw new Error(WATCHER_ERROR_CODES.TENANT_REQUIRED);
    if (!params.folder?.trim()) throw new Error(WATCHER_ERROR_CODES.PATH_REQUIRED);
    if (typeof params.handler !== "function") {
      throw new Error("ingestion-watcher-handler-required");
    }
    this.tenantId = params.tenantId.trim();
    this.folder = resolve(params.folder);
    this.adapter = params.adapter;
    this.handler = params.handler;
    this.debounceMs = params.options?.debounceMs ?? 250;
    this.scanIntervalMs = params.options?.scanIntervalMs ?? 2000;
  }

  get isRunning(): boolean { return this.running; }

  async start(): Promise<void> {
    if (this.running) throw new Error(WATCHER_ERROR_CODES.ALREADY_RUNNING);
    const stat = await fs.stat(this.folder);
    if (!stat.isDirectory()) throw new Error("ingestion-watcher-not-a-directory");

    // Initial population
    const initial = await fs.readdir(this.folder);
    for (const name of initial) {
      if (isTransient(name)) continue;
      this.knownFiles.add(name);
    }

    this.watcher = watch(this.folder, { persistent: false }, (_event, filename) => {
      if (typeof filename !== "string") return;
      if (isTransient(filename)) return;
      this.scheduleEmit(filename);
    });

    // Fallback poll: fs.watch on some FSes (notably network shares) can
    // miss events. A periodic readdir diff catches them.
    this.pollTimer = setInterval(() => { void this.pollOnce(); }, this.scanIntervalMs);
    this.pollTimer.unref?.();
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) throw new Error(WATCHER_ERROR_CODES.NOT_RUNNING);
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const t of this.debounceTimers.values()) clearTimeout(t);
    this.debounceTimers.clear();
    this.running = false;
  }

  private scheduleEmit(filename: string): void {
    const existing = this.debounceTimers.get(filename);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      this.debounceTimers.delete(filename);
      const wasKnown = this.knownFiles.has(filename);
      this.knownFiles.add(filename);
      const event: WatcherFileEvent = {
        sourcePath: join(this.folder, filename),
        sourceName: basename(filename),
        event: wasKnown ? "change" : "add",
        detectedAt: new Date().toISOString(),
      };
      void this.handler(event);
    }, this.debounceMs);
    this.debounceTimers.set(filename, t);
  }

  private async pollOnce(): Promise<void> {
    let names: string[];
    try {
      names = await fs.readdir(this.folder);
    } catch {
      return; // folder may be temporarily unavailable
    }
    const present = new Set(names.filter((n) => !isTransient(n)));
    for (const name of present) {
      if (!this.knownFiles.has(name)) this.scheduleEmit(name);
    }
    // Forget removed files so re-add later re-emits as "add".
    for (const name of [...this.knownFiles]) {
      if (!present.has(name)) this.knownFiles.delete(name);
    }
  }

  /** Manually trigger an ingest via the adapter. Used by tests and by
   *  the watcher handler when an event is emitted. NOT auto-called. */
  async ingest(sourcePath: string): Promise<unknown> {
    return this.adapter.ingestFile(this.tenantId, sourcePath);
  }
}