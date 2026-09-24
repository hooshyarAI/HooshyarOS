/**
 * Financial context-integrity runtime tests.
 *
 * Proves two coordination guarantees of the financial anchor:
 *   1. `/api/financial/insights` makes canonical document facts authoritative:
 *      client-supplied `statement`/`priorStatement`/`series` can never override
 *      a verified statement source (mirroring `/api/financial/analyze`), so the
 *      persisted statement insight is internally consistent.
 *   2. `/api/report` (and the assistant) never mix one source's canonical facts
 *      with another source's analytics/insight: the persisted analytics result is
 *      reused only when it belongs to the analyzed source, otherwise the insight
 *      is recomputed from that source's canonical statement.
 */
import { Server } from "node:http";
import ExcelJS from "exceljs-hardened";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const MILLION = 1_000_000;

interface StatementFigures {
  readonly assets: number;
  readonly liabilities: number;
  readonly equity: number;
  readonly revenue: number;
  readonly netProfit: number;
}

const STATEMENT_FIGURES: StatementFigures = {
  assets: 1_965_000,
  liabilities: 820_000,
  equity: 1_145_000,
  revenue: 2_400_000,
  netProfit: 220_000,
};

const OTHER_STATEMENT_FIGURES: StatementFigures = {
  assets: 3_000_000,
  liabilities: 1_000_000,
  equity: 2_000_000,
  revenue: 5_000_000,
  netProfit: 500_000,
};

async function buildStatementWorkbook(figures: StatementFigures): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ترازنامه");
  [
    ["صورت وضعیت مالی"],
    ["(ارقام به میلیون ریال)"],
    ["شرح", "1402", "1401"],
    ["جمع دارایی‌ها", figures.assets, 1_798_000],
    ["جمع بدهی‌ها", figures.liabilities, 880_000],
    ["جمع حقوق مالکانه", figures.equity, 918_000],
  ].forEach((row) => sheet.addRow(row));
  const income = workbook.addWorksheet("سود و زیان");
  [
    ["صورت سود و زیان"],
    ["(ارقام به میلیون ریال)"],
    ["شرح", "1402", "1401"],
    ["درآمد عملیاتی", figures.revenue, 2_100_000],
    ["سود (زیان) خالص", figures.netProfit, 170_000],
  ].forEach((row) => income.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("financial context integrity — runtime HTTP", () => {
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

  const ingestStatement = async (cookie: string, figures: StatementFigures): Promise<string> => {
    const bytes = await buildStatementWorkbook(figures);
    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "statement.xlsx", format: "XLSX", contentBase64: bytes.toString("base64") }),
    });
    expect(ingested.status).toBe(201);
    return (await ingested.json()).evidence.sha256 as string;
  };

  test("canonical document facts are authoritative over client statement/series in /api/financial/insights", async () => {
    const cookie = await register("insights-precedence-owner", "Insights Precedence Org");
    const sha256 = await ingestStatement(cookie, STATEMENT_FIGURES);

    const insights = await request("/api/financial/insights", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        sourceSha256: sha256,
        statement: {
          revenue: 999_999, cogs: 1, grossProfit: 1, operatingExpenses: 1, operatingIncome: 1,
          interest: 1, preTaxIncome: 1, taxes: 1, netIncome: 999_999, cash: 1, receivables: 1,
          inventory: 1, currentAssets: 1, ppe: 1, totalAssets: 9_999_999, payables: 1,
          shortTermDebt: 1, currentLiabilities: 1, longTermDebt: 1, totalLiabilities: 1, equity: 1,
        },
        priorStatement: { revenue: 1, netIncome: 1, totalAssets: 1, totalLiabilities: 1, equity: 1 },
        series: [111, 222, 333, 444, 555],
      }),
    });
    expect(insights.status).toBe(200);
    const body = await insights.json();

    // The client's invented figures never reach the persisted insight: every
    // ratio and metric is derived from the verified statement facts.
    expect(body.statementInsight.metrics.revenue).toBe(STATEMENT_FIGURES.revenue * MILLION);
    expect(body.statementInsight.metrics.netProfit).toBe(STATEMENT_FIGURES.netProfit * MILLION);
    expect(body.statementInsight.ratios.netMargin).toBeCloseTo(STATEMENT_FIGURES.netProfit / STATEMENT_FIGURES.revenue, 8);
    expect(body.ratios.profitability.netMargin).toBeCloseTo(STATEMENT_FIGURES.netProfit / STATEMENT_FIGURES.revenue, 8);
    // A statement source carries no ledger series, so forecast/anomaly sections
    // must fail closed instead of consuming the client-supplied series.
    expect(body.forecast).toBeNull();
    expect(body.anomalies).toBeNull();

    const latest = await request("/api/financial/insights/latest", { headers: { cookie } });
    expect(latest.status).toBe(200);
    const latestBody = await latest.json();
    expect(latestBody.statementInsight.metrics.revenue).toBe(STATEMENT_FIGURES.revenue * MILLION);
    expect(latestBody.statementInsight.ratios.netMargin).toBeCloseTo(STATEMENT_FIGURES.netProfit / STATEMENT_FIGURES.revenue, 8);
  });

  test("/api/report does not mix an insight computed for a different source", async () => {
    const cookie = await register("context-correlation-owner", "Context Correlation Org");
    const shaA = await ingestStatement(cookie, STATEMENT_FIGURES);
    const shaB = await ingestStatement(cookie, OTHER_STATEMENT_FIGURES);
    expect(shaB).not.toBe(shaA);

    // Analyze source A only.
    const analysis = await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: shaA }),
    });
    expect(analysis.status).toBe(200);

    // Make source B the tenant's latest analytics; A remains the latest analysis.
    const insightsB = await request("/api/financial/insights", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: shaB }),
    });
    expect(insightsB.status).toBe(200);

    const report = await request("/api/report", { headers: { cookie } });
    expect(report.status).toBe(200);
    const reportBody = await report.json();
    expect(reportBody.source.sha256).toBe(shaA);
    const reportText = JSON.stringify(reportBody);
    // The report describes source A's verified facts only; source B's figures
    // must never appear even though B is the tenant's latest analytics result.
    expect(reportText).toContain(String(STATEMENT_FIGURES.revenue * MILLION));
    expect(reportText).not.toContain(String(OTHER_STATEMENT_FIGURES.revenue * MILLION));
    expect(reportText).not.toContain(String(OTHER_STATEMENT_FIGURES.assets * MILLION));
  });
});
