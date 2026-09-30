/**
 * B-03 — cognitive orchestration capability selection, execution and the
 * consistency gate.
 *
 * The real 123.xlsx dataset reconciles, so the consistency gate never fires on
 * it. These tests therefore verify BOTH halves honestly:
 *   1. the gate is silent when the canonical owner and the specialist agree, and
 *   2. the gate DETECTS and SURFACES a genuine divergence instead of silently
 *      averaging it away or overwriting the canonical value.
 */
import { CognitiveOrchestrationService } from "../Product/CognitiveOrchestrationService";
import { analyzeQuestion } from "../Product/FinancialDecisionNarrativeService";
import { composeFinancialStatementInsight } from "../Product/FinancialStatementInsight";
import {
  deriveAnalysisInput,
  derivePriorStatement,
  type FinancialDocumentUnderstanding,
  type FinancialStatementFact,
} from "../Product/FinancialDocumentUnderstanding";
import { FinancialAnalyticsService } from "../Product/FinancialAnalyticsService";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";

const fact = (
  measure: FinancialStatementFact["measure"],
  value: number,
  periodIndex = 0,
  section: FinancialStatementFact["section"] = "INCOME_STATEMENT",
): FinancialStatementFact => ({
  measure, section, label: measure,
  periodLabel: periodIndex === 0 ? "دوره جاری" : "دوره قبل",
  periodIndex, rawValue: value, value: value * 1_000_000,
  unitMultiplier: 1_000_000, currency: "IRR", confidence: 1,
  evidence: { line: 1, text: `${measure}=${value}` },
});

const buildInsight = (facts: readonly FinancialStatementFact[]) => {
  const document: FinancialDocumentUnderstanding = {
    status: "PARTIAL", currency: "IRR", unitMultiplier: 1_000_000, sections: [], facts: [...facts],
  };
  const derived = deriveAnalysisInput(document);
  const prior = derivePriorStatement(document);
  const analytics = new FinancialAnalyticsService().execute({
    tenantId: "tenant-a", statement: derived.statement, priorStatement: prior,
  });
  return composeFinancialStatementInsight({ document, derived, prior, analytics });
};

const HEALTHY_FACTS: readonly FinancialStatementFact[] = [
  fact("REVENUE", 32_129),
  fact("COGS", -27_093),
  fact("GROSS_PROFIT", 5_036),
  fact("OPERATING_EXPENSES", -291),
  fact("OPERATING_PROFIT", 4_708),
  fact("NET_PROFIT", 7_250),
  fact("CURRENT_ASSETS", 31_107, 0, "BALANCE_SHEET"),
  fact("ASSETS", 32_244, 0, "BALANCE_SHEET"),
  fact("CURRENT_LIABILITIES", 17_279, 0, "BALANCE_SHEET"),
  fact("LIABILITIES", 17_407, 0, "BALANCE_SHEET"),
  fact("EQUITY", 14_836, 0, "BALANCE_SHEET"),
  fact("CASH", 5_000, 0, "BALANCE_SHEET"),
  fact("RECEIVABLES", 12_000, 0, "BALANCE_SHEET"),
  fact("INVENTORY", 9_000, 0, "BALANCE_SHEET"),
  fact("PAYABLES", 8_000, 0, "BALANCE_SHEET"),
  fact("REVENUE", 16_527, 1),
  fact("NET_PROFIT", 3_319, 1),
  fact("OPERATING_CASH_FLOW", 4_100, 0, "CASH_FLOW_STATEMENT"),
  fact("NET_CASH_FLOW", 3_900, 0, "CASH_FLOW_STATEMENT"),
];

/** A real session authority, so the governance gate can be evaluated. */
const securityContext = SecurityContext.forHumanUser(
  Principal.humanUser("owner-1", "tenant-a"),
  [Authorization.READ, Authorization.WRITE, Authorization.EXECUTE, Authorization.APPROVE],
  "session:test",
);

describe("B-03 cognitive orchestration", () => {
  const service = new CognitiveOrchestrationService();
  const insight = buildInsight(HEALTHY_FACTS);

  test("the question selects different capabilities for different intents", () => {
    const ask = (question: string) => service.orchestrate({ tenantId: "tenant-a", question, insight, securityContext }).executedCapabilities;

    // ANALYZE runs the integrity + liquidity evidence engines.
    expect(ask("این صورت مالی را تحلیل کن")).toEqual(
      expect.arrayContaining(["INTEGRITY_EVIDENCE", "FINANCIAL_INTELLIGENCE", "LIQUIDITY_LEVERAGE"]),
    );
    // DATA_GAPS must NOT pull in the financial specialist engines.
    expect(ask("چه اطلاعاتی برای نتیجه‌گیری بهتر کم است؟")).toEqual(["INTEGRITY_EVIDENCE"]);
    // RESILIENCE runs liquidity, working capital and earnings quality.
    expect(ask("تاب‌آوری شرکت را بررسی کن")).toEqual(
      expect.arrayContaining(["LIQUIDITY_LEVERAGE", "WORKING_CAPITAL", "EARNINGS_QUALITY", "ORGANIZATIONAL_INTELLIGENCE"]),
    );
    // GROWTH runs the existing scenario capability.
    expect(ask("برای رشد و توسعه چه پیشنهادهایی داری؟")).toContain("SCENARIO");
    // PROFIT_CHANGE runs comparative evidence.
    expect(ask("چرا سود تغییر کرده است؟")).toContain("COMPARATIVE_EVIDENCE");
    // ACTION runs the action findings and the governance gate.
    expect(ask("الان چه کار کنم؟")).toEqual(expect.arrayContaining(["ACTION_FINDINGS", "GOVERNANCE"]));
  });

  test("a composite question executes every required capability", () => {
    const result = service.orchestrate({
      tenantId: "tenant-a",
      question: "برای رشد شرکت چه کنم و آیا این رشد از نظر مالی تاب‌آور است؟",
      insight,
      securityContext,
    });
    expect(result.intent.answerMode).toBe("COMPOSITE");
    // Growth, resilience AND action capabilities all really ran.
    expect(result.executedCapabilities).toEqual(expect.arrayContaining([
      "SCENARIO",              // growth
      "LIQUIDITY_LEVERAGE",    // resilience
      "WORKING_CAPITAL",       // resilience
      "ACTION_FINDINGS",       // action
      "GOVERNANCE",            // action gate
    ]));
  });

  test("reasoning runs over canonical values after the deterministic engines", () => {
    const result = service.orchestrate({ tenantId: "tenant-a", question: "این صورت مالی را تحلیل کن", insight });
    expect(result.reasoning.status).toBe("EXECUTED");
    // Reasoning is not vacuous: it reports a calculated confidence derived from
    // the canonical values, not an unavailable fallback.
    expect(result.reasoning.confidenceSource).toBe("calculated");
    expect(result.reasoning.steps.length).toBeGreaterThan(0);
  });

  test("unavailable capabilities are reported, never fabricated", () => {
    const result = service.orchestrate({ tenantId: "tenant-a", question: "مهم‌ترین ریسک مالی چیست؟", insight });
    const risk = result.executed.find((entry) => entry.capability === "RISK_INTELLIGENCE");
    expect(risk?.status).toBe("UNAVAILABLE");
    expect(risk?.owner).toBe("RiskIntelligenceEngine.assess");
    expect(risk?.unavailableReason).toMatch(/probability\/impact/);
    // The absence is disclosed to the caller.
    expect(result.limitations.join(" ")).toMatch(/ریسک/);
  });

  test("the consistency gate is silent when canonical and specialist agree", () => {
    const result = service.orchestrate({ tenantId: "tenant-a", question: "این صورت مالی را تحلیل کن", insight });
    expect(result.contradictions).toEqual([]);
  });

  test("the consistency gate detects and surfaces a genuine divergence without overwriting canonical", () => {
    // A doctored ratio: the insight claims a debt/asset ratio that the canonical
    // FinancialIntelligenceEngine will not reproduce. The gate must detect it,
    // report it, and keep the canonical value authoritative.
    const doctored = {
      ...insight,
      ratios: { ...insight.ratios, debtToAssets: 0.99 },
    } as typeof insight;

    const result = service.orchestrate({ tenantId: "tenant-a", question: "این صورت مالی را تحلیل کن", insight: doctored });

    const divergence = result.contradictions.find((item) => item.subject === "debtRatio");
    expect(divergence).toBeTruthy();
    // Canonical wins and the disagreement is visible, not averaged away.
    expect(divergence?.resolution).toBe("CANONICAL_WINS");
    expect(divergence?.canonicalValue).toBe(0.99);
    expect(divergence?.specialistValue).not.toBe(0.99);
    expect(divergence?.difference).not.toBe(0);
  });

  test("a divergence is never written back onto the canonical insight", () => {
    const doctored = {
      ...insight,
      ratios: { ...insight.ratios, debtToAssets: 0.99 },
    } as typeof insight;
    const before = doctored.ratios.debtToAssets;
    service.orchestrate({ tenantId: "tenant-a", question: "این صورت مالی را تحلیل کن", insight: doctored });
    // The insight object is untouched: orchestration interprets, it does not mutate.
    expect(doctored.ratios.debtToAssets).toBe(before);
  });

  test("provenance carries the question, intent, capabilities, trace and limitations", () => {
    const question = "تاب‌آوری شرکت را بررسی کن";
    const result = service.orchestrate({ tenantId: "tenant-a", question, insight });
    expect(result.question).toBe(question);
    expect(result.intent).toEqual(analyzeQuestion(question));
    expect(result.selectedCapabilities.length).toBeGreaterThan(0);
    expect(result.executionOrder.length).toBe(result.selectedCapabilities.length);
    expect(result.traceId).toMatch(/^TRACE-/);
    expect(result.status).toBe("READY");
    // Every executed record names its canonical owner and its evidence.
    for (const entry of result.executed) {
      expect(entry.owner.length).toBeGreaterThan(0);
      if (entry.status === "EXECUTED") expect(entry.evidence.length).toBeGreaterThan(0);
    }
  });

  test("reasoning never runs before the deterministic financial owner", () => {
    // ANALYZE path: the deterministic financial owner must precede reasoning.
    const analyze = service.orchestrate({ tenantId: "tenant-a", question: "این صورت مالی را تحلیل کن", insight });
    expect(analyze.executionOrder.indexOf("REASONING"))
      .toBeGreaterThan(analyze.executionOrder.indexOf("FINANCIAL_INTELLIGENCE"));
    expect(analyze.executionOrder.indexOf("REASONING"))
      .toBeGreaterThan(analyze.executionOrder.indexOf("INTEGRITY_EVIDENCE"));

    // ACTION path: governance is gated AFTER reasoning, never before it.
    const action = service.orchestrate({ tenantId: "tenant-a", question: "الان چه کار کنم؟", insight, securityContext });
    expect(action.executionOrder).toContain("GOVERNANCE");
    expect(action.executionOrder.indexOf("GOVERNANCE"))
      .toBeGreaterThan(action.executionOrder.indexOf("REASONING"));
    // And the action findings come before reasoning as well.
    expect(action.executionOrder.indexOf("ACTION_FINDINGS"))
      .toBeLessThan(action.executionOrder.indexOf("REASONING"));
  });
});
