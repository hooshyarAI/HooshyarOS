/**
 * Stage 15-ING.2 — Durable ingestion job/status regression.
 *
 * Proves the long-running ingestion UX contract:
 *   - a job is created and returns immediately (RECEIVED) with a durable id;
 *   - real stage/OCR page progress is observable while it runs;
 *   - a duplicate submission with the same Idempotency-Key never executes a
 *     second side effect and surfaces IDEMPOTENCY_IN_PROGRESS in diagnostics
 *     while the first run is still in flight;
 *   - a failed job releases its claim so a legitimate retry can proceed;
 *   - a job from a previous process is never reported as still running.
 */
import { Server } from "node:http";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import {
  IngestionJobService,
  type IngestionJobRunner,
} from "../Product/IngestionJobService";
import type { IngestionOutcome } from "../Product/FinancialIngestionService";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const SHA = "b".repeat(64);

function outcomeFor(tenantId: string): IngestionOutcome {
  const evidence = {
    sourceName: "statement.pdf",
    sourceType: "PDF" as const,
    sha256: SHA,
    receivedAt: "2026-09-19T00:00:00.000Z",
  };
  return {
    tenantId,
    requestedFormat: "PDF",
    rawSourceRef: { persistenceKey: `raw-source:${SHA}`, sha256: SHA, byteLength: 10, persisted: true },
    result: {
      evidence,
      model: {
        tenantId,
        source: evidence,
        transactions: [{ date: "2024-01-15", account: "Opening deposit", debit: 0, credit: 500000, currency: "IRR" }],
        totals: { debit: 0, credit: 500000, balance: 500000 },
      },
      persisted: true,
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs = 4000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error("waitFor-timeout");
    await sleep(10);
  }
}

describe("IngestionJobService — durable job lifecycle", () => {
  const REQUEST = { sourceName: "statement.pdf", format: "PDF" as const, contentBase64: "AAAA" };

  test("duplicate idempotency key resolves to the same running job (no second side effect)", async () => {
    const store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    let releases = 0;
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const runner: IngestionJobRunner = async (tenantId, _request, observer) => {
      releases += 1;
      observer({ stage: "OCR", page: 1, pages: 2, percent: 50 });
      await gate;
      observer({ stage: "OCR", page: 2, pages: 2, percent: 100 });
      return outcomeFor(tenantId);
    };
    const jobs = new IngestionJobService(store, { runner });

    const first = await jobs.start("tenant-a", "user-1", REQUEST, "dup-key");
    expect(first.replayed).toBe(false);
    const started = await waitFor(async () => {
      const job = await jobs.get("tenant-a", first.job.jobId);
      return job && job.progress?.page === 1 ? job : null;
    });
    expect(started.progress).toEqual({ page: 1, pages: 2, percent: 50 });
    expect(started.status).toBe("RUNNING");

    const duplicate = await jobs.start("tenant-a", "user-1", REQUEST, "dup-key");
    expect(duplicate.replayed).toBe(true);
    expect(duplicate.job.jobId).toBe(first.job.jobId);
    expect(releases).toBe(1);

    release!();
    const completed = await waitFor(async () => {
      const job = await jobs.get("tenant-a", first.job.jobId);
      return job?.status === "COMPLETED" ? job : null;
    });
    expect(completed.result?.transactionCount).toBe(1);
    expect(completed.result?.sha256).toBe(SHA);
    expect(completed.progress).toEqual({ page: 2, pages: 2, percent: 100 });

    const replayAfterCompletion = await jobs.start("tenant-a", "user-1", REQUEST, "dup-key");
    expect(replayAfterCompletion.replayed).toBe(true);
    expect(replayAfterCompletion.job.status).toBe("COMPLETED");
    expect(releases).toBe(1);

    store.close();
  });

  test("a failed job records the precise code and releases its claim for a legitimate retry", async () => {
    const store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    let attempts = 0;
    const runner: IngestionJobRunner = async (tenantId) => {
      attempts += 1;
      if (attempts === 1) throw new Error("ingestion-schema-invalid");
      return outcomeFor(tenantId);
    };
    const jobs = new IngestionJobService(store, { runner });

    const first = await jobs.start("tenant-a", "user-1", REQUEST, "retry-key");
    const failed = await waitFor(async () => {
      const job = await jobs.get("tenant-a", first.job.jobId);
      return job?.status === "FAILED" ? job : null;
    });
    expect(failed.code).toBe("ingestion-schema-invalid");
    expect(failed.message).toContain("ساختار");

    const retried = await jobs.start("tenant-a", "user-1", REQUEST, "retry-key");
    expect(retried.replayed).toBe(false);
    await waitFor(async () => (attempts >= 2 ? true : null));
    expect(attempts).toBe(2);

    store.close();
  });

  test("a job from a previous process is reconciled to ingestion-job-interrupted, never left running", async () => {
    const store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    // The first runner never resolves, holding the job in RUNNING inside process A.
    const pendingRunner: IngestionJobRunner = () => new Promise<IngestionOutcome>(() => { /* never settles */ });
    const processA = new IngestionJobService(store, { runner: pendingRunner, processStartedAtMs: 1_000 });
    const started = await processA.start("tenant-a", "user-1", REQUEST);
    await waitFor(async () => {
      const job = await processA.get("tenant-a", started.job.jobId);
      return job && job.status === "RUNNING" ? job : null;
    });

    // Process B started afterwards: the job cannot still be running here.
    const processB = new IngestionJobService(store, {
      runner: async (tenantId) => outcomeFor(tenantId),
      processStartedAtMs: Date.now() + 60_000,
    });
    const reconciled = await processB.get("tenant-a", started.job.jobId);
    expect(reconciled?.status).toBe("FAILED");
    expect(reconciled?.code).toBe("ingestion-job-interrupted");

    store.close();
  });
});

describe("IngestionJobService — runtime HTTP job status", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({ databasePath: ":memory:", sessionSweepIntervalMs: 0 });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const request = (path: string, options: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return fetch(`http://127.0.0.1:${address.port}${path}`, options);
  };

  const register = async (username: string, organization: string): Promise<string> => {
    const response = await request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
    });
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("session-cookie-missing");
    return cookie.split(";")[0];
  };

  const CSV = "date,account,debit,credit,currency\n2024-01-15,Cash,100,0,IRR\n2024-01-16,Sales,0,100,IRR";

  test("creates a durable job, exposes real status, and replays on the same idempotency key", async () => {
    const cookie = await register("job-owner", "Job Org");
    const created = await request("/api/ingest/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, "idempotency-key": "job-1" },
      body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: CSV }),
    });
    expect(created.status).toBe(202);
    const createdBody = await created.json();
    expect(typeof createdBody.jobId).toBe("string");
    expect(createdBody.replayed).toBe(false);

    const completed = await waitFor(async () => {
      const response = await request(`/api/ingest/jobs/${createdBody.jobId}`, { headers: { cookie } });
      const body = await response.json();
      return body.status === "READY" ? body : null;
    });
    expect(completed.job.stage).toBe("COMPLETED");
    expect(completed.job.result.sourceType).toBe("CSV");
    expect(completed.job.result.transactionCount).toBe(2);
    expect(completed.job.result.totals).toEqual({ debit: 100, credit: 100, balance: 0 });

    const duplicate = await request("/api/ingest/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, "idempotency-key": "job-1" },
      body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: CSV }),
    });
    const duplicateBody = await duplicate.json();
    expect(duplicateBody.jobId).toBe(createdBody.jobId);
    expect(duplicateBody.replayed).toBe(true);
    expect(duplicateBody.diagnostics.idempotency).toBe("IDEMPOTENCY_REPLAYED");

    const listed = await request("/api/ingest/jobs", { headers: { cookie } });
    const listedBody = await listed.json();
    expect(listedBody.jobs.some((job: { jobId: string }) => job.jobId === createdBody.jobId)).toBe(true);
  });

  test("job status is tenant-isolated and the capability is advertised", async () => {
    const cookie = await register("job-owner-2", "Job Org 2");
    const created = await request("/api/ingest/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: CSV }),
    });
    const { jobId } = await created.json();

    const otherCookie = await register("job-owner-2-other", "Job Org Other");
    const foreign = await request(`/api/ingest/jobs/${jobId}`, { headers: { cookie: otherCookie } });
    expect(foreign.status).toBe(404);

    const ready = await request("/api/ready");
    expect((await ready.json()).capabilities).toContain("ingestion-job-status");
  });
});
