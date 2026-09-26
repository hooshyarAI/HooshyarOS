/**
 * HooshyarOS — Layer 11 offline/online client transport.
 *
 * Durable pending-work queue for the product web client. Work captured while
 * the network is unavailable is persisted BEFORE any request is attempted and
 * is only removed from the queue after the canonical runtime accepts it, so
 * network loss can never discard work.
 *
 * The canonical sync-cursor authority remains `Backend/HBOS/Product/SyncStateStore`
 * (server side, reached through `GET /api/sync/state`). This module is a thin
 * client transport, NOT a second sync store and NOT a new Engine: it only
 * queues, replays idempotently and reconciles against the server cursor.
 *
 * Failure classification (K8 commercial-acceptance repair):
 *   Only genuine connectivity/offline failures may enter the offline queue.
 *   HTTP 4xx/5xx, authentication, authorization, validation and storage
 *   failures are surfaced to the caller and NEVER silently reclassified as
 *   OFFLINE. A generic `TypeError` is not evidence of connectivity: network
 *   errors are tagged at the fetch call site.
 *
 * Storage (K8 commercial-acceptance repair):
 *   Real financial uploads can be many megabytes. The queue therefore uses
 *   IndexedDB when available (binary-safe, large quota) and only falls back to
 *   localStorage when IndexedDB is unavailable. Persistence is bounded and
 *   quota failures are typed (`STORAGE_QUOTA_FAILURE`) and surfaced, never
 *   swallowed and never allowed to masquerade as an offline transition.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.HooshyarOfflineSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const QUEUE_KEY = "hooshyar.offline.ingest.queue.v1";
  const IDB_NAME = "hooshyar-offline-sync";
  const IDB_STORE = "queue";
  const MUTATING_URL = "/api/ingest";
  const STATE_URL = "/api/sync/state";
  /** Bounded queue: at most this many queued jobs. */
  const DEFAULT_MAX_JOBS = 50;
  /** Bounded job size: the canonical runtime rejects bodies above 8 MiB. */
  const DEFAULT_MAX_JOB_BYTES = 24 * 1024 * 1024;

  const FAILURE_KINDS = {
    NETWORK_FAILURE: "NETWORK_FAILURE",
    OFFLINE: "OFFLINE",
    HTTP_4XX: "HTTP_4XX",
    HTTP_5XX: "HTTP_5XX",
    AUTHENTICATION_FAILURE: "AUTHENTICATION_FAILURE",
    AUTHORIZATION_FAILURE: "AUTHORIZATION_FAILURE",
    VALIDATION_FAILURE: "VALIDATION_FAILURE",
    APPLICATION_FAILURE: "APPLICATION_FAILURE",
    STORAGE_QUOTA_FAILURE: "STORAGE_QUOTA_FAILURE",
    STORAGE_FAILURE: "STORAGE_FAILURE",
    FILE_REPRESENTATION_FAILURE: "FILE_REPRESENTATION_FAILURE",
  };

  const FORMAT_BY_EXTENSION = {
    csv: "CSV",
    json: "STRUCTURED",
    txt: "TXT",
    xlsx: "XLSX",
    xls: "XLS",
    pdf: "PDF",
    docx: "DOCX",
    png: "IMAGE",
    jpg: "IMAGE",
    jpeg: "IMAGE",
  };

  // Formats whose canonical runtime representation is binary (`contentBase64`)
  // rather than text (`content`).
  const BINARY_FORMATS = new Set(["XLSX", "XLS", "PDF", "DOCX", "IMAGE"]);

  function typedError(message, kind, extra) {
    const error = new Error(message);
    error.kind = kind;
    if (extra) Object.assign(error, extra);
    return error;
  }

  /** Canonical format identifier for a source name, or null when unknown. */
  function formatFromSourceName(name) {
    const parts = String(name || "").toLowerCase().split(".");
    if (parts.length < 2) return null;
    const ext = parts.pop();
    return FORMAT_BY_EXTENSION[ext] || null;
  }

  function isBinaryFormat(format) {
    return BINARY_FORMATS.has(String(format || "").toUpperCase());
  }

  /** Classify an HTTP status into a precise failure kind. */
  function classifyHttpStatus(status) {
    const value = Number(status);
    if (value === 401) return FAILURE_KINDS.AUTHENTICATION_FAILURE;
    if (value === 403) return FAILURE_KINDS.AUTHORIZATION_FAILURE;
    if (value >= 500) return FAILURE_KINDS.HTTP_5XX;
    if (value === 400 || value === 413 || value === 415 || value === 422) return FAILURE_KINDS.VALIDATION_FAILURE;
    if (value === 404 || value === 409 || value === 429) return FAILURE_KINDS.APPLICATION_FAILURE;
    if (value >= 400) return FAILURE_KINDS.HTTP_4XX;
    return FAILURE_KINDS.APPLICATION_FAILURE;
  }

  function isQuotaError(error) {
    if (!error) return false;
    const name = String(error.name || "");
    const code = error.code;
    const message = String(error.message || "").toLowerCase();
    return name === "QuotaExceededError" || code === 22 || code === 1014 || message.includes("quota");
  }

  /**
   * Classify a thrown value into exactly one failure kind.
   *
   * `error.kind` (set at a call site that knows the origin, e.g. fetch vs file
   * read vs storage) always wins. A bare `TypeError` is deliberately NOT
   * treated as connectivity.
   */
  function classifyFailure(error, navigatorLike) {
    if (error && typeof error === "object" && typeof error.kind === "string" && FAILURE_KINDS[error.kind]) {
      return error.kind;
    }
    if (isQuotaError(error)) return FAILURE_KINDS.STORAGE_QUOTA_FAILURE;
    const nav = navigatorLike || (typeof navigator !== "undefined" ? navigator : undefined);
    if (nav && nav.onLine === false) return FAILURE_KINDS.OFFLINE;
    if (error && typeof error.status === "number") return classifyHttpStatus(error.status);
    const name = error && typeof error.name === "string" ? error.name : "";
    if (name === "InvalidStateError" || name === "UnknownError" || name === "DataCloneError" || name === "NotSupportedError") {
      return FAILURE_KINDS.STORAGE_FAILURE;
    }
    if (name === "AbortError" || name === "TimeoutError") return FAILURE_KINDS.NETWORK_FAILURE;
    return FAILURE_KINDS.APPLICATION_FAILURE;
  }

  /** True only for genuine connectivity/offline failures. */
  function isConnectivityFailure(errorOrKind, navigatorLike) {
    const kind = typeof errorOrKind === "string" ? errorOrKind : classifyFailure(errorOrKind, navigatorLike);
    return kind === FAILURE_KINDS.NETWORK_FAILURE || kind === FAILURE_KINDS.OFFLINE;
  }

  /** Wrap a fetch rejection so it is unambiguously a connectivity failure. */
  function networkError(error) {
    const cause = error && error.message ? error.message : "network-request-failed";
    return typedError(`offline-network-failure:${cause}`, FAILURE_KINDS.NETWORK_FAILURE, { cause: error });
  }

  function memoryStorage() {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        map.set(key, String(value));
      },
      removeItem: (key) => {
        map.delete(key);
      },
    };
  }

  function localStorageQueue(storage) {
    return {
      async load() {
        const raw = storage.getItem(QUEUE_KEY);
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      },
      async save(jobs) {
        storage.setItem(QUEUE_KEY, JSON.stringify(jobs));
      },
    };
  }

  function memoryQueueStore() {
    return localStorageQueue(memoryStorage());
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || typedError("indexeddb-request-failed", FAILURE_KINDS.STORAGE_FAILURE));
    });
  }

  function indexedDbQueue(indexedDb) {
    let dbPromise = null;
    function open() {
      if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
          const request = indexedDb.open(IDB_NAME, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || typedError("indexeddb-open-failed", FAILURE_KINDS.STORAGE_FAILURE));
        });
      }
      return dbPromise;
    }
    return {
      async load() {
        const db = await open();
        return requestToPromise(
          db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(QUEUE_KEY),
        ).then((value) => {
          if (!value) return [];
          try {
            const parsed = typeof value === "string" ? JSON.parse(value) : value;
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        });
      },
      async save(jobs) {
        const db = await open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).put(JSON.stringify(jobs), QUEUE_KEY);
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error || typedError("indexeddb-write-aborted", FAILURE_KINDS.STORAGE_FAILURE));
          tx.onerror = () => reject(tx.error || typedError("indexeddb-write-failed", FAILURE_KINDS.STORAGE_FAILURE));
        });
      },
    };
  }

  /** Resolve the single canonical durable queue store. */
  function resolveQueueStore(storage, indexedDbLike) {
    if (storage && typeof storage.load === "function" && typeof storage.save === "function") return storage;
    if (storage) return localStorageQueue(storage);
    const idb = indexedDbLike || (typeof indexedDB !== "undefined" ? indexedDB : undefined);
    if (idb) {
      try {
        return indexedDbQueue(idb);
      } catch {
        /* fall through to localStorage */
      }
    }
    try {
      if (typeof localStorage !== "undefined" && localStorage) return localStorageQueue(localStorage);
    } catch {
      /* storage can be blocked by the browser; fall through to memory */
    }
    return memoryQueueStore();
  }

  function transientStatus(status) {
    return status === 401 || status === 403 || status === 409 || status === 429 || status >= 500;
  }

  /**
   * Canonical, human-readable Persian ingestion stage labels. The technical
   * stage code stays available for diagnostics; the label is the primary
   * user-facing message.
   */
  const INGEST_STAGE_LABELS_FA = {
    RECEIVED: "دریافت شد",
    VALIDATING: "در حال اعتبارسنجی ورودی",
    READING_FILE: "در حال خواندن فایل",
    READING_PDF: "در حال خواندن فایل PDF",
    SCANNED_DETECTED: "فایل اسکن‌شده شناسایی شد؛ آماده‌سازی تشخیص متن",
    OCR: "در حال تشخیص متن تصویر (OCR)",
    DOCUMENT_DETECTION: "در حال تشخیص نوع سند",
    SECTION_DETECTION: "در حال تشخیص بخش‌های گزارش",
    SECTION_AUDITOR_REPORT: "گزارش حسابرس",
    SECTION_BOARD_REPORT: "گزارش هیئت‌مدیره",
    SECTION_BALANCE_SHEET: "صورت وضعیت مالی",
    SECTION_INCOME_STATEMENT: "سود و زیان",
    SECTION_CASH_FLOW: "جریان وجوه نقد",
    SECTION_CHANGES_IN_EQUITY: "حقوق مالکانه",
    SECTION_NOTES: "یادداشت‌ها",
    NORMALIZING: "در حال نرمال‌سازی ساختار سند",
    EVIDENCE_VALIDATION: "در حال اعتبارسنجی شواهد",
    CANONICAL_VALIDATION: "در حال اعتبارسنجی مدل مالی کانونی",
    PERSISTING: "در حال ذخیره‌سازی نتیجه",
    COMPLETED: "تکمیل شد",
    FAILED: "پردازش ناموفق بود",
  };

  function ingestStageLabelFa(stage) {
    return INGEST_STAGE_LABELS_FA[stage] || String(stage || "");
  }

  /**
   * Describe a durable ingestion job for display. Progress is truthful: a
   * percentage is only returned for real OCR page progress, otherwise null
   * (never a timer-based fake). `elapsedSeconds` is derived from real
   * timestamps.
   */
  function describeIngestProgress(job, nowMs) {
    const current = job || {};
    const stage = current.stage || "RECEIVED";
    const progress = current.progress || null;
    const isOcr = stage === "OCR";
    const percent = isOcr && progress && typeof progress.percent === "number" ? progress.percent : null;
    const page = isOcr && progress && typeof progress.page === "number" ? progress.page : null;
    const pages = isOcr && progress && typeof progress.pages === "number" ? progress.pages : null;
    let message = current.message || ingestStageLabelFa(stage);
    if (page !== null && pages !== null) message = `${message} — صفحه ${page} از ${pages}`;
    const from = Date.parse(current.receivedAt || "");
    const to = current.completedAt ? Date.parse(current.completedAt) : Number(nowMs);
    const elapsedSeconds = Number.isFinite(from) && Number.isFinite(to) ? Math.max(0, Math.round((to - from) / 1000)) : null;
    return {
      stage,
      stageLabel: ingestStageLabelFa(stage),
      message,
      percent,
      page,
      pages,
      elapsedSeconds,
      terminal: stage === "COMPLETED" || stage === "FAILED",
    };
  }

  function createOfflineSync(options) {
    options = options || {};
    const queueStore = resolveQueueStore(options.storage, options.indexedDB);
    const fetchImpl = options.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    const now = options.now || (() => Date.now());
    const maxJobs = Number.isInteger(options.maxJobs) && options.maxJobs > 0 ? options.maxJobs : DEFAULT_MAX_JOBS;
    const maxJobBytes = Number.isInteger(options.maxJobBytes) && options.maxJobBytes > 0 ? options.maxJobBytes : DEFAULT_MAX_JOB_BYTES;
    if (!fetchImpl) throw new Error("offline-sync-fetch-required");

    async function readQueue() {
      try {
        return await queueStore.load();
      } catch {
        return [];
      }
    }

    async function writeQueue(jobs) {
      await queueStore.save(jobs);
      return jobs;
    }

    function generateKey() {
      const random = Math.random().toString(16).slice(2);
      return `offline-${now()}-${random}`;
    }

    function buildEntry(job) {
      return {
        id: job.id || generateKey(),
        sourceName: job.sourceName,
        format: job.format,
        content: job.content,
        contentBase64: job.contentBase64,
        baseWatermark: job.baseWatermark || null,
        idempotencyKey: job.idempotencyKey || generateKey(),
        createdAt: new Date(now()).toISOString(),
        attempts: 0,
        status: "PENDING",
        lastError: null,
      };
    }

    /**
     * Durable, bounded enqueue. Persists before returning. On a quota or other
     * storage failure it throws a typed error and leaves the existing queue
     * intact so no previously captured work is lost.
     */
    async function enqueue(job) {
      const entry = buildEntry(job);
      const serialized = JSON.stringify(entry);
      if (serialized.length > maxJobBytes) {
        throw typedError(
          `offline-queue-job-too-large:${serialized.length}`,
          FAILURE_KINDS.STORAGE_QUOTA_FAILURE,
          { byteLength: serialized.length, limit: maxJobBytes },
        );
      }
      const jobs = await readQueue();
      if (jobs.length >= maxJobs) {
        throw typedError("offline-queue-capacity-exceeded", FAILURE_KINDS.STORAGE_FAILURE, { limit: maxJobs });
      }
      jobs.push(entry);
      try {
        await writeQueue(jobs);
      } catch (error) {
        if (isQuotaError(error)) {
          throw typedError("offline-queue-quota-exceeded", FAILURE_KINDS.STORAGE_QUOTA_FAILURE, { cause: error });
        }
        throw typedError(
          `offline-queue-persist-failed:${error && error.message ? error.message : "unknown"}`,
          FAILURE_KINDS.STORAGE_FAILURE,
          { cause: error },
        );
      }
      return entry;
    }

    async function pending() {
      return readQueue();
    }

    async function serverState(sourceKey) {
      const url = sourceKey ? `${STATE_URL}?source=${encodeURIComponent(sourceKey)}` : STATE_URL;
      let response;
      try {
        response = await fetchImpl(url, { method: "GET", credentials: "same-origin" });
      } catch (error) {
        throw networkError(error);
      }
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      if (!response.ok) {
        throw typedError(payload && payload.error ? payload.error : `HTTP_${response.status}`, classifyHttpStatus(response.status), { status: response.status });
      }
      return payload;
    }

    async function replay(job) {
      let response;
      try {
        response = await fetchImpl(MUTATING_URL, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "idempotency-key": job.idempotencyKey },
          body: JSON.stringify({
            sourceName: job.sourceName,
            format: job.format,
            content: job.content,
            contentBase64: job.contentBase64,
          }),
        });
      } catch (error) {
        throw networkError(error);
      }
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      return { response, payload };
    }

    async function sync() {
      const report = { status: "IDLE", attempted: 0, synced: [], conflicts: [], rejected: [], pending: 0 };
      const jobs = await readQueue();
      if (!jobs.length) return report;

      report.status = "ONLINE";
      const remaining = [];
      for (const job of jobs) {
        report.attempted += 1;
        job.attempts += 1;

        let previousWatermark = null;
        try {
          const before = await serverState(job.sourceName);
          previousWatermark = before && before.cursor ? before.cursor.lastWatermark : null;
        } catch {
          /* server cursor is a reconciliation aid, never a hard requirement */
        }

        let response;
        let payload;
        try {
          ({ response, payload } = await replay(job));
        } catch (error) {
          const kind = classifyFailure(error);
          job.status = "PENDING";
          job.lastError = error && error.message ? error.message : "OFFLINE";
          remaining.push(job);
          report.status = isConnectivityFailure(kind) ? "OFFLINE" : kind;
          continue;
        }

        if (!response.ok) {
          const kind = classifyHttpStatus(response.status);
          job.lastError = payload && payload.error ? payload.error : `HTTP_${response.status}`;
          if (transientStatus(response.status)) {
            job.status = "PENDING";
            remaining.push(job);
            report.status = kind;
            continue;
          }
          job.status = "REJECTED";
          report.rejected.push({ id: job.id, sourceKey: job.sourceName, error: job.lastError });
          continue;
        }

        const watermark = payload && payload.source ? payload.source.sha256 : null;
        const replayed = response.headers && typeof response.headers.get === "function"
          ? response.headers.get("Idempotency-Replayed") === "true"
          : false;

        if (job.baseWatermark && previousWatermark && previousWatermark !== job.baseWatermark && previousWatermark !== watermark) {
          report.conflicts.push({
            id: job.id,
            sourceKey: job.sourceName,
            baseWatermark: job.baseWatermark,
            serverWatermark: previousWatermark,
            resolvedWatermark: watermark,
            resolution: "server-authoritative",
          });
        }

        report.synced.push({ id: job.id, sourceKey: job.sourceName, watermark, replayed });
      }

      try {
        await writeQueue(remaining);
      } catch (error) {
        // The canonical queue still holds the last persisted snapshot, so no
        // captured work is lost; report the storage failure honestly.
        report.status = isQuotaError(error) ? FAILURE_KINDS.STORAGE_QUOTA_FAILURE : FAILURE_KINDS.STORAGE_FAILURE;
        report.storageError = error && error.message ? error.message : "queue-persist-failed";
      }
      report.pending = remaining.length;
      return report;
    }

    return { enqueue, pending, sync, serverState, QUEUE_KEY, maxJobs, maxJobBytes };
  }

  return {
    createOfflineSync,
    resolveQueueStore,
    QUEUE_KEY,
    IDB_NAME,
    IDB_STORE,
    DEFAULT_MAX_JOBS,
    DEFAULT_MAX_JOB_BYTES,
    FAILURE_KINDS,
    FORMAT_BY_EXTENSION,
    INGEST_STAGE_LABELS_FA,
    ingestStageLabelFa,
    describeIngestProgress,
    memoryStorage,
    memoryQueueStore,
    localStorageQueue,
    indexedDbQueue,
    formatFromSourceName,
    isBinaryFormat,
    classifyHttpStatus,
    classifyFailure,
    isConnectivityFailure,
    isQuotaError,
    networkError,
    typedError,
  };
});
