/**
 * product.financial-statement-insight — focused tests.
 *
 * Proves the grounded composition: interpretation/strengths/risks/opportunities
 * and management actions are derived only from verified canonical facts and the
 * existing ratio analytics, unavailable metrics are reported honestly, and no
 * value is fabricated when evidence is absent.
 */
import {
  deriveAnalysisInput,
  derivePriorStatement,
  type FinancialDocumentUnderstanding,
  type FinancialStatementFact,
  type StatementMeasure,
} from "../Product/FinancialDocumentUnderstanding";
import { FinancialAnalyticsService } from "../Product/FinancialAnalyticsService";
import { composeFinancialStatementInsight } from "../Product/FinancialStatementInsight";

const fact = (
  measure: StatementMeasure,
  value: number,
  periodIndex = 0,
  section: FinancialStatementFact["section"] = "INCOME_STATEMENT",
): FinancialStatementFact => ({
  measure,
  section,
  label: measure,
  periodLabel: periodIndex === 0 ? "current" : "prior",
  periodIndex,
  rawValue: value,
  value: value * 1_000_000,
  unitMultiplier: 1_000_000,
  currency: "IRR",
  confidence: 1,
  evidence: { line: 1, text: `${measure}=${value}` },
});

const documentWith = (facts: readonly FinancialStatementFact[]): FinancialDocumentUnderstanding => ({
  status: "PARTIAL",
  currency: "IRR",
  unitMultiplier: 1_000_000,
  sections: [],
  facts,
});

const FULL_FACTS: readonly FinancialStatementFact[] = [
  fact("REVENUE", 32_129_418),
  fact("COGS", -27_093_243),
  fact("GROSS_PROFIT", 5_036_175),
  fact("OPERATING_EXPENSES", -291_634),
  fact("OPERATING_PROFIT", 4_708_096),
  fact("NET_PROFIT", 7_250_000),
  fact("CURRENT_ASSETS", 31_107_024, 0, "BALANCE_SHEET"),
  fact("ASSETS", 32_244_256, 0, "BALANCE_SHEET"),
  fact("CURRENT_LIABILITIES", 17_279_237, 0, "BALANCE_SHEET"),
  fact("LIABILITIES", 17_407_417, 0, "BALANCE_SHEET"),
  fact("EQUITY", 14_836_839, 0, "BALANCE_SHEET"),
  fact("REVENUE", 16_527_318, 1),
  fact("NET_PROFIT", 3_319_076, 1),
];

const insightFor = (facts: readonly FinancialStatementFact[]) => {
  const document = documentWith(facts);
  const derived = deriveAnalysisInput(document);
  const prior = derivePriorStatement(document);
  const analytics = new FinancialAnalyticsService().execute({
    tenantId: "tenant-a",
    statement: derived.statement,
    priorStatement: prior,
  });
  return { document, derived, analytics, insight: composeFinancialStatementInsight({ document, derived, prior, analytics }) };
};

describe("composeFinancialStatementInsight", () => {
  test("computes grounded ratios from a partial statement and marks unavailable ones", () => {
    const { insight, derived } = insightFor(FULL_FACTS);
    expect(derived.statement.revenue).toBe(32_129_418_000_000);
    // Net margin = 7,250,000 / 32,129,418
    expect(insight.ratios.netMargin).toBeCloseTo(7_250_000 / 32_129_418, 8);
    // Current ratio = 31,107,024 / 17,279,237
    expect(insight.ratios.currentRatio).toBeCloseTo(31_107_024 / 17_279_237, 8);
    // Quick/cash ratios have no inventory/cash evidence: unavailable, not zero.
    expect(insight.ratios.quickRatio).toBeNull();
    expect(insight.ratios.cashRatio).toBeNull();
    expect(insight.unavailableRatios).toEqual(expect.arrayContaining(["quickRatio", "cashRatio"]));
    expect(insight.limitations.join(" ")).toContain("quickRatio");
  });

  test("grounds interpretation and strengths in the extracted facts", () => {
    const { insight } = insightFor(FULL_FACTS);
    expect(insight.interpretation.length).toBeGreaterThan(0);
    expect(insight.interpretation.every((finding) => ["EXTRACTED_FACT", "DERIVED_METRIC"].includes(finding.evidenceLevel))).toBe(true);
    expect(insight.strengths.some((finding) => finding.message.includes("positive net profit"))).toBe(true);
    expect(insight.strengths.some((finding) => finding.message.includes("Current assets cover current liabilities"))).toBe(true);
    expect(insight.interpretation.some((finding) => finding.evidence.some((item) => item.startsWith("netProfit=")))).toBe(true);
  });

  test("uses comparative periods and reports changes without inventing them", () => {
    const { insight } = insightFor(FULL_FACTS);
    const revenueChange = insight.comparative.find((entry) => entry.line === "revenue");
    expect(revenueChange?.prior).toBe(16_527_318_000_000);
    expect(revenueChange?.current).toBe(32_129_418_000_000);
    expect(insight.interpretation.some((finding) => finding.message.includes("Revenue increased"))).toBe(true);
    expect(insight.opportunities.length).toBeGreaterThan(0);
  });

  test("never fabricates a metric or ratio when evidence is absent", () => {
    const { insight } = insightFor([fact("REVENUE", 1000)]);
    expect(insight.ratios.netMargin).toBeNull();
    expect(insight.ratios.currentRatio).toBeNull();
    expect(insight.strengths).toHaveLength(0);
    expect(insight.managementActions).toHaveLength(0);
    expect(insight.limitations.length).toBeGreaterThan(0);
    expect(insight.interpretation.every((finding) => !finding.message.includes("undefined"))).toBe(true);
  });

  test("runs a grounded balance-sheet integrity check", () => {
    const { insight } = insightFor(FULL_FACTS);
    const identity = insight.integrity.find((check) => check.id === "balance-sheet-identity");
    expect(identity?.status).toBe("RECONCILED");
  });

  test("surfaces a reconciled mismatch as a grounded limitation", () => {
    const unbalanced = FULL_FACTS.map((item) => (item.measure === "ASSETS" ? fact("ASSETS", 99_999_999, 0, "BALANCE_SHEET") : item));
    const { insight } = insightFor(unbalanced);
    const identity = insight.integrity.find((check) => check.id === "balance-sheet-identity");
    expect(identity?.status).toBe("MISMATCH");
    expect(insight.risks.some((finding) => finding.message.includes("balance-sheet-identity"))).toBe(true);
  });
});
