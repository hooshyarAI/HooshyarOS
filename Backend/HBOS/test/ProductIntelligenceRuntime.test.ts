/**
 * Product-intelligence golden-case runtime tests (HTTP).
 *
 * Reproduces the observed user journey end-to-end on the real statement path:
 * a statement is ingested, analyzed and turned into a governed insight; the
 * report and the assistant must then answer the question that was asked, with
 * grounded findings, exactly three scenarios, exact canonical numbers and no
 * internal/English identifier leakage.
 */
import { Server } from "node:http";
import ExcelJS from "exceljs-hardened";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { formatFaInteger } from "../Product/FinancialDecisionNarrativeService";

async function buildRichStatementWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const balance = workbook.addWorksheet("ترازنامه");
  [
    ["صورت وضعیت مالی"],
    ["(ارقام به میلیون ریال)"],
    ["شرح", "1402", "1401"],
    ["total current assets", 31107024, 29000000],
    ["total assets", 32244256, 30000000],
    ["total current liabilities", 17279237, 16000000],
    ["total liabilities", 17407417, 16200000],
    ["total equity", 14836839, 13800000],
  ].forEach((row) => balance.addRow(row));
  const income = workbook.addWorksheet("سود و زیان");
  [
    ["صورت سود و زیان"],
    ["(ارقام به میلیون ریال)"],
    ["شرح", "1402", "1401"],
    ["revenue", 32129418, 16527318],
    ["cost of sales", 27093243, 13934000],
    ["gross profit", 5036175, 2593318],
    ["operating expenses", 291634, 280000],
    // The real operating-profit line that does NOT reconcile to gross profit
    // minus operating expenses: this must surface as a grounded risk.
    ["operating income", 4708096, 2313313],
    ["net income", 7250000, 3319076],
  ].forEach((row) => income.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const INTERNAL_IDENTIFIER = /\b(preTaxIncome|netProfit|netIncome|operatingIncome|grossProfit|totalLiabilities|debtToAssets|balance-sheet-identity|gross-profit-identity|operating-profit-identity|qualityOfEarnings|Revenue=|Profit=)\b/;
const ENGLISH_LEAK = /(evidence is absent|ratios are unavailable|interpretation is unavailable|is not applicable|Accounting check|Measure .* was not extracted)/;
const normalize = (value: string): string => value.replace(/\u200c/g, "");

describe("Product intelligence golden cases — runtime HTTP", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "stub-answer" }) },
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

  const prepare = async (cookie: string) => {
    const bytes = await buildRichStatementWorkbook();
    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "sample-1402.xlsx", format: "XLSX", contentBase64: bytes.toString("base64") }),
    });
    expect(ingested.status).toBe(201);
    const sha256 = (await ingested.json()).evidence.sha256;
    const analysis = await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    expect(analysis.status).toBe(200);
    const insights = await request("/api/financial/insights", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    expect(insights.status).toBe(200);
    return { sha256, insights: await insights.json(), analysis: await analysis.json() };
  };

  test("the governed insight exposes non-empty Persian findings and three scenarios", async () => {
    const cookie = await register("pi-owner", "PI Org");
    const { insights } = await prepare(cookie);
    expect(insights.statementInsight).toBeTruthy();
    expect(insights.ingestedSource.transactionCount).toBe(0);
    const presentation = insights.presentation;
    expect(presentation).toBeTruthy();
    expect(presentation.findings.strengths.length).toBeGreaterThan(0);
    expect(presentation.findings.risks.length).toBeGreaterThan(0);
    expect(presentation.findings.risks.some((finding: { message: string }) => finding.message.includes("اهرم"))).toBe(true);
    expect(presentation.findings.actions.length).toBeGreaterThan(0);
    expect(presentation.scenarios).toHaveLength(3);
  });

  test("the report carries meaningful strengths/weaknesses/risks/opportunities/actions", async () => {
    const cookie = await register("pi-report", "PI Org");
    const { insights } = await prepare(cookie);
    const report = await request("/api/report", { headers: { cookie } });
    expect(report.status).toBe(200);
    const reportText = normalize(JSON.stringify(await report.json()));
    expect(reportText).toContain(normalize("نقاط قوت"));
    expect(reportText).toContain(normalize("ریسک‌ها"));
    expect(reportText).toContain(normalize("فرصت‌ها و رشد"));
    expect(reportText).toContain(normalize("اقدامات پیشنهادی"));
    // Grounded content, not the empty-section fallback or raw English.
    expect(reportText).toContain("اهرم");
    expect(reportText).toContain("کنترل حسابداری");
    expect(ENGLISH_LEAK.test(reportText)).toBe(false);
    // Canonical exact magnitude (never the scrolled/rounded variant).
    const revenue = insights.statementInsight.metrics.revenue as number;
    expect(reportText).toContain(formatFaInteger(revenue));
  });

  test("the risk question receives evidence-based drivers, not a bare ratio", async () => {
    const cookie = await register("pi-risk", "PI Org");
    await prepare(cookie);
    const response = await request("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ question: "مهم‌ترین ریسک مالی من چیست؟" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.response.intent).toBe("RISK");
    expect(body.answer).toContain("اهرم");
    expect(body.response.sections.length).toBeGreaterThan(0);
    expect(body.evidence.statementContext).toBe(true);
    expect(INTERNAL_IDENTIFIER.test(body.answer)).toBe(false);
    expect(ENGLISH_LEAK.test(body.answer)).toBe(false);
  });

  test("the three-scenario question returns exactly three scenarios", async () => {
    const cookie = await register("pi-scenario", "PI Org");
    await prepare(cookie);
    const response = await request("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ question: "برای رشد و توسعه و افزایش تاب‌آوری در سه سناریو پیشنهاد بده" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.response.intent).toBe("SCENARIOS");
    expect(body.response.scenarios).toHaveLength(3);
    expect(body.response.scenarios.map((scenario: { key: string }) => scenario.key)).toEqual([
      "CONSERVATIVE",
      "BALANCED",
      "AGGRESSIVE",
    ]);
    expect(body.answer).toContain("سناریو");
    expect(INTERNAL_IDENTIFIER.test(body.answer)).toBe(false);
  });

  test("the analysis question returns the exact canonical revenue figure", async () => {
    const cookie = await register("pi-analyze", "PI Org");
    const { insights } = await prepare(cookie);
    const revenue = insights.statementInsight.metrics.revenue as number;
    const response = await request("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ question: "این صورت مالی را تحلیل کن." }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.response.intent).toBe("ANALYZE");
    expect(body.answer).toContain(formatFaInteger(revenue));
    expect(body.answer).not.toContain("۳۲٬۱۲۹٬۴۰۰٬۰۰۰٬۰۰۰");
    expect(INTERNAL_IDENTIFIER.test(body.answer)).toBe(false);
  });

  test("the data-gap question separates data, validation and operational gaps", async () => {
    const cookie = await register("pi-gaps", "PI Org");
    await prepare(cookie);
    const response = await request("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ question: "چه اطلاعاتی برای نتیجه‌گیری بهتر کم است؟" }),
    });
    const body = await response.json();
    expect(body.response.intent).toBe("DATA_GAPS");
    const headings = normalize(body.response.sections.map((section: { heading: string }) => section.heading as string).join(" "));
    expect(headings).toContain(normalize("شکاف‌های داده"));
    expect(headings).toContain(normalize("شکاف‌های اعتبارسنجی"));
    expect(headings).toContain(normalize("شکاف‌های عملیاتی"));
    expect(INTERNAL_IDENTIFIER.test(body.answer)).toBe(false);
    expect(ENGLISH_LEAK.test(body.answer)).toBe(false);
  });

  test("a repeated question is answered against its own intent, not a fixed metric dump", async () => {
    const cookie = await register("pi-repeat", "PI Org");
    await prepare(cookie);
    const ask = (question: string) => request("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ question }),
    }).then((response) => response.json());
    const risk = await ask("مهم‌ترین ریسک مالی من چیست؟");
    const scenarios = await ask("برای رشد و توسعه و افزایش تاب‌آوری در سه سناریو پیشنهاد بده");
    expect(risk.response.intent).toBe("RISK");
    expect(scenarios.response.intent).toBe("SCENARIOS");
    expect(risk.answer).not.toBe(scenarios.answer);
  });
});
