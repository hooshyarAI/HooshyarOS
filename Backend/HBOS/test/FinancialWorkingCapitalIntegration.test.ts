/**
 * Deep product-integration repair — focused integration tests.
 *
 * Proves the repaired canonical path: a real financial source's working-capital
 * and coverage line items (cash, trade receivables, inventory, trade payables,
 * short/long-term debt, finance cost) are preserved by the ingestion contract,
 * flow into the canonical `RatioStatement`, and are consumed by the already
 * existing canonical owners (`FinancialIntelligenceEngine.workingCapital`, the
 * ratio owner's liquidity/efficiency/coverage/DuPont) and surfaced through the
 * governed insight and the Persian narrative. No value is fabricated; absent
 * evidence stays absent and is reported as a limitation.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { Server } from "node:http";
import ExcelJS from "exceljs-hardened";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialAnalyticsService } from "../Product/FinancialAnalyticsService";
import {
  buildFinancialDocumentUnderstanding,
  deriveAnalysisInput,
  derivePriorStatement,
  matchStatementMeasure,
  type FinancialDocumentUnderstanding,
  type FinancialStatementFact,
  type StatementMeasure,
} from "../Product/FinancialDocumentUnderstanding";
import { composeFinancialStatementInsight } from "../Product/FinancialStatementInsight";
import { composeAnswer, composeFindingGroups } from "../Product/FinancialDecisionNarrativeService";

const M = 1_000_000;

const fact = (
  measure: StatementMeasure,
  rawValue: number,
  periodIndex = 0,
  section: FinancialStatementFact["section"] = "BALANCE_SHEET",
): FinancialStatementFact => ({
  measure,
  section,
  label: measure,
  periodLabel: periodIndex === 0 ? "current" : "prior",
  periodIndex,
  rawValue,
  value: rawValue * M,
  unitMultiplier: M,
  currency: "IRR",
  confidence: 1,
  evidence: { line: 1, text: `${measure}=${rawValue}` },
});

const insightFromFacts = (facts: readonly FinancialStatementFact[]) => {
  const document: FinancialDocumentUnderstanding = {
    status: "PARTIAL",
    currency: "IRR",
    unitMultiplier: M,
    sections: [],
    facts,
  };
  const derived = deriveAnalysisInput(document);
  const prior = derivePriorStatement(document);
  const analytics = new FinancialAnalyticsService().execute({
    tenantId: "t1",
    statement: derived.statement,
    priorStatement: prior,
  });
  return {
    document,
    derived,
    analytics,
    insight: composeFinancialStatementInsight({ document, derived, prior, analytics }),
  };
};

const COMPLETE_INCOME_AND_BS: readonly FinancialStatementFact[] = [
  fact("REVENUE", 1000, 0, "INCOME_STATEMENT"),
  fact("COGS", -600, 0, "INCOME_STATEMENT"),
  fact("GROSS_PROFIT", 400, 0, "INCOME_STATEMENT"),
  fact("OPERATING_EXPENSES", -200, 0, "INCOME_STATEMENT"),
  fact("OPERATING_PROFIT", 200, 0, "INCOME_STATEMENT"),
  fact("INTEREST", -20, 0, "INCOME_STATEMENT"),
  fact("NET_PROFIT", 150, 0, "INCOME_STATEMENT"),
  fact("CASH", 100),
  fact("RECEIVABLES", 200),
  fact("INVENTORY", 150),
  fact("CURRENT_ASSETS", 450),
  fact("PPE", 550),
  fact("ASSETS", 1000),
  fact("PAYABLES", 120),
  fact("SHORT_TERM_DEBT", 80),
  fact("CURRENT_LIABILITIES", 200),
  fact("LONG_TERM_DEBT", 200),
  fact("LIABILITIES", 400),
  fact("EQUITY", 600),
];

describe("ingestion contract: working-capital detail labels", () => {
  test("maps the real working-capital and coverage line items", () => {
    expect(matchStatementMeasure("موجودی نقد")).toBe("CASH");
    expect(matchStatementMeasure("دریافتنی‌های تجاری و سایر دریافتنی‌ها")).toBe("RECEIVABLES");
    expect(matchStatementMeasure("موجودی مواد و کالا")).toBe("INVENTORY");
    expect(matchStatementMeasure("دارایی‌های ثابت مشهود")).toBe("PPE");
    expect(matchStatementMeasure("پرداختنی‌های تجاری و سایر پرداختنی‌ها")).toBe("PAYABLES");
    expect(matchStatementMeasure("تسهیلات مالی")).toBe("SHORT_TERM_DEBT");
    expect(matchStatementMeasure("تسهیلات مالی بلندمدت")).toBe("LONG_TERM_DEBT");
    expect(matchStatementMeasure("هزینه‌های مالی")).toBe("INTEREST");
    expect(matchStatementMeasure("سود قبل از مالیات")).toBe("PRE_TAX_INCOME");
  });

  test("does not let the working-capital labels collide with existing aggregates", () => {
    expect(matchStatementMeasure("دارایی‌های غیرجاری")).toBe("NON_CURRENT_ASSETS");
    expect(matchStatementMeasure("جمع دارایی‌های جاری")).toBe("CURRENT_ASSETS");
  });

  test("preserves the detail measures from a positioned balance sheet grid", () => {
    const document = buildFinancialDocumentUnderstanding([
      {
        name: "ترازنامه",
        rows: [
          ["شرح", "1402"],
          ["موجودی نقد", "1039"],
          ["دریافتنی‌های تجاری و سایر دریافتنی‌ها", "7822"],
          ["موجودی مواد و کالا", "10482"],
          ["پرداختنی‌های تجاری و سایر پرداختنی‌ها", "14429"],
          ["تسهیلات مالی", "13"],
        ],
        positioned: true,
      },
    ]);
    const derived = deriveAnalysisInput(document);
    // No unit is declared in this grid, so values stay at their declared scale.
    expect(derived.statement.cash).toBe(1039);
    expect(derived.statement.receivables).toBe(7822);
    expect(derived.statement.inventory).toBe(10482);
    expect(derived.statement.payables).toBe(14429);
    expect(derived.statement.shortTermDebt).toBe(13);
  });
});

describe("canonical analytics: liquidity, working capital, coverage, DuPont", () => {
  const { analytics, insight } = insightFromFacts(COMPLETE_INCOME_AND_BS);

  test("quick and cash liquidity become computable from preserved detail", () => {
    expect(insight.ratios.quickRatio).toBeCloseTo((450 - 150) / 200, 8);
    expect(insight.ratios.cashRatio).toBeCloseTo(100 / 200, 8);
    expect(insight.unavailableRatios).not.toContain("quickRatio");
    expect(insight.unavailableRatios).not.toContain("cashRatio");
  });

  test("working-capital cycle is computed by the canonical engine owner", () => {
    // DSO = 200/1000*365, DIO = 150/600*365, DPO = 120/600*365
    expect(analytics.ratios?.workingCapital?.receivablesDays).toBeCloseTo((200 / 1000) * 365, 6);
    expect(analytics.ratios?.workingCapital?.inventoryDays).toBeCloseTo((150 / 600) * 365, 6);
    expect(analytics.ratios?.workingCapital?.payablesDays).toBeCloseTo((120 / 600) * 365, 6);
    expect(analytics.ratios?.workingCapital?.netWorkingCapital).toBe((200 + 150 - 120) * M);
  });

  test("DuPont decomposition reconciles to the ratio owner's ROE", () => {
    const dp = insight.duPont!;
    expect(dp.netMargin).toBeCloseTo(150 / 1000, 8);
    expect(dp.assetTurnover).toBeCloseTo(1000 / 1000, 8);
    expect(dp.equityMultiplier).toBeCloseTo(1000 / 600, 8);
    expect(dp.roe).toBeCloseTo((150 / 1000) * (1000 / 1000) * (1000 / 600), 8);
    expect(insight.ratios.roe).toBeCloseTo(dp.roe!, 8);
  });

  test("interest coverage is derived from operating profit over finance cost", () => {
    expect(insight.coverage?.interestCoverage).toBeCloseTo(200 / 20, 8);
  });

  test("surfaces the working-capital cycle and coverage in the governed insight", () => {
    expect(insight.workingCapital).not.toBeNull();
    expect(insight.interpretation.some((finding) => finding.message.includes("Working-capital cycle"))).toBe(true);
    expect(insight.interpretation.some((finding) => finding.message.includes("DuPont"))).toBe(true);
    expect(JSON.stringify(insight)).not.toContain("NaN");
  });
});

describe("honesty: absent evidence never becomes a fabricated ratio", () => {
  test("without inventory/cash the detail ratios stay unavailable and are limited", () => {
    const { insight } = insightFromFacts([
      fact("REVENUE", 1000, 0, "INCOME_STATEMENT"),
      fact("NET_PROFIT", 150, 0, "INCOME_STATEMENT"),
      fact("CURRENT_ASSETS", 450),
      fact("CURRENT_LIABILITIES", 200),
      fact("ASSETS", 1000),
      fact("LIABILITIES", 400),
      fact("EQUITY", 600),
    ]);
    expect(insight.ratios.quickRatio).toBeNull();
    expect(insight.ratios.cashRatio).toBeNull();
    expect(insight.workingCapital).toBeNull();
    expect(insight.limitations.some((line) => line.includes("Working-capital cycle evidence is incomplete"))).toBe(true);
  });

  test("a zero finance cost makes interest coverage not applicable, not zero", () => {
    const { insight } = insightFromFacts([
      fact("REVENUE", 1000, 0, "INCOME_STATEMENT"),
      fact("OPERATING_PROFIT", 200, 0, "INCOME_STATEMENT"),
      fact("INTEREST", 0, 0, "INCOME_STATEMENT"),
      fact("NET_PROFIT", 150, 0, "INCOME_STATEMENT"),
      fact("ASSETS", 1000),
      fact("LIABILITIES", 400),
      fact("EQUITY", 600),
    ]);
    expect(insight.coverage?.interestCoverage).toBeNull();
  });
});

describe("Persian decision-support narrative consumes the new intelligence", () => {
  test("reports the cash conversion cycle and coverage without leaking identifiers", () => {
    const { insight } = insightFromFacts(COMPLETE_INCOME_AND_BS);
    const groups = composeFindingGroups(insight);
    const all = [...groups.strengths, ...groups.weaknesses, ...groups.risks, ...groups.opportunities, ...groups.actions];
    expect(all.some((finding) => finding.message.includes("چرخه تبدیل نقد"))).toBe(true);
    expect(all.some((finding) => finding.message.includes("هزینه مالی"))).toBe(true);
    expect(all.every((finding) => !/dso|dio|dpo|interestCoverage|cashConversionCycle|workingCapital/i.test(finding.message))).toBe(true);
  });

  test("states the product/segment capability honestly instead of inferring it", () => {
    const { insight } = insightFromFacts(COMPLETE_INCOME_AND_BS);
    const composed = composeAnswer(insight, "سه سناریو برای آینده چیست؟");
    expect(composed.limitations.some((line) => line.includes("سودآوری در سطح محصول/بخش"))).toBe(true);
  });
});

describe("adversarial: the pipeline fails honestly and locally", () => {
  test("a missing comparative period produces no fabricated change", () => {
    const { insight } = insightFromFacts(COMPLETE_INCOME_AND_BS);
    expect(insight.comparative).toHaveLength(0);
    const composed = composeAnswer(insight, "چرا سود تغییر کرده است؟");
    expect(composed.answer).toContain("در دسترس نیست");
  });

  test("a loss with negative operating cash flow is reported honestly", () => {
    const { insight } = insightFromFacts([
      fact("REVENUE", 1000, 0, "INCOME_STATEMENT"),
      fact("COGS", -1200, 0, "INCOME_STATEMENT"),
      fact("GROSS_PROFIT", -200, 0, "INCOME_STATEMENT"),
      fact("NET_PROFIT", -150, 0, "INCOME_STATEMENT"),
      fact("OPERATING_CASH_FLOW", -80, 0, "CASH_FLOW_STATEMENT"),
      fact("ASSETS", 1000),
      fact("LIABILITIES", 400),
      fact("EQUITY", 600),
    ]);
    expect(insight.ratios.netMargin).toBeCloseTo(-0.15, 8);
    expect(insight.risks.some((finding) => finding.message.includes("Operating cash flow is negative"))).toBe(true);
    expect(JSON.stringify(insight)).not.toContain("NaN");
  });

  test("conflicting balance-sheet values surface a mismatch, never a silent pass", () => {
    const { insight } = insightFromFacts([
      fact("REVENUE", 1000, 0, "INCOME_STATEMENT"),
      fact("NET_PROFIT", 100, 0, "INCOME_STATEMENT"),
      fact("ASSETS", 1500),
      fact("LIABILITIES", 800),
      fact("EQUITY", 400),
    ]);
    const identity = insight.integrity.find((check) => check.id === "balance-sheet-identity");
    expect(identity?.status).toBe("MISMATCH");
    expect(insight.risks.some((finding) => finding.message.includes("balance-sheet-identity"))).toBe(true);
  });

  test("extreme but real ratios remain finite and identified, not hidden", () => {
    const { insight } = insightFromFacts([
      fact("REVENUE", 1000, 0, "INCOME_STATEMENT"),
      fact("COGS", -400, 0, "INCOME_STATEMENT"),
      fact("OPERATING_PROFIT", 1000, 0, "INCOME_STATEMENT"),
      fact("INTEREST", 1, 0, "INCOME_STATEMENT"),
      fact("NET_PROFIT", 900, 0, "INCOME_STATEMENT"),
      fact("RECEIVABLES", 1),
      fact("INVENTORY", 1),
      fact("PAYABLES", 1),
      fact("ASSETS", 1000),
      fact("LIABILITIES", 400),
      fact("EQUITY", 600),
    ]);
    expect(insight.coverage?.interestCoverage).toBeCloseTo(1000, 6);
    expect(Number.isFinite(insight.workingCapital?.cashConversionCycle ?? NaN)).toBe(true);
  });
});

/* ------------------------------------------------------------------------- *
 * Real HTTP path: the assistant consumes the working-capital intelligence.
 * ------------------------------------------------------------------------- */
describe("HTTP acceptance: assistant and insights use the deep path", () => {
  let server: Server;

  beforeEach(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "stub" }) },
      sessionSweepIntervalMs: 0,
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  });

  afterEach(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  test("a statement source yields working-capital insight and a grounded Persian answer", async () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    const base = `http://127.0.0.1:${address.port}`;
    const request = (path: string, options: RequestInit = {}) => fetch(`${base}${path}`, options);

    const registered = await request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "wc-owner", password: "Sup3rSecret!", organization: "WC Org" }),
    });
    const cookie = (registered.headers.get("set-cookie") ?? "").split(";")[0];

    const workbook = new ExcelJS.Workbook();
    const balance = workbook.addWorksheet("ترازنامه");
    [
      ["صورت وضعیت مالی"],
      ["(ارقام به میلیون ریال)"],
      ["شرح", "1402", "1401"],
      ["موجودی نقد", 1039231, 243835],
      ["دریافتنی‌های تجاری و سایر دریافتنی‌ها", 7822945, 3752123],
      ["موجودی مواد و کالا", 10482503, 6950617],
      ["جمع دارایی‌های جاری", 31107024, 13773294],
      ["جمع دارایی‌ها", 32244256, 14709294],
      ["پرداختنی‌های تجاری و سایر پرداختنی‌ها", 14429397, 3978116],
      ["جمع بدهی‌های جاری", 17279237, 5823592],
      ["جمع بدهی‌ها", 17407417, 5959905],
      ["جمع حقوق مالکانه", 14836839, 8749389],
    ].forEach((row) => balance.addRow(row));
    const income = workbook.addWorksheet("سود و زیان");
    [
      ["صورت سود و زیان"],
      ["(ارقام به میلیون ریال)"],
      ["شرح", "1402", "1401"],
      ["درآمد عملیاتی", 32129418, 16527318],
      ["بهای تمام‌شده کالای فروش رفته", 27093243, 14363365],
      ["سود ناخالص", 5036175, 2163953],
      ["هزینه‌های فروش، اداری و عمومی", 291634, 303569],
      ["سود (زیان) عملیاتی", 4708096, 1874102],
      ["هزینه‌های مالی", 44193, 249167],
      ["سود (زیان) خالص", 7250000, 3319076],
    ].forEach((row) => income.addRow(row));
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());

    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "wc-1402.xlsx", format: "XLSX", contentBase64: bytes.toString("base64") }),
    });
    expect(ingested.status).toBe(201);
    const sha256 = (await ingested.json()).evidence.sha256;

    const analysis = await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    expect(analysis.status).toBe(200);

    const insightsRes = await request("/api/financial/insights", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    expect(insightsRes.status).toBe(200);
    const insights = await insightsRes.json();
    expect(insights.statementInsight.workingCapital).toBeTruthy();
    expect(insights.statementInsight.ratios.quickRatio).toBeCloseTo((31107024 - 10482503) / 17279237, 6);
    expect(insights.statementInsight.coverage.interestCoverage).toBeCloseTo(4708096 / 44193, 4);

    const assistant = await request("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ question: "مهم‌ترین ریسک مالی چیست؟" }),
    });
    expect(assistant.status).toBe(200);
    const body = await assistant.json();
    expect(body.response.intent).toBe("RISK");
    expect(body.answer).toContain("چرخه تبدیل نقد");
    expect(/\b(cashConversionCycle|interestCoverage|workingCapital|netProfit)\b/.test(body.answer)).toBe(false);
  });
});

/* ------------------------------------------------------------------------- *
 * Real benchmark (123.xlsx) — runs when the user file is present.
 * ------------------------------------------------------------------------- */
const findRealXlsx = (): string | undefined => {
  if (process.env.HOOSHYAR_REAL_XLSX) return process.env.HOOSHYAR_REAL_XLSX;
  const desktop = "C:\\Users\\avalipour\\Desktop";
  try {
    for (const entry of readdirSync(desktop, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = `${desktop}\\${entry.name}\\123.xlsx`;
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // No Desktop access in this environment: the real-file test stays skipped.
  }
  return undefined;
};

const REAL_XLSX = findRealXlsx();

( REAL_XLSX && existsSync(REAL_XLSX) ? describe : describe.skip )("real 123.xlsx deep integration", () => {
  test("preserves working-capital detail and derives the canonical cycle and DuPont", async () => {
    const store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const adapter = new FinancialDataIngestionAdapter(store);
    const result = await adapter.ingestXlsx("real-tenant", "123.xlsx", readFileSync(REAL_XLSX as string));
    const document = result.model.document!;
    const derived = deriveAnalysisInput(document);

    // Exact canonical detail from the real statement (million Rial).
    expect(derived.statement.cash).toBe(1_039_231 * M);
    expect(derived.statement.receivables).toBe(7_822_945 * M);
    expect(derived.statement.inventory).toBe(10_482_503 * M);
    expect(derived.statement.payables).toBe(14_429_397 * M);
    expect(derived.statement.interest).toBe(44_193 * M);

    const analytics = new FinancialAnalyticsService().execute({
      tenantId: "real-tenant",
      statement: derived.statement,
      priorStatement: derivePriorStatement(document),
    });
    // Quick/cash liquidity were previously structurally unavailable.
    expect(analytics.ratios?.liquidity?.quickRatio).toBeCloseTo((31_107_024 - 10_482_503) / 17_279_237, 6);
    expect(analytics.ratios?.liquidity?.cashRatio).toBeCloseTo(1_039_231 / 17_279_237, 6);
    // Working-capital cycle from the canonical engine.
    expect(analytics.ratios?.workingCapital?.receivablesDays).toBeCloseTo((7_822_945 / 32_129_418) * 365, 4);
    expect(analytics.ratios?.workingCapital?.inventoryDays).toBeCloseTo((10_482_503 / 27_093_243) * 365, 4);
    // Interest coverage and DuPont ROE.
    expect(analytics.ratios?.coverage?.interestCoverage).toBeCloseTo(4_708_096 / 44_193, 4);
    expect(analytics.ratios?.duPont?.roe).toBeCloseTo(7_250_000 / 14_836_839, 6);
  });
});
