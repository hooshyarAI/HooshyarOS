/**
 * Unified financial report runtime (HTTP) tests.
 *
 * Proves the commercial runtime accepts a legacy XLS workbook and a statement
 * XLSX through the durable job API, exposes the truthful document summary, and
 * derives the existing financial analysis from canonical facts. Also proves the
 * provider gate fails closed with a precise code when the XLS provider is not
 * admitted.
 */
import { readFileSync } from "node:fs";
import { Server } from "node:http";
import { resolve } from "node:path";
import ExcelJS from "exceljs-hardened";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialIngestionService } from "../Product/FinancialIngestionService";
import {
  CapabilityProviderRegistry,
  HOOSHYAROS_CAPABILITY_PROVIDER_INVENTORY,
  type CapabilityProviderCandidate,
} from "../Product/CapabilityProviderRegistry";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const XLS_REPORT = resolve(REPO_ROOT, "Backend", "HBOS", "test", "fixtures", "synthetic", "financial_report_1402.xls");

async function buildStatementWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ترازنامه");
  [
    ["صورت وضعیت مالی"],
    ["(ارقام به میلیون ریال)"],
    ["شرح", "1402", "1401"],
    ["جمع دارایی‌ها", 1965000, 1798000],
    ["جمع بدهی‌ها", 820000, 880000],
    ["جمع حقوق مالکانه", 1145000, 918000],
  ].forEach((row) => sheet.addRow(row));
  const income = workbook.addWorksheet("سود و زیان");
  [
    ["صورت سود و زیان"],
    ["(ارقام به میلیون ریال)"],
    ["شرح", "1402", "1401"],
    ["درآمد عملیاتی", 2400000, 2100000],
    ["سود (زیان) خالص", 220000, 170000],
  ].forEach((row) => income.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function registryWithoutXls(): CapabilityProviderRegistry {
  const inventory = HOOSHYAROS_CAPABILITY_PROVIDER_INVENTORY.map((entry) =>
    entry.capabilityId === "document-xls-legacy"
      ? ({ ...entry, status: "DEFERRED", integration: "NOT_INTEGRATED" } as CapabilityProviderCandidate)
      : entry,
  );
  return new CapabilityProviderRegistry(inventory);
}

describe("financial report ingestion — runtime HTTP", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified" }) },
      sessionSweepIntervalMs: 0,
    });
    await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", () => resolveListen()));
  });

  afterEach(async () => {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  });

  const request = async (path: string, options: RequestInit = {}): Promise<Response> => {
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

  test("POST /api/ingest accepts a legacy XLS report and exposes the document summary", async () => {
    const cookie = await register("xls-owner", "XLS Org");
    const bytes = readFileSync(XLS_REPORT);
    const response = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "financial_report_1402.xls", format: "XLS", contentBase64: bytes.toString("base64") }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.status).toBe("READY");
    expect(body.format).toBe("XLS");
    expect(body.evidence.sourceType).toBe("XLS");
    expect(body.transactionCount).toBe(0);
    expect(body.document.status).toBe("COMPLETED");
    expect(body.document.factCount).toBeGreaterThan(0);
    expect(body.document.sections.map((section: { type: string }) => section.type)).toContain("BALANCE_SHEET");
  });

  test("POST /api/financial/analyze derives the existing analysis from canonical facts", async () => {
    const cookie = await register("analyze-owner", "Analyze Org");
    const bytes = readFileSync(XLS_REPORT);
    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "financial_report_1402.xls", format: "XLS", contentBase64: bytes.toString("base64") }),
    });
    const sha256 = (await ingested.json()).evidence.sha256;

    // No assets/liabilities supplied: they are derived from real statement facts.
    const analysis = await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    const body = await analysis.json();
    expect(analysis.status).toBe(200);
    expect(body.status).toBe("READY");
    expect(body.targetEngine).toBe("Financial Intelligence Engine");
    expect(body.ingestedSource.document.status).toBe("COMPLETED");
    // assets 1,965,000m IRR and liabilities 820,000m IRR -> debtRatio ~0.4173
    expect(body.metrics.debtRatio).toBeCloseTo(820000 / 1965000, 4);
    // Profit uses total expenses reconciling to the statement's net profit.
    expect(body.metrics.profit).toBeCloseTo(220000 * 1_000_000, 0);
  });

  test("canonical document facts are authoritative over manually supplied balance-sheet values", async () => {
    const cookie = await register("precedence-owner", "Precedence Org");
    const bytes = await buildStatementWorkbook();
    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "statement.xlsx", format: "XLSX", contentBase64: bytes.toString("base64") }),
    });
    const sha256 = (await ingested.json()).evidence.sha256;

    const analysis = await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256, assets: 10000, liabilities: 2500 }),
    });
    expect(analysis.status).toBe(200);
    const body = await analysis.json();
    expect(body.inputProvenance.assets).toBe("DOCUMENT");
    expect(body.inputProvenance.liabilities).toBe("DOCUMENT");
    expect(body.inputProvenance.expenses).toBe("DOCUMENT");
    // The manual 10000/2500 must NOT force debtRatio = 0.25.
    expect(body.metrics.debtRatio).toBeCloseTo(820000 / 1965000, 4);
  });

  test("statement analytics compute available ratios without a blanket 422", async () => {
    const cookie = await register("insight-owner", "Insight Org");
    const bytes = await buildStatementWorkbook();
    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "statement.xlsx", format: "XLSX", contentBase64: bytes.toString("base64") }),
    });
    const sha256 = (await ingested.json()).evidence.sha256;

    const insights = await request("/api/financial/insights", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    expect(insights.status).toBe(200);
    const body = await insights.json();
    expect(body.statementInsight).toBeTruthy();
    // transactionCount is 0 because this is a statement, not a ledger.
    expect(body.ingestedSource.transactionCount).toBe(0);
    expect(body.statementInsight.ratios.netMargin).toBeCloseTo(220000 / 2400000, 8);
    expect(body.statementInsight.ratios.currentRatio).toBeNull();
    expect(body.statementInsight.unavailableRatios).toEqual(expect.arrayContaining(["grossMargin", "currentRatio"]));
    expect(body.statementInsight.comparative.length).toBeGreaterThan(0);
    expect(body.statementInsight.limitations.length).toBeGreaterThan(0);
  });

  test("assistant receives the verified statement context and the report carries it", async () => {
    const cookie = await register("assistant-owner", "Assistant Org");
    const bytes = await buildStatementWorkbook();
    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "statement.xlsx", format: "XLSX", contentBase64: bytes.toString("base64") }),
    });
    const sha256 = (await ingested.json()).evidence.sha256;
    await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    await request("/api/financial/insights", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });

    const answer = await request("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ question: "What are the main strengths and risks?" }),
    });
    expect(answer.status).toBe(200);
    const answerBody = await answer.json();
    expect(answerBody.evidence.statementContext).toBe(true);
    expect(answerBody.evidence.documentStatus).toBeTruthy();

    const report = await request("/api/report", { headers: { cookie } });
    expect(report.status).toBe(200);
    const reportBody = await report.json();
    const reportText = JSON.stringify(reportBody);
    expect(reportText).toContain("Document status: COMPLETED");
    expect(reportText).toContain("Reporting periods: 1402 | 1401");
    expect(reportText).toContain("positive net profit");
  });

  test("analysis still requires balance-sheet fields when no facts exist", async () => {
    const cookie = await register("csv-owner", "CSV Org");
    const csv = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR";
    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: csv }),
    });
    const sha256 = (await ingested.json()).evidence.sha256;
    const missing = await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("BALANCE_SHEET_FIELDS_REQUIRED");
  });

  test("the durable job API reports statement progress and an idempotent replay", async () => {
    const cookie = await register("job-owner", "Job Org");
    const bytes = await buildStatementWorkbook();
    const body = JSON.stringify({ sourceName: "financial_report_1402.xlsx", format: "XLSX", contentBase64: bytes.toString("base64") });

    const started = await request("/api/ingest/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, "idempotency-key": "report-job-1" },
      body,
    });
    expect(started.status).toBe(202);
    const startedBody = await started.json();
    expect(typeof startedBody.jobId).toBe("string");

    let job: Record<string, any> | undefined;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const status = await request(`/api/ingest/jobs/${startedBody.jobId}`, { headers: { cookie } });
      const payload = await status.json();
      job = payload.job;
      if (job?.status === "COMPLETED" || job?.status === "FAILED") break;
      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    expect(job?.status).toBe("COMPLETED");
    expect(job?.result.transactionCount).toBe(0);
    expect(job?.result.document.status).toBe("COMPLETED");
    expect(job?.result.document.sections.map((section: { type: string }) => section.type)).toEqual([
      "BALANCE_SHEET",
      "INCOME_STATEMENT",
    ]);

    const replay = await request("/api/ingest/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie, "idempotency-key": "report-job-1" },
      body,
    });
    const replayBody = await replay.json();
    expect(replayBody.replayed).toBe(true);
    expect(replayBody.jobId).toBe(startedBody.jobId);
  });

  test("job status is tenant-isolated", async () => {
    const cookie = await register("job-owner-2", "Job Org");
    const bytes = readFileSync(XLS_REPORT);
    const started = await request("/api/ingest/jobs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "financial_report_1402.xls", format: "XLS", contentBase64: bytes.toString("base64") }),
    });
    const jobId = (await started.json()).jobId;
    const other = await register("job-other", "Other Org");
    const cross = await request(`/api/ingest/jobs/${jobId}`, { headers: { cookie: other } });
    expect(cross.status).toBe(404);
  });

  test("XLS fails closed with a precise code when the provider is not admitted", async () => {
    const store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const service = new FinancialIngestionService(store, undefined, registryWithoutXls());
    const bytes = readFileSync(XLS_REPORT);
    await expect(
      service.ingest("tenant-g", { sourceName: "financial_report_1402.xls", format: "XLS", contentBase64: bytes.toString("base64") }),
    ).rejects.toThrow(/^xls-provider-unavailable/);
  });
});
