/**
 * K8 — Commercial acceptance barrier.
 *
 * Focused deterministic coverage for the real customer-journey failure chain
 * found in the installed product:
 *
 *   binary PDF selected -> misread as CSV text -> server rejects/reset ->
 *   client classified the exception as OFFLINE -> the whole file was pushed
 *   into the localStorage offline queue -> browser storage quota exceeded.
 *
 * The barrier asserts, against the real commercial runtime and the real web
 * client transport module:
 *   - PDF is a deliberately unsupported ingestion format and fails closed with
 *     a precise capability error (never as CSV, never as offline);
 *   - binary formats use the canonical `contentBase64` representation;
 *   - only genuine connectivity failures enter the offline queue;
 *   - storage quota failures are surfaced, never reclassified as offline;
 *   - unauthenticated and cross-tenant access still fails closed.
 */
import fs from "node:fs";
import { Server } from "node:http";
import path from "node:path";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const {
  createOfflineSync,
  memoryStorage,
  classifyFailure,
  isConnectivityFailure,
  classifyHttpStatus,
  FAILURE_KINDS,
} = require("../../../web/offline-sync.js");

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";

interface Acceptance {
  readonly server: Server;
  readonly base: string;
  readonly cookie: string;
  readonly tenantId: string;
}

const listen = (server: Server) => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

const cookieFrom = (response: Response): string => {
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("session-cookie-missing");
  return cookie.split(";")[0];
};

let sessionCounter = 0;
async function bootstrap(server: Server): Promise<Acceptance> {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server-not-listening");
  const base = `http://127.0.0.1:${address.port}`;
  sessionCounter += 1;
  const session = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: `barrier-${sessionCounter}`, organization: `Barrier Org ${sessionCounter}` }),
  });
  expect(session.status).toBe(201);
  const body = (await session.json()) as { tenantId: string };
  return { server, base, cookie: cookieFrom(session), tenantId: body.tenantId };
}

const ingest = (acceptance: Acceptance, body: Record<string, unknown>, cookie = acceptance.cookie) =>
  fetch(`${acceptance.base}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });

describe("commercial acceptance barrier — runtime ingestion (K8)", () => {
  let server: Server;
  let acceptance: Acceptance;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({ databasePath: ":memory:" });
    await listen(server);
    acceptance = await bootstrap(server);
  });

  afterEach(async () => {
    await close(server);
  });

  test("an authenticated PDF upload fails closed with a precise unsupported-format error", async () => {
    const pdfBytes = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "latin1");
    const response = await ingest(acceptance, {
      sourceName: "statement.pdf",
      format: "PDF",
      contentBase64: pdfBytes.toString("base64"),
    });
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("INGEST_FORMAT_UNSUPPORTED");
  });

  test("the client representation for PDF uses the correct identifier and base64 bytes, not CSV text", () => {
    const client = require("../../../web/offline-sync.js");
    expect(client.formatFromSourceName("statement.pdf")).toBe("PDF");
    expect(client.isBinaryFormat("PDF")).toBe(true);
    // A PDF must never be presented to the canonical runtime as CSV text.
    expect(client.formatFromSourceName("statement.pdf")).not.toBe("CSV");
  });

  test("a binary XLSX upload uses contentBase64 and reaches real analysis metrics", async () => {
    const ExcelJS = require("exceljs-hardened");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transactions");
    worksheet.addRow(["date", "account", "debit", "credit", "currency"]);
    worksheet.addRow(["2026-08-05", "Cash", 500, 0, "IRR"]);
    worksheet.addRow(["2026-08-05", "Sales", 0, 1000, "IRR"]);
    const contentBase64 = Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");

    const accepted = await ingest(acceptance, { sourceName: "ledger.xlsx", format: "XLSX", contentBase64 });
    expect(accepted.status).toBe(201);
    const acceptedBody = (await accepted.json()) as { evidence: { sha256: string; sourceType: string }; totals: { debit: number; credit: number } };
    expect(acceptedBody.evidence.sourceType).toBe("XLSX");
    expect(acceptedBody.totals.debit).toBe(500);
    expect(acceptedBody.totals.credit).toBe(1000);

    const analysis = await fetch(`${acceptance.base}/api/financial/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: acceptance.cookie },
      body: JSON.stringify({ sourceSha256: acceptedBody.evidence.sha256, assets: 10000, liabilities: 4000 }),
    });
    expect(analysis.status).toBe(200);
    const analysisBody = (await analysis.json()) as { status: string; metrics: { profit: number }; ingestedSource?: { sourceType: string } };
    expect(analysisBody.status).toBe("READY");
    expect(analysisBody.metrics.profit).toBe(500);
    expect(analysisBody.ingestedSource?.sourceType).toBe("XLSX");
  });

  test("unauthenticated ingestion and analysis fail closed", async () => {
    const anonymousIngest = await fetch(`${acceptance.base}/api/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: CSV }),
    });
    expect(anonymousIngest.status).toBe(401);

    const anonymousAnalyze = await fetch(`${acceptance.base}/api/financial/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceSha256: "a".repeat(64), assets: 1, liabilities: 1 }),
    });
    expect(anonymousAnalyze.status).toBe(401);
  });

  test("raw source evidence remains tenant-isolated", async () => {
    const accepted = await ingest(acceptance, { sourceName: "owned.csv", format: "CSV", content: CSV });
    const acceptedBody = (await accepted.json()) as { evidence: { sha256: string } };

    const other = await bootstrap(server);
    const foreign = await fetch(`${other.base}/api/sources/${acceptedBody.evidence.sha256}`, {
      headers: { cookie: other.cookie },
    });
    expect(foreign.status).toBe(404);
  });
});

describe("commercial acceptance barrier — offline transport vs real runtime (K8)", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({ databasePath: ":memory:" });
    await listen(server);
  });

  afterEach(async () => {
    await close(server);
  });

  test("only a genuine network failure queues work; reconnect synchronizes it against the real runtime", async () => {
    const acceptance = await bootstrap(server);
    const storage = memoryStorage();
    let online = false;
    const fetchImpl = (url: string, init: Record<string, unknown> = {}) => {
      if (!online) return Promise.reject(new TypeError("Failed to fetch"));
      return fetch(`${acceptance.base}${url}`, {
        ...init,
        headers: { ...((init.headers as Record<string, string>) || {}), cookie: acceptance.cookie },
      });
    };
    const sync = createOfflineSync({ storage, fetchImpl, now: () => 1 });
    await sync.enqueue({ sourceName: "offline.csv", format: "CSV", content: CSV });

    const offlineReport = await sync.sync();
    expect(offlineReport.status).toBe("OFFLINE");
    expect(offlineReport.pending).toBe(1);

    online = true;
    const onlineReport = await sync.sync();
    expect(onlineReport.status).toBe("ONLINE");
    expect(onlineReport.pending).toBe(0);
    expect(onlineReport.synced).toHaveLength(1);

    // Survives a reload and is now empty because the work was accepted.
    const reloaded = createOfflineSync({ storage, fetchImpl, now: () => 2 });
    expect(await reloaded.pending()).toEqual([]);
  });

  test("a rejected (400) PDF job is classified as validation, never replayed as offline", async () => {
    const acceptance = await bootstrap(server);
    const fetchImpl = (url: string, init: Record<string, unknown> = {}) =>
      fetch(`${acceptance.base}${url}`, {
        ...init,
        headers: { ...((init.headers as Record<string, string>) || {}), cookie: acceptance.cookie },
      });
    const sync = createOfflineSync({ storage: memoryStorage(), fetchImpl, now: () => 1 });
    await sync.enqueue({ sourceName: "statement.pdf", format: "PDF", contentBase64: Buffer.from("%PDF-1.7\n%%EOF").toString("base64") });

    const report = await sync.sync();
    expect(report.status).toBe("ONLINE");
    expect(report.pending).toBe(0);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0].error).toBe("INGEST_FORMAT_UNSUPPORTED");
    expect(report.status).not.toBe("OFFLINE");
  });

  test("a storage quota failure is surfaced and can never masquerade as offline", async () => {
    const base = memoryStorage();
    let blocked = false;
    const storage = {
      getItem: (key: string) => base.getItem(key),
      removeItem: (key: string) => base.removeItem(key),
      setItem: (key: string, value: string) => {
        if (blocked) {
          const error = new Error("Setting the value of 'hooshyar.offline.ingest.queue.v1' exceeded the quota.") as Error & { name: string };
          error.name = "QuotaExceededError";
          throw error;
        }
        base.setItem(key, value);
      },
    };
    const sync = createOfflineSync({ storage, fetchImpl: async () => { throw new Error("unused"); }, now: () => 1 });
    await sync.enqueue({ sourceName: "kept.csv", format: "CSV", content: CSV });

    blocked = true;
    await expect(sync.enqueue({ sourceName: "blocked.csv", format: "CSV", content: CSV }))
      .rejects.toMatchObject({ kind: FAILURE_KINDS.STORAGE_QUOTA_FAILURE });

    const kind = classifyFailure(Object.assign(new Error("quota"), { name: "QuotaExceededError" }));
    expect(kind).toBe(FAILURE_KINDS.STORAGE_QUOTA_FAILURE);
    expect(isConnectivityFailure(kind)).toBe(false);

    blocked = false;
    expect(await sync.pending()).toHaveLength(1);
  });

  test("HTTP failure classification is precise and excludes 4xx from the offline queue", () => {
    expect(classifyHttpStatus(400)).toBe(FAILURE_KINDS.VALIDATION_FAILURE);
    expect(classifyHttpStatus(401)).toBe(FAILURE_KINDS.AUTHENTICATION_FAILURE);
    expect(classifyHttpStatus(403)).toBe(FAILURE_KINDS.AUTHORIZATION_FAILURE);
    expect(classifyHttpStatus(500)).toBe(FAILURE_KINDS.HTTP_5XX);
    expect(isConnectivityFailure(FAILURE_KINDS.VALIDATION_FAILURE)).toBe(false);
    expect(isConnectivityFailure(FAILURE_KINDS.AUTHENTICATION_FAILURE)).toBe(false);
    // A bare TypeError is not connectivity.
    expect(isConnectivityFailure(new TypeError("cannot read property"))).toBe(false);
  });
});

describe("installed-product acceptance harness — real shortcut launch (K8)", () => {
  const root = path.resolve(__dirname, "..", "..", "..");
  const harness = fs.readFileSync(path.join(root, "scripts", "installed-product-acceptance.cjs"), "utf8");

  test("launches the product through the real installed shortcut target", () => {
    // installer/HooshyarOS.iss [Icons]/[Run] activate
    // wscript.exe "<app>\launch-hooshyar.vbs" from the install directory.
    expect(harness).toContain("launch-hooshyar.vbs");
    expect(harness).toContain("spawn('wscript.exe'");
    expect(harness).toContain("cwd: installDir");
  });

  test("never re-introduces the cmd.exe double-quoting construction that exited 1", () => {
    // The defective form was spawn('cmd.exe', ['/d','/s','/c', `"${launcher}"`]);
    // Node/libuv escapes the embedded quotes to \" so cmd.exe receives a literal
    // \"...\" command, exits 1, and starts nothing.
    expect(harness).not.toMatch(/spawn\(\s*['"]cmd\.exe['"]/);
  });

  test("requires a real health success and a clean launcher exit, never a fixed delay", () => {
    expect(harness).toContain("launchInstalledProduct");
    expect(harness).toContain("waitHealth");
    expect(harness).toContain("exit.code !== 0");
    expect(harness).not.toContain("setTimeout(resolve, 2500)");
  });
});
