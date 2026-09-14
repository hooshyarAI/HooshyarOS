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
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.HooshyarOfflineSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const QUEUE_KEY = "hooshyar.offline.ingest.queue.v1";
  const MUTATING_URL = "/api/ingest";
  const STATE_URL = "/api/sync/state";

  function memoryStorage() {
    const map = new Map();
    return {
      getItem: key => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => { map.set(key, String(value)); },
      removeItem: key => { map.delete(key); },
    };
  }

  function defaultStorage() {
    try {
      if (typeof localStorage !== "undefined" && localStorage) return localStorage;
    } catch {
      /* storage can be blocked by the browser; fall through to memory */
    }
    return memoryStorage();
  }

  function transientStatus(status) {
    return status === 401 || status === 403 || status === 409 || status === 429 || status >= 500;
  }

  function createOfflineSync(options) {
    options = options || {};
    const storage = options.storage || defaultStorage();
    const fetchImpl = options.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    const now = options.now || (() => Date.now());
    if (!fetchImpl) throw new Error("offline-sync-fetch-required");

    function readQueue() {
      try {
        const raw = storage.getItem(QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function writeQueue(jobs) {
      storage.setItem(QUEUE_KEY, JSON.stringify(jobs));
      return jobs;
    }

    function generateKey() {
      const random = Math.random().toString(16).slice(2);
      return `offline-${now()}-${random}`;
    }

    function enqueue(job) {
      const entry = {
        id: generateKey(),
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
      const jobs = readQueue();
      jobs.push(entry);
      writeQueue(jobs);
      return entry;
    }

    function pending() {
      return readQueue();
    }

    async function serverState(sourceKey) {
      const url = sourceKey ? `${STATE_URL}?source=${encodeURIComponent(sourceKey)}` : STATE_URL;
      const response = await fetchImpl(url, { method: "GET", credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload && payload.error ? payload.error : `HTTP_${response.status}`);
      return payload;
    }

    async function replay(job) {
      const response = await fetchImpl(MUTATING_URL, {
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
      const payload = await response.json();
      return { response, payload };
    }

    async function sync() {
      const report = { status: "IDLE", attempted: 0, synced: [], conflicts: [], rejected: [], pending: 0 };
      let jobs = readQueue();
      if (!jobs.length) return report;

      report.status = "ONLINE";
      const remaining = [];
      for (const job of jobs) {
        report.attempted += 1;
        job.attempts += 1;
        try {
          const before = await serverState(job.sourceName);
          const previousWatermark = before && before.cursor ? before.cursor.lastWatermark : null;
          const { response, payload } = await replay(job);

          if (!response.ok) {
            if (transientStatus(response.status)) {
              job.status = "PENDING";
              job.lastError = payload && payload.error ? payload.error : `HTTP_${response.status}`;
              remaining.push(job);
              continue;
            }
            job.status = "REJECTED";
            job.lastError = payload && payload.error ? payload.error : `HTTP_${response.status}`;
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
        } catch (error) {
          job.status = "PENDING";
          job.lastError = error && error.message ? error.message : "OFFLINE";
          remaining.push(job);
          report.status = "OFFLINE";
        }
      }

      writeQueue(remaining);
      report.pending = remaining.length;
      return report;
    }

    return { enqueue, pending, sync, serverState, QUEUE_KEY };
  }

  return { createOfflineSync, QUEUE_KEY, memoryStorage };
});
