/**
 * B-03.1 — two honesty gaps in the live cognitive orchestration:
 *
 *   GAP 1 — the orchestrator performed financial arithmetic of its own
 *           (`revenue - netProfit`) to feed `FinancialIntelligenceEngine`.
 *           The canonical `derivedResidual` owned by the statement insight is
 *           now CONSUMED; a missing residual is reported UNAVAILABLE instead of
 *           being reconstructed locally.
 *
 *   GAP 2 — the orchestrator dressed financial ratios (currentRatio,
 *           debtToAssets), operating cash flow and accounting-integrity
 *           outcomes up as "organizational evidence" and fed them to
 *           `OrganizationalIntelligenceEngine.diagnose()`. Those are FINANCIAL
 *           evidence. Without genuine organizational evidence the capability is
 *           now honestly reported UNAVAILABLE.
 *
 * These tests prove both by source inspection (absence of the arithmetic) and
 * by behaviour (the canonical owner is called with canonical values only, and
 * is never called at all when the evidence is absent).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CognitiveOrchestrationService } from "../Product/CognitiveOrchestrationService";
import { composeFinancialStatementInsight } from "../Product/FinancialStatementInsight";
import {
  deriveAnalysisInput,
  derivePriorStatement,
  type FinancialDocumentUnderstanding,
  type FinancialStatementFact,
} from "../Product/FinancialDocumentUnderstanding";
import { FinancialAnalyticsService } from "../Product/FinancialAnalyticsService";
import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { OrganizationalIntelligenceEngine } from "../Engines/OrganizationalIntelligenceEngine";

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

const ANALYZE_QUESTION = "این صورت مالی را تحلیل کن";
const RESILIENCE_QUESTION = "تاب‌آوری شرکت را بررسی کن";

const source = readFileSync(
  join(__dirname, "..", "Product", "CognitiveOrchestrationService.ts"),
  "utf8",
);

describe("B-03.1 orchestrator owns no financial arithmetic", () => {
  test("the orchestrator source never computes revenue - netProfit (nor any other financial ratio)", () => {
    // Strip comments so the explanatory prose that names the forbidden
    // expression cannot mask a real computation.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ")
      .replace(/`(?:[^`\\]|\\.)*`/g, '""');

    // No local residual reconstruction, no margin recomputation, no leverage
    // recomputation. Only FinancialIntelligenceEngine may do this.
    expect(code).not.toMatch(/revenue\s*-\s*netProfit/);
    expect(code).not.toMatch(/netProfit\s*-\s*revenue/);
    expect(code).not.toMatch(/\w+\s*\/\s*\w+\s*(?:\/\/|[)])/);
    expect(code).not.toMatch(/Math\.(round|floor|ceil|sqrt|pow|log|exp)\s*\(/);
    // Comparison/tolerance logic (the consistency gate) is allowed and expected.
    expect(code).toMatch(/Math\.abs\(/);
  });

  test("the canonical owner receives the canonical derivedResidual when available", () => {
    const insight = buildInsight(HEALTHY_FACTS);
    expect(insight.derivedResidual).toBeTruthy();
    expect(insight.derivedResidual?.basis).toBe("DERIVED_RESIDUAL");

    const financial = new FinancialIntelligenceEngine();
    const analyze = jest.spyOn(financial, "analyze");
    const service = new CognitiveOrchestrationService(financial);

    const result = service.orchestrate({ tenantId: "tenant-a", question: ANALYZE_QUESTION, insight });

    expect(analyze).toHaveBeenCalledTimes(1);
    const input = analyze.mock.calls[0][0];
    // The expense basis handed to the owner is the canonical residual itself,
    // not a value re-derived inside the orchestrator.
    expect(input.expenses).toBe(insight.derivedResidual?.value);
    expect(input.revenue).toBe(insight.metrics.revenue);
    expect(input.assets).toBe(insight.metrics.totalAssets);
    expect(input.liabilities).toBe(insight.metrics.totalLiabilities);
    // And the consumption is visible in the recorded evidence.
    const record = result.executed.find((entry) => entry.capability === "FINANCIAL_INTELLIGENCE");
    expect(record?.status).toBe("EXECUTED");
    expect(record?.evidence).toContain("expensesBasis=derivedResidual");
  });

  test("a missing derivedResidual is reported UNAVAILABLE, never locally reconstructed", () => {
    const insight = buildInsight(HEALTHY_FACTS);
    // The canonical owner has no residual to give; the orchestrator must not
    // fall back to `revenue - netProfit`.
    const withoutResidual = { ...insight, derivedResidual: null } as typeof insight;
    expect(withoutResidual.derivedResidual).toBeNull();

    const financial = new FinancialIntelligenceEngine();
    const analyze = jest.spyOn(financial, "analyze");
    const service = new CognitiveOrchestrationService(financial);

    const result = service.orchestrate({ tenantId: "tenant-a", question: ANALYZE_QUESTION, insight: withoutResidual });

    // The canonical owner was never invoked: no value was invented for it.
    expect(analyze).not.toHaveBeenCalled();
    const record = result.executed.find((entry) => entry.capability === "FINANCIAL_INTELLIGENCE");
    expect(record?.status).toBe("UNAVAILABLE");
    expect(record?.unavailableReason).toMatch(/derived residual/i);
    expect(result.unavailableCapabilities.map((entry) => entry.capability)).toContain("FINANCIAL_INTELLIGENCE");
    // The absence is disclosed in Persian, not hidden.
    expect(result.limitations.join(" ")).toMatch(/باقیمانده/);
  });
});

describe("B-03.1 organizational evidence honesty", () => {
  test("organizational intelligence is UNAVAILABLE when no genuine organizational evidence exists", () => {
    // A financial statement DOES carry currentRatio, debtToAssets and operating
    // cash flow. Those are financial evidence and must not be re-labelled as
    // organizational evidence.
    const insight = buildInsight(HEALTHY_FACTS);
    expect(insight.ratios.currentRatio).not.toBeNull();
    expect(insight.ratios.debtToAssets).not.toBeNull();
    expect(insight.cashFlow.operating).not.toBeNull();

    const organizational = new OrganizationalIntelligenceEngine();
    const diagnose = jest.spyOn(organizational, "diagnose");
    const service = new CognitiveOrchestrationService(undefined, organizational);

    const result = service.orchestrate({ tenantId: "tenant-a", question: RESILIENCE_QUESTION, insight });

    // The capability is selected by the intent, but cannot honestly execute.
    expect(result.executionOrder).toContain("ORGANIZATIONAL_INTELLIGENCE");
    // The owner was never called with financial metrics dressed as evidence.
    expect(diagnose).not.toHaveBeenCalled();

    const record = result.executed.find((entry) => entry.capability === "ORGANIZATIONAL_INTELLIGENCE");
    expect(record?.status).toBe("UNAVAILABLE");
    expect(record?.owner).toBe("OrganizationalIntelligenceEngine.diagnose");
    expect(record?.unavailableReason).toMatch(/organizational evidence/i);
    expect(record?.unavailableReason).toMatch(/financial ratios/);
    expect(record?.evidence).toEqual([]);
    // The Persian reason is explicit about why.
    expect(result.limitations.join(" ")).toMatch(/شواهد سازمانی/);
  });

  test("genuine financial capabilities on the resilience path still execute", () => {
    // Honest absence of organizational evidence must not disable the resilience
    // capabilities that DO have canonical evidence.
    const insight = buildInsight(HEALTHY_FACTS);
    const service = new CognitiveOrchestrationService();
    const result = service.orchestrate({ tenantId: "tenant-a", question: RESILIENCE_QUESTION, insight });

    expect(result.executedCapabilities).toEqual(expect.arrayContaining([
      "LIQUIDITY_LEVERAGE", "WORKING_CAPITAL", "EARNINGS_QUALITY", "FINANCIAL_INTELLIGENCE",
    ]));
    expect(result.executedCapabilities).not.toContain("ORGANIZATIONAL_INTELLIGENCE");
    // Reasoning still runs AFTER the deterministic canonical owners.
    expect(result.reasoning.status).toBe("EXECUTED");
    expect(result.executionOrder.indexOf("REASONING"))
      .toBeGreaterThan(result.executionOrder.indexOf("FINANCIAL_INTELLIGENCE"));
  });
});
