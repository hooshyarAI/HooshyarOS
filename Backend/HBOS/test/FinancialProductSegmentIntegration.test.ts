/**
 * Focused integration tests for product / segment profitability.
 *
 * Proves the document's own per-product revenue-and-cost table is preserved by
 * the canonical extraction contract, that the canonical analytics owner derives
 * sales/gross-profit contributions, margins, concentration and mix from that
 * evidence alone, and that the governed Persian narrative answers a product
 * question from the same intelligence. No figure is inferred from company
 * totals; a document without the table keeps an honest data-gap disclosure.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { FinancialAnalyticsService } from "../Product/FinancialAnalyticsService";
import {
  buildFinancialDocumentUnderstanding,
  deriveAnalysisInput,
  derivePriorStatement,
  extractProductSegmentsFromBlocks,
} from "../Product/FinancialDocumentUnderstanding";
import { analyzeProductSegments } from "../Product/ProductSegmentAnalysis";
import { composeFinancialStatementInsight } from "../Product/FinancialStatementInsight";
import { composeAnswer } from "../Product/FinancialDecisionNarrativeService";

const M = 1_000_000;
const PRIOR_PERIOD = "سال مالی منتهی به ۱۴۰۴/۰۴/۳۱";
const CURRENT_PERIOD = "دوره ۱۲ ماهه منتهی به ۱۴۰۵/۰۴/۳۱";
const METRICS = ["تعداد تولید", "تعداد فروش", "نرخ فروش", "مبلغ فروش", "مبلغ بهای تمام شده", "سود ناخالص"];

const productTableRows = (): string[][] => [
  ["درآمدهای عملیاتی و بهای تمام شده"],
  ["کلیه مبالغ درج شده به میلیون ریال می باشد"],
  ["نوع کالا", "واحد", "ظرفیت عملی", "مبانی و مرجع قیمت گذاری", ...Array(6).fill(PRIOR_PERIOD), ...Array(6).fill(CURRENT_PERIOD)],
  ["نوع کالا", "واحد", "ظرفیت عملی", "مبانی و مرجع قیمت گذاری", ...METRICS, ...METRICS],
  // Product A: current revenue 1100, gross profit 500; prior revenue 900, GP 400.
  ["محصول الف", "تن", "0", "نرخ بازار", "100", "90", "10", "900", "-500", "400", "120", "110", "10", "1100", "-600", "500"],
  // Product B: current revenue 1200, gross profit 600; prior revenue 1000, GP 100.
  ["محصول ب", "تن", "0", "نرخ بازار", "50", "50", "20", "1000", "-900", "100", "60", "60", "20", "1200", "-600", "600"],
  ["جمع فروش داخلی", "170", "160", "2100", "-1400", "500", "180", "170", "2300", "-1200", "1100"],
];

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
    // No Desktop access: the real-file test stays skipped.
  }
  return undefined;
};

const REAL_XLSX = findRealXlsx();

describe("product/segment extraction and canonical analytics", () => {
  const segments = extractProductSegmentsFromBlocks([{ rows: productTableRows(), positioned: true }]);

  test("extracts one segment per product row for both periods", () => {
    expect(segments.map((segment) => segment.name)).toEqual(["محصول الف", "محصول ب"]);
    const a = segments[0];
    expect(a.current.revenue).toBe(1100 * M);
    expect(a.current.cost).toBe(600 * M);
    expect(a.current.grossProfit).toBe(500 * M);
    expect(a.current.quantitySold).toBe(110);
    expect(a.current.unitPrice).toBe(10);
    expect(a.prior?.revenue).toBe(900 * M);
    expect(a.prior?.grossProfit).toBe(400 * M);
  });

  test("derives contributions, margins, concentration and mix from evidence", () => {
    const document = buildFinancialDocumentUnderstanding([{ rows: productTableRows(), positioned: true }]);
    const analytics = analyzeProductSegments(document)!;
    expect(analytics.totalRevenue).toBe(2300 * M);
    expect(analytics.totalGrossProfit).toBe(1100 * M);
    expect(analytics.overallGrossMargin).toBeCloseTo(1100 / 2300, 8);

    const a = analytics.contributions.find((entry) => entry.name === "محصول الف")!;
    expect(a.grossMargin).toBeCloseTo(500 / 1100, 8);
    expect(a.revenueShare).toBeCloseTo(1100 / 2300, 8);
    expect(a.grossProfitShare).toBeCloseTo(500 / 1100, 8);
    expect(analytics.topRevenueContribution?.name).toBe("محصول ب");

    // Contextual margin: B is above the company product margin, A is at/below it.
    expect(analytics.highMargin.map((entry) => entry.name)).toContain("محصول ب");
    expect(analytics.lowMargin.map((entry) => entry.name)).toContain("محصول الف");

    expect(analytics.mixEffect).not.toBeNull();
    expect(analytics.mixEffect!.marginChange).toBeCloseTo(1100 / 2300 - 500 / 1900, 8);
    expect(analytics.mixEffect!.mixEffect + analytics.mixEffect!.rateCostEffect).toBeCloseTo(analytics.mixEffect!.marginChange, 8);
  });

  test("flags a genuinely negative-margin product without inventing one", () => {
    const rows = productTableRows();
    // Product A sold above cost (positive GP); make product B negative.
    rows[5] = ["محصول ب", "تن", "0", "نرخ بازار", "50", "50", "20", "1000", "-900", "100", "60", "60", "20", "1200", "-1500", "-300"];
    const document = buildFinancialDocumentUnderstanding([{ rows, positioned: true }]);
    const analytics = analyzeProductSegments(document)!;
    expect(analytics.negativeMargin.map((entry) => entry.name)).toEqual(["محصول ب"]);
    expect(analytics.negativeMargin[0].grossMargin).toBeCloseTo(-300 / 1200, 8);
  });

  test("returns null and keeps the honest disclosure when no product table exists", () => {
    const document = buildFinancialDocumentUnderstanding([{ rows: [["صورت سود و زیان"], ["درآمد عملیاتی", "1000"]], positioned: true }]);
    expect(analyzeProductSegments(document)).toBeNull();
  });

  test("answers a product question from the product evidence, not company totals", () => {
    const document = buildFinancialDocumentUnderstanding([{ rows: productTableRows(), positioned: true }]);
    const derived = deriveAnalysisInput(document);
    const insight = composeFinancialStatementInsight({ document, derived });
    const composed = composeAnswer(insight, "کدام محصولات سودآوری بالاتری دارند و ترکیب فروش چه اثری دارد؟");
    expect(composed.intent).toBe("PRODUCT");
    expect(composed.answer).toContain("سودآوری محصول/بخش");
    expect(composed.answer).toContain("محصول ب");
    expect(/productSegments|grossMargin|revenueShare|mixEffect/.test(composed.answer)).toBe(false);
  });
});

(REAL_XLSX && existsSync(REAL_XLSX) ? describe : describe.skip)("real 123.xlsx product/segment intelligence", () => {
  test("product totals match the company statement and identify mix and margin leaders", async () => {
    const store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const adapter = new FinancialDataIngestionAdapter(store);
    const result = await adapter.ingestXlsx("real-tenant", "123.xlsx", readFileSync(REAL_XLSX as string));
    const document = result.model.document!;
    const analytics = analyzeProductSegments(document)!;

    // The extracted product table reconciles exactly to the company statement.
    expect(analytics.totalRevenue).toBe(32_129_418 * M);
    expect(analytics.totalGrossProfit).toBe(5_036_175 * M);
    expect(analytics.overallGrossMargin).toBeCloseTo(5_036_175 / 32_129_418, 8);

    // Highest revenue contribution is white sugar (شکر سفيد); it is also low margin.
    expect(analytics.topRevenueContribution?.name).toBe("شکر سفيد");
    expect(analytics.lowMargin.map((entry) => entry.name)).toContain("شکر سفيد");
    // A genuinely negative-margin product is identified with its own evidence.
    expect(analytics.negativeMargin.length).toBeGreaterThan(0);
    // Mix vs rate/cost decomposition is available and self-consistent.
    expect(analytics.mixEffect).not.toBeNull();
    expect(analytics.mixEffect!.mixEffect + analytics.mixEffect!.rateCostEffect).toBeCloseTo(analytics.mixEffect!.marginChange, 8);

    const derived = deriveAnalysisInput(document);
    const prior = derivePriorStatement(document);
    const insight = composeFinancialStatementInsight({ document, derived, prior });
    const composed = composeAnswer(insight, "کدام محصولات یا بخش‌ها سودآوری بالاتری دارند و ترکیب فروش چه اثری دارد؟");
    expect(composed.intent).toBe("PRODUCT");
    expect(composed.answer).toContain("شکر سفيد");
    expect(composed.answer).toContain("اثر ترکیب فروش");
    store.close();
  });
});
