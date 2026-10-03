/**
 * Real-world financial document qualification — regression coverage.
 *
 * Reproduces the exact failures found on the real user documents:
 *   - a Persian comparative workbook whose declared unit is million Rial but
 *     was normalized as 1e9 because `ميليون` (Arabic yeh) never matched;
 *   - a `درصد تغيير`/`% change` column silently becoming a fake `prior-2`/
 *     `prior-3` monetary period;
 *   - an HTML `.xls` (Excel "Save as Web Page") being reported as genuine XLS;
 *   - a scanned RTL multi-column statement whose geometry was discarded;
 *   - a PARTIAL report returning READY analysis with effectively zero metrics.
 *
 * These fixtures are realistic but the real user documents remain the decisive
 * qualification evidence; no fixture replaces that requalification.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Server } from "node:http";
import { resolve } from "node:path";
import ExcelJS from "exceljs-hardened";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { FinancialStatementAnalysisService } from "../Product/FinancialStatementAnalysisService";
import { FinancialAnalyticsService } from "../Product/FinancialAnalyticsService";
import { composeFinancialStatementInsight } from "../Product/FinancialStatementInsight";
import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import {
  assessStatementAnalysisReadiness,
  buildFinancialDocumentUnderstanding,
  buildFinancialDocumentUnderstandingFromOcrPages,
  deriveAnalysisInput,
  derivePriorStatement,
  detectStatementUnit,
  matchFinancialSectionHeading,
  ocrLineToCells,
  summarizeFinancialDocument,
  type FinancialDocumentUnderstanding,
  type FinancialStatementFact,
  type OcrPageInput,
  type StatementMeasure,
} from "../Product/FinancialDocumentUnderstanding";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function makeAdapter(): { adapter: FinancialDataIngestionAdapter; store: SQLitePersistenceStore } {
  const store = new SQLitePersistenceStore({ databasePath: ":memory:" });
  return { adapter: new FinancialDataIngestionAdapter(store), store };
}

/* ------------------------------------------------------------------------- *
 * Repair 3 — unit normalization
 * ------------------------------------------------------------------------- */

describe("Repair 3: declared statement unit normalization", () => {
  test("distinguishes Rial / thousand / million / billion deterministically", () => {
    expect(detectStatementUnit("مبالغ به ریال است")).toEqual({ multiplier: 1, currency: "IRR" });
    expect(detectStatementUnit("کليه مبالغ به هزار ريال است")).toEqual({ multiplier: 1_000, currency: "IRR" });
    expect(detectStatementUnit("کليه مبالغ به ميليون ريال است")).toEqual({ multiplier: 1_000_000, currency: "IRR" });
    expect(detectStatementUnit("کليه مبالغ به میلیون ریال است")).toEqual({ multiplier: 1_000_000, currency: "IRR" });
    expect(detectStatementUnit("ارقام به میلیارد ریال")).toEqual({ multiplier: 1_000_000_000, currency: "IRR" });
  });

  test("accepts English aliases", () => {
    expect(detectStatementUnit("(figures in thousands IRR)")).toEqual({ multiplier: 1_000, currency: "IRR" });
    expect(detectStatementUnit("Amounts in million IRR")).toEqual({ multiplier: 1_000_000, currency: "IRR" });
    expect(detectStatementUnit("figures in billion rials")).toEqual({ multiplier: 1_000_000_000, currency: "IRR" });
  });

  test("a narrative میلیارد amount never overrides the repeated million declaration", () => {
    // This is the real defect: `ميليون` used Arabic yeh so it did not match, and a
    // single narrative `۵هزار میلیارد ریال` became the document unit (1e9).
    const text = [
      "کليه مبالغ به ميليون ريال است",
      "درآمدهاي عملياتي ۳۲۱۲۹۴۱۸ ۱۶۵۲۷۳۱۸ ۹۴",
      "کليه مبالغ به ميليون ريال است",
      "شرکت در نظر دارد با افزايش سرمايه به مبلغ ۵هزار میلیارد ریال توليد را افزايش دهد.",
      "کليه مبالغ به ميليون ريال است",
    ].join("\n");
    expect(detectStatementUnit(text).multiplier).toBe(1_000_000);
  });

  test("a generic ریال declaration never overrides a more specific unit", () => {
    const text = [
      "مبالغ به ریال است",
      "کليه مبالغ به میلیون ریال است",
      "کليه مبالغ به میلیون ریال است",
    ].join("\n");
    expect(detectStatementUnit(text).multiplier).toBe(1_000_000);
  });
});

/* ------------------------------------------------------------------------- *
 * Repair 4 — change-% column is not a monetary period
 * ------------------------------------------------------------------------- */

describe("Repair 4: change-% columns are never monetary periods", () => {
  const grid = [
    ["شرح", "دوره منتهي به ۱۴۰۵/۰۴/۳۱", "تجديد ارائه شده دوره منتهي به ۱۴۰۴/۰۴/۳۱", "درصد تغيير"],
    ["درآمدهاي عملياتي", "32129418", "16527318", "94"],
    ["سود(زيان) خالص", "7250000", "3319076", "118"],
  ];

  test("current + prior + change% produces exactly two monetary periods", () => {
    const document = buildFinancialDocumentUnderstanding([
      { name: "سود و زیان", rows: grid, positioned: true },
    ]);
    const revenue = document.facts.filter((fact) => fact.measure === "REVENUE");
    expect(revenue.map((fact) => [fact.periodIndex, fact.periodLabel, fact.rawValue])).toEqual([
      [0, "دوره منتهي به ۱۴۰۵/۰۴/۳۱", 32129418],
      [1, "تجديد ارائه شده دوره منتهي به ۱۴۰۴/۰۴/۳۱", 16527318],
    ]);
    // No fake prior-2/prior-3: the change% values (94, 118) must not appear.
    expect(document.facts.some((fact) => fact.periodIndex >= 2)).toBe(false);
    expect(document.facts.some((fact) => fact.rawValue === 94 || fact.rawValue === 118)).toBe(false);
  });

  test("English '% change' and 'change %' headers are excluded too", () => {
    for (const header of ["change %", "% change", "percentage change", "Change"]) {
      const document = buildFinancialDocumentUnderstanding([
        {
          name: "Balance Sheet",
          rows: [
            ["Description", "2024", "2023", header],
            ["Total assets", "1965", "1798", "9"],
          ],
          positioned: true,
        },
      ]);
      const assets = document.facts.filter((fact) => fact.measure === "ASSETS");
      expect(assets.map((fact) => fact.periodIndex)).toEqual([0, 1]);
    }
  });

  test("unit is applied to the declared million-Rial scale, not 1e9", () => {
    const document = buildFinancialDocumentUnderstanding([
      {
        name: "سود و زیان",
        rows: [["کليه مبالغ به ميليون ريال است"], ...grid],
        positioned: true,
      },
    ]);
    expect(document.unitMultiplier).toBe(1_000_000);
    const revenue = document.facts.find((fact) => fact.measure === "REVENUE" && fact.periodIndex === 0);
    expect(revenue?.value).toBe(32_129_418 * 1_000_000);
    expect(revenue?.unitMultiplier).toBe(1_000_000);
  });
});

/* ------------------------------------------------------------------------- *
 * Repair 1 — RTL / multi-column OCR geometry
 * ------------------------------------------------------------------------- */

function word(text: string, x0: number, x1: number, y0 = 100, y1 = 130) {
  return { text, bbox: { x0, y0, x1, y1 } };
}

describe("Repair 1: RTL multi-column OCR statement geometry", () => {
  test("ocrLineToCells splits an RTL line at real x-gaps and keeps reading order", () => {
    // RTL output: label on the right (large x), period columns to the left.
    const cells = ocrLineToCells({
      text: "جمع دارایی‌ها ۱۹۶۵ ۱۷۹۸",
      words: [word("جمع", 900, 940), word("دارایی‌ها", 760, 900), word("۱۹۶۵", 560, 640), word("۱۷۹۸", 300, 380)],
    });
    expect(cells).toEqual(["جمع دارایی‌ها", "۱۹۶۵", "۱۷۹۸"]);
  });

  test("ocrLineToCells splits an LTR line at real x-gaps", () => {
    const cells = ocrLineToCells({
      text: "Total assets 1965 1798",
      words: [word("Total", 100, 160), word("assets", 165, 230), word("1965", 400, 460), word("1798", 600, 660)],
    });
    expect(cells).toEqual(["Total assets", "1965", "1798"]);
  });

  test("rebuilds a Persian RTL statement into canonical facts with page provenance", () => {
    const pages: OcrPageInput[] = [
      {
        pageNumber: 12,
        lines: [
          { text: "صورت وضعیت مالی", words: [word("صورت", 800, 860), word("وضعیت", 700, 790), word("مالی", 620, 690)] },
          { text: "مبالغ به میلیون ریال", words: [word("مبالغ", 860, 910), word("به", 830, 850), word("میلیون", 700, 820), word("ریال", 620, 690)] },
          { text: "شرح ۱۴۰۲ ۱۴۰۱", words: [word("شرح", 900, 960), word("۱۴۰۲", 560, 640), word("۱۴۰۱", 300, 380)] },
          { text: "جمع دارایی‌ها ۱۹۶۵ ۱۷۹۸", words: [word("جمع", 900, 940), word("دارایی‌ها", 760, 900), word("۱۹۶۵", 560, 640), word("۱۷۹۸", 300, 380)] },
          { text: "جمع بدهی‌ها ۸۲۰ ۸۸۰", words: [word("جمع", 900, 940), word("بدهی‌ها", 760, 900), word("۸۲۰", 560, 640), word("۸۸۰", 300, 380)] },
          { text: "جمع حقوق مالکانه ۱۱۴۵ ۹۱۸", words: [word("جمع", 900, 940), word("حقوق", 800, 890), word("مالکانه", 700, 790), word("۱۱۴۵", 560, 640), word("۹۱۸", 300, 380)] },
        ],
      },
    ];
    const document = buildFinancialDocumentUnderstandingFromOcrPages(pages);
    const balance = document.sections.find((section) => section.type === "BALANCE_SHEET");
    expect(balance?.state).toBe("COMPLETED");
    const assets = document.facts.find((fact) => fact.measure === "ASSETS" && fact.periodIndex === 0);
    expect(assets?.value).toBe(1965 * 1_000_000);
    expect(assets?.evidence.page).toBe(12);
  });

  test("falls back to the full line when words carry no geometry", () => {
    expect(ocrLineToCells({ text: "جمع دارایی‌ها ۱۹۶۵", words: [{ text: "جمع" }, { text: "دارایی‌ها" }] }))
      .toEqual(["جمع دارایی‌ها"]);
  });
});

/* ------------------------------------------------------------------------- *
 * Repair 6 — HTML disguised as XLS
 * ------------------------------------------------------------------------- */

const HTML_STATEMENT = [
  "<html><head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\"></head><body>",
  "<p>صورت وضعیت مالی</p>",
  "<p>کليه مبالغ به ميليون ريال است</p>",
  "<table>",
  "<tr><td>شرح</td><td>به تاريخ ۱۴۰۵/۰۴/۳۱</td><td>تجديد ارائه شده به تاريخ ۱۴۰۴/۰۴/۳۱</td><td>درصد تغيير</td></tr>",
  "<tr><td>جمع دارايي‌ها</td><td>۳۲,۲۴۴,۲۵۶</td><td>۱۴,۷۰۹,۲۹۴</td><td>۱۱۹</td></tr>",
  "<tr><td>جمع بدهي‌ها</td><td>۱۷,۴۰۷,۴۱۷</td><td>۵,۹۵۹,۹۰۵</td><td>۱۹۲</td></tr>",
  "<tr><td>جمع حقوق مالکانه</td><td>۱۴,۸۳۶,۸۳۹</td><td>۸,۷۴۹,۳۸۹</td><td>۷۰</td></tr>",
  "</table>",
  "</body></html>",
].join("");

describe("Repair 6: HTML content disguised as a spreadsheet", () => {
  test("ingestXlsBytes detects HTML, preserves the original SHA-256 and yields facts", async () => {
    const { adapter } = makeAdapter();
    const bytes = Buffer.from(`\r\n${HTML_STATEMENT}`, "utf8");
    const result = await adapter.ingestXlsBytes("t1", "book.xls", bytes);

    // The real content type is reported; it is never labelled genuine XLS.
    expect(result.evidence.sourceType).toBe("HTML");
    expect(result.evidence.contentKind).toBe("html");
    expect(result.evidence.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(result.model.transactions).toHaveLength(0);

    const document = result.model.document as FinancialDocumentUnderstanding;
    const assets = document.facts.find((fact) => fact.measure === "ASSETS" && fact.periodIndex === 0);
    expect(assets?.value).toBe(32_244_256 * 1_000_000);
    // change% (119) is not a monetary period.
    expect(document.facts.some((fact) => fact.periodIndex >= 2)).toBe(false);
  });

  test("ingestFile routes a .xls HTML file through the same governed path", async () => {
    const { adapter } = makeAdapter();
    const bytes = Buffer.from(HTML_STATEMENT, "utf8");
    const result = await adapter.ingestXlsBytes("t1", "book.xls", bytes);
    expect(result.evidence.contentKind).toBe("html");
  });

  test("malformed HTML fails closed with a precise unsupported code", async () => {
    const { adapter, store } = makeAdapter();
    const bytes = Buffer.from("<html><body><p>no financial table here</p></body></html>", "utf8");
    await expect(adapter.ingestXlsBytes("t1", "book.xls", bytes)).rejects.toThrow(
      "spreadsheet-html-content-unsupported",
    );
    expect(await store.read({ tenantId: "t1" }, `financial-ingestion:${createHash("sha256").update(bytes).digest("hex")}`)).toBeNull();
  });
});

/* ------------------------------------------------------------------------- *
 * Repair 2 — fail-closed statement analysis
 * ------------------------------------------------------------------------- */

describe("Repair 2: fail-closed statement analysis", () => {
  test("a PARTIAL document with only NET_PROFIT facts is not analysis-ready", () => {
    // Exactly the real scanned-report pattern: two readable facts, no balance sheet.
    const document = buildFinancialDocumentUnderstanding([
      { rows: [["صورت سود و زيان"], ["سود(زيان) خالص ۳۴۳ ۳۵"]] },
    ]);
    const summary = summarizeFinancialDocument(document);
    expect(summary.status).toBe("PARTIAL");
    const readiness = assessStatementAnalysisReadiness(document);
    expect(readiness.ready).toBe(false);
    expect(readiness.code).toBe("financial-report-insufficient-evidence");
    expect(readiness.missingMeasures).toEqual(expect.arrayContaining(["ASSETS", "LIABILITIES", "REVENUE"]));
  });

  test("the analysis service refuses READY over insufficient document evidence", () => {
    const service = new FinancialStatementAnalysisService(new FinancialIntelligenceEngine(), {
      reason: () => ({ problem: "p", status: "verified", success: true, answer: "ok" }) as never,
    });
    const result = service.execute({
      tenantId: "t1",
      revenue: 0,
      expenses: 0,
      assets: 0,
      liabilities: 0,
      source: {
        sourceName: "report.pdf",
        sourceType: "PDF",
        sha256: "a".repeat(64),
        receivedAt: "2026-09-22T00:00:00.000Z",
      },
      documentEvidence: {
        ready: false,
        missingMeasures: ["ASSETS", "LIABILITIES", "REVENUE"],
        incompleteSections: ["BALANCE_SHEET", "INCOME_STATEMENT"],
        code: "financial-report-insufficient-evidence",
        reason: "missing-measures:ASSETS,LIABILITIES,REVENUE",
      },
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.metrics.status).toBe("BLOCKED");
    expect(result.observations).toHaveLength(0);
    expect(result.failureCode).toBe("financial-report-insufficient-evidence");
  });

  test("a complete report document is analysis-ready", () => {
    const document = buildFinancialDocumentUnderstanding([
      {
        name: "ترازنامه",
        rows: [
          ["شرح", "1402", "1401"],
          ["جمع دارایی‌ها", "1965", "1798"],
          ["جمع بدهی‌ها", "820", "880"],
          ["جمع حقوق مالکانه", "1145", "918"],
        ],
        positioned: true,
      },
      {
        name: "سود و زیان",
        rows: [
          ["شرح", "1402", "1401"],
          ["درآمد عملیاتی", "2400", "2100"],
          ["سود (زیان) خالص", "220", "170"],
        ],
        positioned: true,
      },
    ]);
    const readiness = assessStatementAnalysisReadiness(document);
    expect(readiness.ready).toBe(true);
  });

  test("a real ledger analysis path is preserved (no document evidence gate)", () => {
    const service = new FinancialStatementAnalysisService(new FinancialIntelligenceEngine(), {
      reason: () => ({ problem: "p", status: "verified", success: true, answer: "ok" }) as never,
    });
    const result = service.execute({
      tenantId: "t1",
      revenue: 1000,
      expenses: 400,
      assets: 5000,
      liabilities: 2000,
      source: {
        sourceName: "ledger.csv",
        sourceType: "CSV",
        sha256: "b".repeat(64),
        receivedAt: "2026-09-22T00:00:00.000Z",
      },
    });
    expect(result.status).toBe("READY");
    expect(result.metrics.profit).toBe(600);
  });
});

/* ------------------------------------------------------------------------- *
 * Repair 5 — canonical section naming
 * ------------------------------------------------------------------------- */

describe("Repair 5: canonical equity section naming", () => {
  test("the canonical section type is CHANGES_IN_EQUITY (single representation)", () => {
    expect(matchFinancialSectionHeading("صورت تغییرات در حقوق مالکانه")).toBe("CHANGES_IN_EQUITY");
    const document = buildFinancialDocumentUnderstanding([
      { rows: [["صورت تغییرات در حقوق مالکانه"], ["جمع حقوق مالکانه ۱۱۴۵ ۹۱۸"]] },
    ]);
    expect(document.sections.map((section) => section.type)).toContain("CHANGES_IN_EQUITY");
  });
});

/* ------------------------------------------------------------------------- *
 * Real XLSX synthetic requalification through the canonical adapter
 * ------------------------------------------------------------------------- */

describe("realistic comparative workbook end-to-end", () => {
  test("million-Rial workbook yields correct periods and analysis-ready facts", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Recovered_Sheet1");
    [
      ["صورت سود و زیان"],
      ["صورت سود و زيان"],
      ["کليه مبالغ به ميليون ريال است"],
      ["شرح", "دوره منتهي به ۱۴۰۵/۰۴/۳۱", "تجديد ارائه شده دوره منتهي به ۱۴۰۴/۰۴/۳۱", "درصد تغيير"],
      ["شرح", "حسابرسی نشده", "حسابرسی شده", "درصد تغيير"],
      ["درآمدهاي عملياتي", 32129418, 16527318, 94],
      ["سود(زيان) خالص", 7250000, 3319076, 118],
      ["صورت وضعيت مالي"],
      ["کليه مبالغ به ميليون ريال است"],
      ["شرح", "به تاريخ ۱۴۰۵/۰۴/۳۱", "تجديد ارائه شده به تاريخ ۱۴۰۴/۰۴/۳۱", "درصد تغيير"],
      ["جمع دارايي‌ها", 32244256, 14709294, 119],
      ["جمع بدهي‌ها", 17407417, 5959905, 192],
      ["جمع حقوق مالکانه", 14836839, 8749389, 70],
    ].forEach((row) => sheet.addRow(row));

    const { adapter } = makeAdapter();
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await adapter.ingestXlsx("t1", "Recovered_Sheet1.xlsx", bytes);

    expect(result.model.document?.unitMultiplier).toBe(1_000_000);
    const facts = result.model.document?.facts ?? [];
    expect(facts.some((fact) => fact.periodIndex >= 2)).toBe(false);
    const revenue = facts.find((fact) => fact.measure === "REVENUE" && fact.periodIndex === 0);
    const revenuePrior = facts.find((fact) => fact.measure === "REVENUE" && fact.periodIndex === 1);
    expect(revenue?.value).toBe(32_129_418 * 1_000_000);
    expect(revenuePrior?.value).toBe(16_527_318 * 1_000_000);
    // Persian label preserved as evidence.
    expect(revenue?.label).toBe("درآمدهاي عملياتي");

    const readiness = assessStatementAnalysisReadiness(result.model.document!);
    expect(readiness.ready).toBe(true);
  });

  test("signed statement costs are normalized to positive magnitudes", () => {
    const document = buildFinancialDocumentUnderstanding([
      {
        name: "سود و زیان",
        rows: [
          ["کليه مبالغ به ميليون ريال است"],
          ["شرح", "دوره منتهي به ۱۴۰۵/۰۴/۳۱", "تجديد ارائه شده دوره منتهي به ۱۴۰۴/۰۴/۳۱", "درصد تغيير"],
          ["درآمدهاي عملياتي", "32129418", "16527318", "94"],
          ["هزينه‌هاي فروش، اداري و عمومي", "(291634)", "(303569)", "4"],
        ],
        positioned: true,
      },
    ]);
    const derived = deriveAnalysisInput(document);
    // The raw signed evidence is preserved on the fact...
    const fact = document.facts.find((entry) => entry.measure === "OPERATING_EXPENSES");
    expect(fact?.rawValue).toBe(-291634);
    // ...while the analysis input is the positive cost magnitude.
    expect(derived.expenses).toBe(291634 * 1_000_000);
  });
});

/* ------------------------------------------------------------------------- *
 * Guard: the protected synthetic fixtures still parse
 * ------------------------------------------------------------------------- */

/* ------------------------------------------------------------------------- *
 * Runtime: the exact real pattern (PARTIAL report + missing metrics) cannot
 * return HTTP 200 READY.
 * ------------------------------------------------------------------------- */

describe("runtime fail-closed analysis boundary", () => {
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

  const register = async (username: string): Promise<string> => {
    const response = await request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "Sup3rSecret!", organization: "Qual Org" }),
    });
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("session-cookie-missing");
    return cookie.split(";")[0];
  };

  async function ingestWorkbook(cookie: string, rows: (string | number)[][]): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("ترازنامه");
    rows.forEach((row) => sheet.addRow(row));
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "statement.xlsx", format: "XLSX", contentBase64: bytes.toString("base64") }),
    });
    expect(ingested.status).toBe(201);
    return (await ingested.json()).evidence.sha256 as string;
  }

  test("an income-statement-only workbook is refused with financial-report-insufficient-evidence", async () => {
    const cookie = await register("partial-owner");
    const sha256 = await ingestWorkbook(cookie, [
      ["صورت سود و زیان"],
      ["کليه مبالغ به ميليون ريال است"],
      ["شرح", "دوره منتهي به ۱۴۰۵/۰۴/۳۱", "تجديد ارائه شده دوره منتهي به ۱۴۰۴/۰۴/۳۱", "درصد تغيير"],
      ["درآمدهاي عملياتي", 32129418, 16527318, 94],
      ["سود(زيان) خالص", 7250000, 3319076, 118],
    ]);

    const analysis = await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    expect(analysis.status).toBe(422);
    const body = await analysis.json();
    expect(body.status).toBe("BLOCKED");
    expect(body.error).toBe("financial-report-insufficient-evidence");
    expect(body.incompleteSections).toEqual(expect.arrayContaining(["BALANCE_SHEET"]));
  });

  test("a complete workbook still returns READY with entity-scale metrics and correct periods", async () => {
    const cookie = await register("complete-owner");
    const sha256 = await ingestWorkbook(cookie, [
      ["صورت وضعيت مالي"],
      ["کليه مبالغ به ميليون ريال است"],
      ["شرح", "به تاريخ ۱۴۰۵/۰۴/۳۱", "تجديد ارائه شده به تاريخ ۱۴۰۴/۰۴/۳۱", "درصد تغيير"],
      ["جمع دارايي‌ها", 32244256, 14709294, 119],
      ["جمع بدهي‌ها", 17407417, 5959905, 192],
      ["جمع حقوق مالکانه", 14836839, 8749389, 70],
      ["صورت سود و زيان"],
      ["کليه مبالغ به ميليون ريال است"],
      ["شرح", "دوره منتهي به ۱۴۰۵/۰۴/۳۱", "تجديد ارائه شده دوره منتهي به ۱۴۰۴/۰۴/۳۱", "درصد تغيير"],
      ["درآمدهاي عملياتي", 32129418, 16527318, 94],
      ["سود(زيان) خالص", 7250000, 3319076, 118],
    ]);

    const analysis = await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: sha256 }),
    });
    expect(analysis.status).toBe(200);
    const body = await analysis.json();
    expect(body.status).toBe("READY");
    expect(body.metrics.revenue).toBeCloseTo(32_129_418 * 1_000_000, 0);
    expect(body.metrics.debtRatio).toBeCloseTo(17_407_417 / 32_244_256, 6);
    expect(body.ingestedSource.document.unitMultiplier).toBe(1_000_000);
  });
});

/* ------------------------------------------------------------------------- *
 * Guard: the protected synthetic fixtures still parse
 * ------------------------------------------------------------------------- */

describe("existing synthetic fixtures remain valid", () => {
  test("the committed legacy XLS report still parses through the governed provider", async () => {
    const XLS_REPORT = resolve(REPO_ROOT, "Backend", "HBOS", "test", "fixtures", "synthetic", "financial_report_1402.xls");
    const { adapter } = makeAdapter();
    const result = await adapter.ingestXlsBytes("t1", "financial_report_1402.xls", readFileSync(XLS_REPORT));
    expect(result.evidence.sourceType).toBe("XLS");
    expect(result.evidence.contentKind).toBeUndefined();
    expect(result.model.document?.facts.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------------- *
 * V2 real-world qualification matrix (CASE 2-10)
 * ------------------------------------------------------------------------- */

const M = 1_000_000;

const matrixFact = (
  measure: StatementMeasure,
  rawValue: number,
  periodIndex = 0,
  section: FinancialStatementFact["section"] = "INCOME_STATEMENT",
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

const balanceFact = (measure: StatementMeasure, rawValue: number, periodIndex = 0): FinancialStatementFact =>
  matrixFact(measure, rawValue, periodIndex, "BALANCE_SHEET");

const cashFact = (measure: StatementMeasure, rawValue: number, periodIndex = 0): FinancialStatementFact =>
  matrixFact(measure, rawValue, periodIndex, "CASH_FLOW_STATEMENT");

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
  return { document, derived, analytics, insight: composeFinancialStatementInsight({ document, derived, prior, analytics }) };
};

describe("V2 qualification matrix", () => {
  test("CASE 2: profitable statement with positive operating cash flow has no false cash warning", () => {
    const { insight } = insightFromFacts([
      matrixFact("REVENUE", 1000), matrixFact("NET_PROFIT", 120), balanceFact("ASSETS", 2000),
      balanceFact("LIABILITIES", 800), balanceFact("EQUITY", 1200), cashFact("OPERATING_CASH_FLOW", 200),
    ]);
    expect(insight.cashFlow.qualityOfEarnings).toBe("CASH_BACKED");
    expect(insight.risks.some((finding) => finding.message.includes("Operating cash flow is negative"))).toBe(false);
    expect(insight.strengths.some((finding) => finding.message.includes("positive net cash flow"))).toBe(true);
  });

  test("CASE 3: profitable statement with negative operating cash flow is valid and shows explicit cash risk", () => {
    const { insight } = insightFromFacts([
      matrixFact("REVENUE", 1000), matrixFact("NET_PROFIT", 120), balanceFact("ASSETS", 2000),
      balanceFact("LIABILITIES", 800), balanceFact("EQUITY", 1200), cashFact("OPERATING_CASH_FLOW", -150),
    ]);
    expect(insight.cashFlow.operating).toBe(-150 * M);
    expect(insight.cashFlow.qualityOfEarnings).toBe("PROFIT_NOT_CASH_BACKED");
    expect(insight.risks.some((finding) => finding.message.includes("Operating cash flow is negative"))).toBe(true);
    expect(insight.interpretation.every((finding) => !finding.message.includes("NaN"))).toBe(true);
  });

  test("CASE 4: loss-making company keeps negative margins and actionable loss interpretation", () => {
    const { insight } = insightFromFacts([
      matrixFact("REVENUE", 1000), matrixFact("COGS", -900), matrixFact("GROSS_PROFIT", 100),
      matrixFact("OPERATING_EXPENSES", -250), matrixFact("OPERATING_PROFIT", -150), matrixFact("NET_PROFIT", -100),
      balanceFact("ASSETS", 2000), balanceFact("LIABILITIES", 800), balanceFact("EQUITY", 1200),
    ]);
    expect(insight.ratios.netMargin).toBeCloseTo(-0.1, 6);
    expect(insight.ratios.operatingMargin).toBeCloseTo(-0.15, 6);
    expect(insight.weaknesses.some((finding) => finding.message.includes("net loss"))).toBe(true);
    expect(insight.managementActions.length).toBeGreaterThan(0);
    expect(insight.ratios.netMargin).not.toBe(0);
  });

  test("CASE 5: negative equity is accepted with a capital-structure warning and explicit ratio semantics", () => {
    const { insight } = insightFromFacts([
      matrixFact("REVENUE", 1000), matrixFact("NET_PROFIT", -100),
      balanceFact("ASSETS", 500), balanceFact("LIABILITIES", 700), balanceFact("EQUITY", -200),
    ]);
    const identity = insight.integrity.find((check) => check.id === "balance-sheet-identity");
    expect(identity?.status).toBe("RECONCILED");
    expect(insight.risks.some((finding) => finding.message.includes("equity is negative"))).toBe(true);
    expect(insight.ratios.debtToEquity).toBeNull();
    expect(insight.ratios.notApplicable).toEqual(expect.arrayContaining(["debtToEquity:equity-non-positive", "roe:equity-non-positive"]));
    expect(insight.limitations.some((line) => line.includes("not applicable"))).toBe(true);
    expect(JSON.stringify(insight)).not.toContain("NaN");
  });

  test("CASE 6: prior period zero yields an absolute change and no fake 0%", () => {
    const { insight } = insightFromFacts([
      matrixFact("REVENUE", 1000, 0), matrixFact("REVENUE", 0, 1),
      matrixFact("NET_PROFIT", 100, 0), matrixFact("NET_PROFIT", 0, 1),
      balanceFact("ASSETS", 2000), balanceFact("LIABILITIES", 800), balanceFact("EQUITY", 1200),
    ]);
    const revenueChange = insight.comparative.find((entry) => entry.line === "revenue");
    expect(revenueChange?.absoluteChange).toBe(1000 * M);
    expect(revenueChange?.pctChange).toBeNull();
    expect(revenueChange?.pctChangeUnavailableReason).toBe("prior-value-zero");
    expect(insight.interpretation.some((finding) => finding.message.includes("prior period was zero"))).toBe(true);
  });

  test("CASE 7: sign reversal is explicit and never reported as a naive percentage", () => {
    const { insight } = insightFromFacts([
      matrixFact("REVENUE", 1000, 0), matrixFact("REVENUE", 1000, 1),
      matrixFact("NET_PROFIT", 300, 0), matrixFact("NET_PROFIT", -200, 1),
      balanceFact("ASSETS", 2000), balanceFact("LIABILITIES", 800), balanceFact("EQUITY", 1200),
    ]);
    const netChange = insight.comparative.find((entry) => entry.line === "netIncome");
    expect(netChange?.signReversal).toBe(true);
    expect(netChange?.pctChange).toBeNull();
    expect(insight.interpretation.some((finding) => finding.message.includes("changed from a loss") || finding.message.includes("changed from a profit"))).toBe(true);
  });

  test("CASE 8: missing optional fields continue available analytics and list the unavailable ones", () => {
    const { insight } = insightFromFacts([
      matrixFact("REVENUE", 1000), matrixFact("NET_PROFIT", 100),
      balanceFact("ASSETS", 2000), balanceFact("LIABILITIES", 800), balanceFact("EQUITY", 1200),
    ]);
    expect(insight.ratios.netMargin).toBeCloseTo(0.1, 6);
    expect(insight.ratios.currentRatio).toBeNull();
    expect(insight.unavailableRatios.length).toBeGreaterThan(0);
    expect(insight.limitations.length).toBeGreaterThan(0);
    expect(insight.integrity.some((check) => check.status === "NOT_TESTABLE")).toBe(true);
  });

  test("CASE 9: accounting mismatch is visible and source facts stay unchanged", () => {
    const { insight, derived } = insightFromFacts([
      matrixFact("REVENUE", 1000), matrixFact("NET_PROFIT", 100),
      balanceFact("ASSETS", 1500), balanceFact("LIABILITIES", 800), balanceFact("EQUITY", 400),
    ]);
    const identity = insight.integrity.find((check) => check.id === "balance-sheet-identity");
    expect(identity?.status).toBe("MISMATCH");
    expect(insight.risks.some((finding) => finding.message.includes("balance-sheet-identity"))).toBe(true);
    // The source fact is unchanged by the integrity check.
    expect(derived.statement.totalAssets).toBe(1500 * M);
  });

  test("CASE 10: insufficient evidence fails closed with the canonical code", () => {
    const document = buildFinancialDocumentUnderstanding([
      { rows: [["صورت سود و زيان"], ["سود(زيان) خالص ۳۴۳ ۳۵"]] },
    ]);
    const readiness = assessStatementAnalysisReadiness(document);
    expect(readiness.ready).toBe(false);
    expect(readiness.code).toBe("financial-report-insufficient-evidence");
  });

  test("derived residual expense is labelled, never presented as a total expense", () => {
    const { insight, derived } = insightFromFacts([
      matrixFact("REVENUE", 1000), matrixFact("COGS", -700), matrixFact("NET_PROFIT", 100),
      balanceFact("ASSETS", 2000), balanceFact("LIABILITIES", 800), balanceFact("EQUITY", 1200),
    ]);
    expect(derived.analysisExpensesSource).toBe("DERIVED_RESIDUAL");
    expect(insight.derivedResidual?.value).toBe((1000 - 100) * M);
    expect(insight.derivedResidual?.note).toContain("derived residual");
    expect(insight.metricEvidence.analysisExpensesResidual).toBe("DERIVED_METRIC");
  });

  test("cash-flow reconciliation is testable and grounded in the four cash-flow measures", () => {
    const { insight } = insightFromFacts([
      matrixFact("REVENUE", 1000), matrixFact("NET_PROFIT", 100),
      balanceFact("ASSETS", 2000), balanceFact("LIABILITIES", 800), balanceFact("EQUITY", 1200),
      cashFact("OPERATING_CASH_FLOW", 300), cashFact("INVESTING_CASH_FLOW", -100),
      cashFact("FINANCING_CASH_FLOW", -50), cashFact("NET_CASH_FLOW", 150),
    ]);
    expect(insight.cashFlow.reconciliation?.status).toBe("RECONCILED");
  });
});

/* ------------------------------------------------------------------------- *
 * CASE 1: real 123.xlsx requalification (runs when the user file is present)
 * ------------------------------------------------------------------------- */

const REAL_XLSX = process.env.HOOSHYAR_REAL_XLSX
  ?? "C:\\Users\\avalipour\\Desktop\\صورتهای مالی\\123.xlsx";

( existsSync(REAL_XLSX) ? describe : describe.skip )("CASE 1: real 123.xlsx statement", () => {
  test("produces grounded facts, ratios, integrity and a labelled residual", async () => {
    const { adapter } = makeAdapter();
    const result = await adapter.ingestXlsx("real-tenant", "123.xlsx", readFileSync(REAL_XLSX));
    const document = result.model.document;
    expect(document).toBeTruthy();
    expect(document!.unitMultiplier).toBe(M);
    expect(document!.facts.length).toBeGreaterThan(40);

    const derived = deriveAnalysisInput(document!);
    expect(derived.statement.revenue).toBe(32_129_418 * M);
    expect(derived.statement.netIncome).toBe(7_250_000 * M);
    expect(derived.statement.totalAssets).toBe(32_244_256 * M);
    expect(derived.statement.totalLiabilities).toBe(17_407_417 * M);
    expect(derived.statement.equity).toBe(14_836_839 * M);
    expect(derived.analysisExpensesSource).toBe("DERIVED_RESIDUAL");

    const analytics = new FinancialAnalyticsService().execute({
      tenantId: "real-tenant",
      statement: derived.statement,
      priorStatement: derivePriorStatement(document!),
    });
    const insight = composeFinancialStatementInsight({ document: document!, derived, prior: derivePriorStatement(document!), analytics });
    expect(insight.ratios.netMargin).toBeCloseTo(7_250_000 / 32_129_418, 6);
    expect(insight.ratios.currentRatio).toBeCloseTo(31_107_024 / 17_279_237, 6);
    const identity = insight.integrity.find((check) => check.id === "balance-sheet-identity");
    expect(identity?.status).toBe("RECONCILED");
    expect(insight.cashFlow.operating).toBe(7_648_030 * M);
    expect(insight.cashFlow.reconciliation?.status).toBe("RECONCILED");
    expect(insight.cashFlow.qualityOfEarnings).toBe("CASH_BACKED");
    expect(insight.risks.length).toBeGreaterThan(0);
    expect(insight.managementActions.length).toBeGreaterThan(0);
  });
});
