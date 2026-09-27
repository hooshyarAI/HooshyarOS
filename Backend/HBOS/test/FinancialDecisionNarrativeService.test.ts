/**
 * product.financial-decision-narrative — focused golden-case tests.
 *
 * Reproduces the observed product-intelligence failures as regression tests:
 * question-specific answers, non-empty grounded findings, exactly three
 * scenarios, risk drivers instead of a bare ratio, canonical exact numbers and
 * no internal identifier leakage.
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
import {
  classifyQuestion,
  composeAnswer,
  composeFindingGroups,
  composeScenarios,
  formatFaInteger,
} from "../Product/FinancialDecisionNarrativeService";

const fact = (
  measure: StatementMeasure,
  value: number,
  periodIndex = 0,
  section: FinancialStatementFact["section"] = "INCOME_STATEMENT",
): FinancialStatementFact => ({
  measure,
  section,
  label: measure,
  periodLabel: periodIndex === 0 ? "دوره جاری" : "دوره قبل",
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

// The real 123.xlsx facts reproduced from the canonical qualification evidence,
// including the operating-profit line that really does not reconcile.
const REAL_FACTS: readonly FinancialStatementFact[] = [
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

const insightFor = (facts: readonly FinancialStatementFact[] = REAL_FACTS) => {
  const document = documentWith(facts);
  const derived = deriveAnalysisInput(document);
  const prior = derivePriorStatement(document);
  const analytics = new FinancialAnalyticsService().execute({
    tenantId: "tenant-a",
    statement: derived.statement,
    priorStatement: prior,
  });
  return composeFinancialStatementInsight({ document, derived, prior, analytics });
};

const INTERNAL_IDENTIFIER = /\b(preTaxIncome|netProfit|netIncome|operatingIncome|grossProfit|totalLiabilities|debtToAssets|balance-sheet-identity|gross-profit-identity|operating-profit-identity|qualityOfEarnings|Revenue=|Profit=)\b/;
const normalize = (value: string): string => value.replace(/\u200c/g, "");

describe("FinancialDecisionNarrativeService", () => {
  test("classifies the representative user questions into distinct intents", () => {
    expect(classifyQuestion("مهم‌ترین ریسک مالی من چیست؟")).toBe("RISK");
    expect(classifyQuestion("برای رشد و توسعه و افزایش تاب‌آوری در سه سناریو پیشنهاد بده.")).toBe("SCENARIOS");
    expect(classifyQuestion("چرا سود تغییر کرده است؟")).toBe("PROFIT_CHANGE");
    expect(classifyQuestion("چه اطلاعاتی برای نتیجه‌گیری بهتر کم است؟")).toBe("DATA_GAPS");
    expect(classifyQuestion("این صورت مالی را تحلیل کن.")).toBe("ANALYZE");
  });

  test("renders the exact canonical integer, never a rounded variant", () => {
    expect(formatFaInteger(32_129_418_000_000)).toBe("۳۲٬۱۲۹٬۴۱۸٬۰۰۰٬۰۰۰");
    expect(formatFaInteger(32_129_418_000_000)).not.toBe("۳۲٬۱۲۹٬۴۰۰٬۰۰۰٬۰۰۰");
  });

  test("produces non-empty grounded strengths, risks, opportunities and actions", () => {
    const insight = insightFor();
    const groups = composeFindingGroups(insight);
    expect(groups.strengths.length).toBeGreaterThan(0);
    expect(groups.strengths.some((finding) => finding.message.includes("سود خالص مثبت"))).toBe(true);
    expect(groups.risks.some((finding) => finding.message.includes("اهرم"))).toBe(true);
    expect(groups.risks.some((finding) => finding.message.includes("کنترل حسابداری"))).toBe(true);
    expect(groups.opportunities.some((finding) => finding.message.includes("درآمد"))).toBe(true);
    expect(groups.actions.length).toBeGreaterThan(0);
    // Every finding is evidence-labelled and free of internal identifiers.
    for (const finding of [...groups.strengths, ...groups.risks, ...groups.opportunities, ...groups.actions]) {
      expect(["EXTRACTED_FACT", "DERIVED_METRIC", "INTERPRETATION", "MANAGEMENT_RECOMMENDATION"]).toContain(finding.evidenceLevel);
      expect(INTERNAL_IDENTIFIER.test(finding.message)).toBe(false);
    }
  });

  test("answers the risk question with evidence-based drivers, not a bare ratio", () => {
    const insight = insightFor();
    const composed = composeAnswer(insight, "مهم‌ترین ریسک مالی من چیست؟");
    expect(composed.intent).toBe("RISK");
    expect(composed.answer).toContain("ریسک");
    expect(composed.answer).toContain("اهرم");
    expect(composed.answer).toContain("چرا");
    expect(composed.sections.some((section) => section.heading.includes("پایش"))).toBe(true);
    expect(INTERNAL_IDENTIFIER.test(composed.answer)).toBe(false);
  });

  test("returns exactly three materially different scenarios", () => {
    const insight = insightFor();
    const scenarios = composeScenarios(insight);
    expect(scenarios).toHaveLength(3);
    const labels = scenarios.map((scenario) => normalize(scenario.label));
    expect(labels).toEqual(["محافظه‌کارانه", "متوازن", "تهاجمی"].map(normalize));
    for (const scenario of scenarios) {
      expect(scenario.assumptions.length).toBeGreaterThan(0);
      expect(scenario.actions.length).toBeGreaterThan(0);
      expect(scenario.principalRisks.length).toBeGreaterThan(0);
      expect(scenario.earlyWarnings.length).toBeGreaterThan(0);
      expect(scenario.decisionCriteria.length).toBeGreaterThan(0);
      expect(scenario.requiredEvidence.length).toBeGreaterThan(0);
    }
    const composed = composeAnswer(insight, "برای رشد و توسعه و افزایش تاب‌آوری در سه سناریو پیشنهاد بده");
    expect(composed.intent).toBe("SCENARIOS");
    const normalizedAnswer = normalize(composed.answer);
    expect(normalizedAnswer).toContain(normalize("محافظه‌کارانه"));
    expect(normalizedAnswer).toContain(normalize("متوازن"));
    expect(normalizedAnswer).toContain(normalize("تهاجمی"));
    expect(composeAnswer(insight, "برای رشد و توسعه و افزایش تاب‌آوری در سه سناریو پیشنهاد بده").scenarios).toHaveLength(3);
  });

  test("explains the profit change through the contribution chain", () => {
    const insight = insightFor();
    const composed = composeAnswer(insight, "چرا سود تغییر کرده است؟");
    expect(composed.intent).toBe("PROFIT_CHANGE");
    expect(composed.answer).toContain("زنجیره عوامل");
    expect(composed.answer).toContain("درآمد");
    expect(composed.answer).toContain("سود خالص");
    expect(INTERNAL_IDENTIFIER.test(composed.answer)).toBe(false);
  });

  test("separates data, validation and operational gaps", () => {
    const insight = insightFor();
    const composed = composeAnswer(insight, "چه اطلاعاتی برای نتیجه‌گیری بهتر کم است؟");
    expect(composed.intent).toBe("DATA_GAPS");
    const headings = composed.sections.map((section) => normalize(section.heading));
    expect(headings.some((heading) => heading.includes(normalize("شکاف‌های داده")))).toBe(true);
    expect(headings.some((heading) => heading.includes(normalize("شکاف‌های اعتبارسنجی")))).toBe(true);
    expect(headings.some((heading) => heading.includes(normalize("شکاف‌های عملیاتی")))).toBe(true);
    expect(INTERNAL_IDENTIFIER.test(composed.answer)).toBe(false);
  });

  test("a leverage ratio is only presented as a risk with an explicit rationale", () => {
    const insight = insightFor();
    const groups = composeFindingGroups(insight);
    const ratioRisk = groups.risks.find((finding) => finding.message.includes("نسبت بدهی به دارایی"));
    expect(ratioRisk).toBeDefined();
    expect(ratioRisk!.message).toContain("آستانه");
    expect(ratioRisk!.evidenceLevel).toBe("INTERPRETATION");
  });

  test("never fabricates a metric when evidence is absent", () => {
    const insight = insightFor([fact("REVENUE", 1000)]);
    const composed = composeAnswer(insight, "این صورت مالی را تحلیل کن");
    // The evidence-backed revenue is reported; the absent net profit is stated
    // as absent instead of being fabricated as a number.
    expect(composed.answer).toContain("سود خالص: در سند استخراج نشده است");
    expect(composed.answer).toContain("محدودیت");
    expect(INTERNAL_IDENTIFIER.test(composed.answer)).toBe(false);
  });
});
