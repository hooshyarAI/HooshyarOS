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
  analyzeQuestion,
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

/**
 * B-02 — the user question is the control variable of the answer.
 *
 * These tests fix the previously-observed failure: a single document answered
 * every question with one shared template, and meaningful questions about growth,
 * resilience or next action silently fell through to GENERAL.
 */
describe("B-02 question-driven cognitive control", () => {
  describe("mandatory intent regression cases", () => {
     test.each([
        ["این صورت مالی را تحلیل کن", "ANALYZE"],
        ["تاب‌آوری شرکت را بررسی کن", "RESILIENCE"],
        ["مهم‌ترین ریسک مالی چیست؟", "RISK"],
        ["چرا سود تغییر کرده است؟", "PROFIT_CHANGE"],
        ["چه اطلاعاتی برای نتیجه‌گیری بهتر کم است؟", "DATA_GAPS"],
        ["برای رشد و توسعه چه پیشنهادهایی داری؟", "GROWTH"],
        ["الان برای بهبود وضعیت مالی شرکت چه کار کنم؟", "ACTION"],
        ["چه عملیاتی باید انجام شود؟", "ACTION"],
        ["چه اقداماتی باید بررسی شود؟", "ACTION"],
        ["چه اقدامی باید انجام شود؟", "ACTION"],
        ["چه کاری باید انجام شود؟", "ACTION"],
        ["ضعف عملای شرکت چگونه است؟", "OPERATIONAL"],
        ["مشکلات عملیاتی شرکت چیست؟", "OPERATIONAL"],
        ["هوا امروز چطور است؟", "GENERAL"],
     ])("%s routes to %s", (question, expected) => {
      expect(classifyQuestion(question)).toBe(expected);
    });

    test("Q7 keeps both growth and resilience and composes the answer", () => {
      const contract = analyzeQuestion("برای رشد و توسعه و افزایش تاب‌آوری شرکت چه پیشنهادی داری؟");
      expect(contract.primaryIntent).toBe("GROWTH");
      expect(contract.secondaryIntents).toContain("RESILIENCE");
      expect(contract.answerMode).toBe("COMPOSITE");
    });

    test("Q8 keeps both risk and action and composes the answer", () => {
      const contract = analyzeQuestion("مهم‌ترین ریسک مالی چیست و الان چه اقدامی انجام بدهم؟");
      expect(contract.primaryIntent).toBe("RISK");
      expect(contract.secondaryIntents).toContain("ACTION");
      expect(contract.answerMode).toBe("COMPOSITE");
    });

    test("a genuinely unrelated question is GENERAL", () => {
      const contract = analyzeQuestion("هوا امروز چطور است؟");
      expect(contract.primaryIntent).toBe("GENERAL");
      expect(contract.secondaryIntents).toEqual([]);
      expect(contract.answerMode).toBe("FOCUSED");
    });
  });

  describe("structured control contract", () => {
    test("every intent yields a complete, non-empty control contract", () => {
      for (const question of [
        "این صورت مالی را تحلیل کن",
        "مهم‌ترین ریسک مالی چیست؟",
        "چرا سود تغییر کرده است؟",
        "کدام محصولات سودآورترند؟",
        "چه اطلاعاتی کم است؟",
        "سه سناریو برای آینده چیست؟",
        "برای رشد و توسعه چه پیشنهادهایی داری؟",
        "تاب‌آوری شرکت را بررسی کن",
        "الان چه کار کنم؟",
        "هوا امروز چطور است؟",
      ]) {
        const contract = analyzeQuestion(question);
        expect(contract.userGoal.length).toBeGreaterThan(0);
        expect(contract.requestedAnalysis.length).toBeGreaterThan(0);
        expect(contract.requestedOutcome.length).toBeGreaterThan(0);
        expect(contract.requiredEvidenceDomains.length).toBeGreaterThan(0);
        expect(["FOCUSED", "COMPOSITE"]).toContain(contract.answerMode);
        // The public label API and the contract can never disagree.
        expect(classifyQuestion(question)).toBe(contract.primaryIntent);
      }
    });

    test("Persian typing variants normalize to the same intent", () => {
      const withZwnj = "تاب‌آوری شرکت را بررسی کن";
      const spaced = "تاب آوری شرکت را بررسی کن";
      const arabicYeh = "تاباوری شركت را برسي كن";
      const withQuestionMark = "تاب‌آوری شرکت؟";
      for (const variant of [spaced, arabicYeh, withQuestionMark]) {
        expect(classifyQuestion(variant)).toBe(classifyQuestion(withZwnj));
      }
      expect(classifyQuestion(withZwnj)).toBe("RESILIENCE");
    });

    test("secondary intents are never silently dropped for a multi-part question", () => {
      const contract = analyzeQuestion("ریسکها را بگو و بگو چه کار کنم و تاب‌آوری چقدر است");
      expect(contract.primaryIntent).toBe("RISK");
      expect(contract.secondaryIntents).toContain("ACTION");
      expect(contract.secondaryIntents).toContain("RESILIENCE");
      expect(contract.answerMode).toBe("COMPOSITE");
    });
  });

  describe("growth, resilience and action answer paths", () => {
    test("a growth question reaches the existing three-scenario capability", () => {
      const insight = insightFor();
      const composed = composeAnswer(insight, "برای رشد و توسعه چه پیشنهادهایی داری؟");
      expect(composed.intent).toBe("GROWTH");
      // GROWTH is answered by the existing composeScenarios capability.
      expect(composed.scenarios).toHaveLength(3);
      const normalizedAnswer = normalize(composed.answer);
      for (const label of ["محافظه‌کارانه", "متوازن", "تهاجمی"]) {
        expect(normalizedAnswer).toContain(normalize(label));
      }
      expect(composed.sections.some((section) => section.heading.includes("مبانی رشد"))).toBe(true);
    });

    test("a resilience question answers only from canonical evidence, never from market claims", () => {
      const insight = insightFor();
      const composed = composeAnswer(insight, "تاب‌آوری شرکت را بررسی کن");
      expect(composed.intent).toBe("RESILIENCE");
      expect(composed.sections.some((section) => section.heading.includes("تابآوری"))).toBe(true);
      // Grounded in the document's own evidence.
      expect(composed.answer).toContain("اهرم");
      // Explicitly refuses to claim non-financial resilience.
      expect(composed.answer).toContain("عوامل غیرمالی");
      expect(INTERNAL_IDENTIFIER.test(composed.answer)).toBe(false);
    });

    test("a resilience question with no evidence says so instead of fabricating a verdict", () => {
      const empty = insightFor([fact("REVENUE", 1000)]);
      const composed = composeAnswer(empty, "تاب‌آوری شرکت را بررسی کن");
      expect(composed.intent).toBe("RESILIENCE");
      expect(composed.answer).toContain("شواهد کافی");
      // Absence of evidence is not reported as a resilience verdict.
      expect(composed.answer).toContain("به معنای ضعف تابآوری نیست");
    });

    test("an action question answers from the canonical finding groups", () => {
      const insight = insightFor();
      const composed = composeAnswer(insight, "الان چه کار کنم؟");
      expect(composed.intent).toBe("ACTION");
      expect(composed.sections.some((section) => section.heading.includes("اقدام اولویت دار"))).toBe(true);
      expect(composed.sections.some((section) => section.heading.includes("مبنای شواهد"))).toBe(true);
      // Recommendations are labelled as such, never as verified fact.
      expect(composed.answer).toContain("توصیه مدیریتی");
      expect(INTERNAL_IDENTIFIER.test(composed.answer)).toBe(false);
    });
  });

  describe("one document, different questions, materially different answers", () => {
    test("seven questions produce materially different answer structures", () => {
      const insight = insightFor();
      const questions: readonly string[] = [
        "این صورت مالی را تحلیل کن",
        "مهم‌ترین ریسک مالی چیست؟",
        "چرا سود تغییر کرده است؟",
        "چه اطلاعاتی برای نتیجه‌گیری بهتر کم است؟",
        "برای رشد و توسعه چه پیشنهادهایی داری؟",
        "تاب‌آوری شرکت را بررسی کن",
        "الان چه کار کنم؟",
      ];
      const answers = questions.map((question) => composeAnswer(insight, question));

      // Intent, headings, evidence selection and structure must all differ.
      expect(new Set(answers.map((answer) => answer.intent)).size).toBe(questions.length);

      const headingSets = answers.map((answer) => answer.sections.map((section) => normalize(section.heading)).join("|"));
      expect(new Set(headingSets).size).toBe(questions.length);

      const bodies = answers.map((answer) => answer.answer);
      expect(new Set(bodies).size).toBe(questions.length);
      for (const body of bodies) {
        for (const other of bodies) {
          if (body === other) continue;
          expect(body).not.toBe(other);
        }
      }
    });

    test("Q1 and Q5 no longer collapse onto one shared body", () => {
      const insight = insightFor();
      const analyze = composeAnswer(insight, "این صورت مالی را تحلیل کن");
      const gaps = composeAnswer(insight, "چه اطلاعاتی برای نتیجه‌گیری بهتر کم است؟");
      expect(analyze.intent).not.toBe(gaps.intent);
      expect(analyze.answer).not.toBe(gaps.answer);
      expect(analyze.sections.map((section) => section.heading)).not.toEqual(gaps.sections.map((section) => section.heading));
    });

    test("Q2 resilience and Q6 growth no longer collapse to the general template", () => {
      const insight = insightFor();
      const resilience = composeAnswer(insight, "تاب‌آوری شرکت را بررسی کن");
      const growth = composeAnswer(insight, "برای رشد و توسعه چه پیشنهادهایی داری؟");
      const general = composeAnswer(insight, "هوا امروز چطور است؟");
      expect(resilience.intent).toBe("RESILIENCE");
      expect(growth.intent).toBe("GROWTH");
      expect(resilience.answer).not.toBe(general.answer);
      expect(growth.answer).not.toBe(general.answer);
      expect(resilience.sections.map((section) => section.heading)).not.toEqual(general.sections.map((section) => section.heading));
    });

    test("a composite question answers both of its parts", () => {
      const insight = insightFor();
      const composed = composeAnswer(insight, "مهم‌ترین ریسک مالی چیست و الان چه اقدامی انجام بدهم؟");
      expect(composed.intent).toBe("RISK");
      const headings = composed.sections.map((section) => section.heading);
      // Risk part
      expect(headings.some((heading) => heading.includes("ریسکهای اصلی"))).toBe(true);
      // Action part
      expect(headings.some((heading) => heading.includes("اقدام اولویت دار"))).toBe(true);
      expect(INTERNAL_IDENTIFIER.test(composed.answer)).toBe(false);
    });

    test("no internal identifier leaks into any of the answer paths", () => {
      const insight = insightFor();
      for (const question of [
        "این صورت مالی را تحلیل کن",
        "مهم‌ترین ریسک مالی چیست؟",
        "چرا سود تغییر کرده است؟",
        "چه اطلاعاتی برای نتیجه‌گیری بهتر کم است؟",
        "برای رشد و توسعه چه پیشنهادهایی داری؟",
        "تاب‌آوری شرکت را بررسی کن",
        "الان چه کار کنم؟",
        "هوا امروز چطور است؟",
        "برای رشد و توسعه و افزایش تاب‌آوری شرکت چه پیشنهادی داری؟",
        "مهم‌ترین ریسک مالی چیست و الان چه اقدامی انجام بدهم؟",
      ]) {
        const composed = composeAnswer(insight, question);
        expect(INTERNAL_IDENTIFIER.test(composed.answer)).toBe(false);
        // Internal intent identifiers must never reach the user surface.
        for (const intent of ["ANALYZE", "RISK", "PROFIT_CHANGE", "DATA_GAPS", "GROWTH", "RESILIENCE", "ACTION", "SCENARIOS", "GENERAL", "COMPOSITE", "FOCUSED"]) {
          expect(composed.answer).not.toContain(intent);
        }
      }
    });
  });
});
