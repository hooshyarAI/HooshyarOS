/**
 * Unified financial document understanding — focused tests.
 *
 * Proves the single boundary that PDF (native + OCR), XLSX and legacy XLS share:
 * section detection, statement fact normalization (Persian labels/digits/units,
 * comparative periods, parentheses negatives), ambiguity fail-closed behavior and
 * derivation of the existing analysis inputs. No fabricated fact is accepted.
 */
import {
  buildFinancialDocumentUnderstanding,
  deriveAnalysisInput,
  derivePriorStatement,
  detectStatementUnit,
  matchFinancialSectionHeading,
  matchStatementMeasure,
  normalizeStatementLabel,
  summarizeFinancialDocument,
  FINANCIAL_DOCUMENT_ERROR_CODES,
} from "../Product/FinancialDocumentUnderstanding";

/** Realistic multi-section annual report text (OCR-like single-space layout). */
const REPORT_TEXT = [
  "گزارش حسابرس مستقل",
  "به سهامداران شرکت نمونه",
  "ما صورت‌های مالی شرکت نمونه را برای سال مالی ۱۴۰۲ مورد رسیدگی قرار دادیم و اظهارنظر مقبول ارائه می‌کنیم.",
  "",
  "گزارش هیئت‌مدیره",
  "هیئت‌مدیره فعالیت‌های شرکت را در سال مالی ۱۴۰۲ به شرح زیر گزارش می‌کند.",
  "",
  "صورت وضعیت مالی",
  "(ارقام به میلیون ریال)",
  "شرح 1402 1401",
  "دارایی‌های جاری",
  "موجودی نقد ۱۲۵٬۰۰۰ ۹۸٬۰۰۰",
  "جمع دارایی‌های جاری 465,000 398,000",
  "جمع دارایی‌ها 1,965,000 1,798,000",
  "جمع بدهی‌ها 820,000 880,000",
  "جمع حقوق مالکانه 1,145,000 918,000",
  "",
  "صورت سود و زیان",
  "(ارقام به میلیون ریال)",
  "شرح 1402 1401",
  "درآمد عملیاتی 2,400,000 2,100,000",
  "بهای تمام‌شده کالای فروش رفته 1,600,000 1,400,000",
  "سود ناخالص 800,000 700,000",
  "هزینه‌های فروش، اداری و عمومی 430,000 400,000",
  "سود (زیان) عملیاتی 370,000 300,000",
  "سود (زیان) خالص 220,000 170,000",
  "",
  "صورت جریان‌های نقدی",
  "(ارقام به میلیون ریال)",
  "شرح 1402 1401",
  "جریان نقدی عملیاتی 310,000 250,000",
  "جریان نقدی سرمایه‌گذاری (۱۸۰٬۰۰۰) (۱۵۰٬۰۰۰)",
  "جریان نقدی تأمین مالی (۹۵٬۰۰۰) ۴۰٬۰۰۰",
  "",
  "یادداشت‌های توضیحی",
  "۱- واحد پول گزارش‌دهی ریال ایران است.",
].join("\n");

const reportDocument = () =>
  buildFinancialDocumentUnderstanding([{ rows: REPORT_TEXT.split("\n").map((line) => [line]) }]);

describe("section detection", () => {
  test("recognizes Persian and English report headings deterministically", () => {
    expect(matchFinancialSectionHeading("صورت وضعیت مالی")).toBe("BALANCE_SHEET");
    expect(matchFinancialSectionHeading("ترازنامه")).toBe("BALANCE_SHEET");
    expect(matchFinancialSectionHeading("Statement of Financial Position")).toBe("BALANCE_SHEET");
    expect(matchFinancialSectionHeading("صورت سود و زیان")).toBe("INCOME_STATEMENT");
    expect(matchFinancialSectionHeading("Statement of Profit or Loss")).toBe("INCOME_STATEMENT");
    expect(matchFinancialSectionHeading("صورت جریان‌های نقدی")).toBe("CASH_FLOW_STATEMENT");
    expect(matchFinancialSectionHeading("Cash Flow Statement")).toBe("CASH_FLOW_STATEMENT");
    expect(matchFinancialSectionHeading("گزارش حسابرس مستقل")).toBe("AUDITOR_REPORT");
    expect(matchFinancialSectionHeading("گزارش هیئت‌مدیره")).toBe("BOARD_REPORT");
    expect(matchFinancialSectionHeading("یادداشت‌های توضیحی")).toBe("NOTES");
  });

  test("a long narrative sentence is not mistaken for a heading", () => {
    expect(
      matchFinancialSectionHeading(
        "گزارش حسابرس مستقل در خصوص صورت‌های مالی شرکت با رعایت استانداردهای حسابرسی ایران به شرح زیر ارائه می‌گردد و شامل بندهای توضیحی متعدد است",
      ),
    ).toBeNull();
  });

  test("detects the real sections of a complete annual report", () => {
    const document = reportDocument();
    const types = document.sections.map((section) => section.type);
    expect(types).toEqual([
      "AUDITOR_REPORT",
      "BOARD_REPORT",
      "BALANCE_SHEET",
      "INCOME_STATEMENT",
      "CASH_FLOW_STATEMENT",
      "NOTES",
    ]);
  });

  test("narrative sections complete without failing the report", () => {
    const document = reportDocument();
    const auditor = document.sections.find((section) => section.type === "AUDITOR_REPORT");
    const board = document.sections.find((section) => section.type === "BOARD_REPORT");
    const notes = document.sections.find((section) => section.type === "NOTES");
    expect(auditor?.state).toBe("COMPLETED");
    expect(board?.state).toBe("COMPLETED");
    expect(notes?.state).toBe("COMPLETED");
    expect(auditor?.facts).toHaveLength(0);
  });
});

describe("units, currency and label mapping", () => {
  test("detects the declared statement unit and currency", () => {
    expect(detectStatementUnit("ارقام به میلیون ریال")).toEqual({ multiplier: 1_000_000, currency: "IRR" });
    expect(detectStatementUnit("ارقام به هزار ریال")).toEqual({ multiplier: 1_000, currency: "IRR" });
    expect(detectStatementUnit("ارقام به میلیارد ریال")).toEqual({ multiplier: 1_000_000_000, currency: "IRR" });
    expect(detectStatementUnit("مبالغ به تومان")).toEqual({ multiplier: 1, currency: "IRT" });
    expect(detectStatementUnit("(figures in million IRR)")).toEqual({ multiplier: 1_000_000, currency: "IRR" });
  });

  test("maps Persian labels, including OCR/punctuation variants", () => {
    expect(matchStatementMeasure("جمع دارایی‌ها")).toBe("ASSETS");
    expect(matchStatementMeasure("جمع دارایی های جاری")).toBe("CURRENT_ASSETS");
    expect(matchStatementMeasure("سود (زیان) خالص")).toBe("NET_PROFIT");
    expect(matchStatementMeasure("درآمد عملیاتی")).toBe("REVENUE");
    expect(matchStatementMeasure("هزینه‌های فروش، اداری و عمومی")).toBe("OPERATING_EXPENSES");
    expect(matchStatementMeasure("جریان نقدی تأمین مالی")).toBe("FINANCING_CASH_FLOW");
    expect(matchStatementMeasure("جمع دارایی‌ها ۵")).toBe("ASSETS");
    expect(matchStatementMeasure("سرفصل ناشناخته شرکت")).toBeNull();
  });

  test("normalizes labels without inventing a match", () => {
    expect(normalizeStatementLabel("سود (زیان) خالص")).toBe("سود زیان خالص");
    // Zero-width joiners are dropped so Persian spellings converge.
    expect(normalizeStatementLabel("«جمع داراییها»:")).toBe("جمع داراییها");
    expect(normalizeStatementLabel("Statement of Financial Position")).toBe("statement of financial position");
  });
});

describe("statement fact normalization", () => {
  test("extracts comparative-period facts with Persian digits, separators and parentheses", () => {
    const document = reportDocument();
    const facts = document.facts;
    const current = (measure: string) =>
      facts.find((fact) => fact.measure === measure && fact.periodIndex === 0);

    // Declared unit is million IRR, so values are scaled by 1e6.
    expect(current("ASSETS")?.value).toBe(1_965_000 * 1_000_000);
    expect(current("ASSETS")?.periodLabel).toBe("current");
    expect(current("LIABILITIES")?.value).toBe(820_000 * 1_000_000);
    expect(current("EQUITY")?.value).toBe(1_145_000 * 1_000_000);
    expect(current("REVENUE")?.value).toBe(2_400_000 * 1_000_000);
    expect(current("NET_PROFIT")?.value).toBe(220_000 * 1_000_000);
    expect(current("OPERATING_CASH_FLOW")?.value).toBe(310_000 * 1_000_000);
    // Parenthesised Persian-digit negative is a real sign, not a magnitude.
    expect(current("INVESTING_CASH_FLOW")?.value).toBe(-180_000 * 1_000_000);
    expect(current("FINANCING_CASH_FLOW")?.value).toBe(-95_000 * 1_000_000);
  });

  test("every fact keeps evidence, period and unit provenance", () => {
    const document = reportDocument();
    for (const fact of document.facts) {
      expect(fact.currency).toBe("IRR");
      expect(fact.unitMultiplier).toBe(1_000_000);
      expect(fact.label.length).toBeGreaterThan(0);
      expect(fact.evidence.line).toBeGreaterThan(0);
      expect(fact.evidence.text.length).toBeGreaterThan(0);
      expect(fact.confidence).toBeGreaterThan(0);
      expect(fact.confidence).toBeLessThanOrEqual(1);
    }
  });

  test("maps positioned spreadsheet grids to their exact period columns", () => {
    const sheet = [
      ["شرح", "1402", "1401"],
      ["جمع دارایی‌ها", "1965", "1798"],
      ["جمع بدهی‌ها", "820", "880"],
      ["جمع حقوق مالکانه", "1145", "918"],
    ];
    const document = buildFinancialDocumentUnderstanding([
      { name: "ترازنامه", rows: sheet, positioned: true },
    ]);
    const balance = document.sections.find((section) => section.type === "BALANCE_SHEET");
    expect(balance?.state).toBe("COMPLETED");
    const assets = document.facts.filter((fact) => fact.measure === "ASSETS");
    expect(assets.map((fact) => [fact.periodLabel, fact.periodIndex, fact.value])).toEqual([
      ["1402", 0, 1965],
      ["1401", 1, 1798],
    ]);
  });

  test("an unrecognized label never becomes a fact (never guesses)", () => {
    const document = buildFinancialDocumentUnderstanding([
      {
        name: "ترازنامه",
        rows: [
          ["شرح", "1402"],
          ["جمع دارایی‌ها", "1965"],
          ["سرفصل غیراستاندارد نامشخص", "999"],
        ],
        positioned: true,
      },
    ]);
    expect(document.facts).toHaveLength(1);
    expect(document.facts[0].measure).toBe("ASSETS");
  });

  test("a statement section with no mappable fact fails precisely", () => {
    const document = buildFinancialDocumentUnderstanding([
      { rows: [["صورت وضعیت مالی"], ["این بخش هیچ جدول مالی ندارد"]] },
    ]);
    const balance = document.sections.find((section) => section.type === "BALANCE_SHEET");
    expect(balance?.state).toBe("FAILED");
    expect(balance?.failureCode).toBe(FINANCIAL_DOCUMENT_ERROR_CODES.AMBIGUOUS_TABLE);
    expect(document.status).toBe("FAILED");
  });

  test("a report with only narrative content is PARTIAL, never fabricated complete", () => {
    const document = buildFinancialDocumentUnderstanding([
      { rows: [["گزارش حسابرس مستقل"], ["متن گزارش بدون جدول مالی"]] },
    ]);
    expect(document.status).toBe("PARTIAL");
    expect(document.facts).toHaveLength(0);
  });

  test("keeps real page provenance when the source is paged (PDF)", () => {
    const rows = [
      ["صورت وضعیت مالی"],
      ["(ارقام به میلیون ریال)"],
      ["جمع دارایی‌ها 1,965,000 1,798,000"],
    ];
    const document = buildFinancialDocumentUnderstanding([{ rows, pageNumbers: [3, 3, 4] }]);
    const balance = document.sections.find((section) => section.type === "BALANCE_SHEET");
    expect(balance?.pageStart).toBe(3);
    expect(balance?.pageEnd).toBe(4);
    expect(document.facts[0].evidence.page).toBe(4);
  });

  test("empty input fails closed", () => {
    const document = buildFinancialDocumentUnderstanding([{ rows: [] }]);
    expect(document.status).toBe("FAILED");
    expect(document.facts).toHaveLength(0);
  });
});

describe("derivation into the existing analysis/analytics owners", () => {
  test("derives revenue, expenses, assets, liabilities and equity from facts", () => {
    const derived = deriveAnalysisInput(reportDocument());
    expect(derived.assets).toBe(1_965_000 * 1_000_000);
    expect(derived.liabilities).toBe(820_000 * 1_000_000);
    expect(derived.equity).toBe(1_145_000 * 1_000_000);
    expect(derived.revenue).toBe(2_400_000 * 1_000_000);
    expect(derived.expenses).toBe(430_000 * 1_000_000);
    expect(derived.statement.totalAssets).toBe(1_965_000 * 1_000_000);
    expect(derived.statement.netIncome).toBe(220_000 * 1_000_000);
    // Total expenses reconcile revenue to the statement's net profit, so the
    // analysis contract's profit = revenue - expenses equals the real profit.
    expect(derived.analysisExpenses).toBe((2_400_000 - 220_000) * 1_000_000);
  });

  test("derives the prior-period statement for horizontal analysis", () => {
    const prior = derivePriorStatement(reportDocument());
    expect(prior.revenue).toBe(2_100_000 * 1_000_000);
    expect(prior.netIncome).toBe(170_000 * 1_000_000);
    expect(prior.totalAssets).toBe(1_798_000 * 1_000_000);
  });

  test("reports no prior period instead of inventing one", () => {
    const document = buildFinancialDocumentUnderstanding([
      { name: "ترازنامه", rows: [["شرح", "1402"], ["جمع دارایی‌ها", "100"]], positioned: true },
    ]);
    expect(derivePriorStatement(document)).toEqual({});
  });

  test("reports absent measures instead of inventing values", () => {
    const document = buildFinancialDocumentUnderstanding([
      { name: "ترازنامه", rows: [["شرح", "1402"], ["جمع دارایی‌ها", "100"]], positioned: true },
    ]);
    const derived = deriveAnalysisInput(document);
    expect(derived.missingMeasures).toEqual(
      expect.arrayContaining(["LIABILITIES", "REVENUE", "EXPENSES"]),
    );
    expect(derived.liabilities).toBe(0);
  });

  test("summarizes the document truthfully for job/API responses", () => {
    const summary = summarizeFinancialDocument(reportDocument());
    expect(summary.status).toBe("COMPLETED");
    expect(summary.currency).toBe("IRR");
    expect(summary.unitMultiplier).toBe(1_000_000);
    expect(summary.sectionCount).toBe(6);
    expect(summary.factCount).toBeGreaterThan(0);
    expect(summary.sections.map((section) => section.type)).toContain("AUDITOR_REPORT");
  });
});
