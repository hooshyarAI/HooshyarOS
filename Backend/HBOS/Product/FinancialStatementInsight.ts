/**
 * product.financial-statement-insight — grounded composition over canonical
 * statement facts and the existing ratio analytics.
 *
 * This is a COMPOSITION module, not an Engine and not a second financial
 * model. It owns no financial mathematics: every derived metric comes from
 * `deriveAnalysisInput` (canonical facts) and every ratio comes from the
 * existing `FinancialAnalyticsService` / `RatioAnalysisService`. This module
 * only arranges verified outputs into a management-readable structure and
 * labels each element with its evidence level so an interpretation is never
 * presented as an extracted fact.
 *
 * It never fabricates a value: a metric whose evidence is absent stays absent
 * and is reported as a limitation.
 */
import type {
  FinancialDocumentUnderstanding,
  DerivedAnalysisInput,
  FinancialStatementFact,
} from "./FinancialDocumentUnderstanding";
import type { RatioStatement } from "./RatioAnalysisService";
import type { FinancialAnalyticsResult } from "./FinancialAnalyticsService";

export type EvidenceLevel =
  | "EXTRACTED_FACT"
  | "DERIVED_METRIC"
  | "INTERPRETATION"
  | "MANAGEMENT_RECOMMENDATION";

export interface StatementInsightFinding {
  readonly message: string;
  readonly evidenceLevel: EvidenceLevel;
  readonly evidence: readonly string[];
}

export interface CanonicalFactView {
  readonly section: string;
  readonly measure: string;
  readonly periodIndex: number;
  readonly periodLabel: string;
  readonly value: number;
  readonly currency: string;
  readonly unitMultiplier: number;
  readonly confidence: number;
  readonly line: number | null;
}

export interface StatementRatioView {
  readonly grossMargin: number | null;
  readonly operatingMargin: number | null;
  readonly netMargin: number | null;
  readonly roa: number | null;
  readonly roe: number | null;
  readonly currentRatio: number | null;
  readonly quickRatio: number | null;
  readonly cashRatio: number | null;
  readonly debtToEquity: number | null;
  readonly debtToAssets: number | null;
  readonly equityRatio: number | null;
  readonly unavailable: readonly string[];
}

export interface ComparativeEntry {
  readonly line: string;
  readonly current: number;
  readonly prior: number;
  readonly absoluteChange: number;
  readonly pctChange: number;
}

export interface StatementIntegrityCheck {
  readonly id: string;
  readonly description: string;
  readonly expected: number;
  readonly actual: number;
  readonly difference: number;
  readonly status: "RECONCILED" | "MISMATCH";
}

export interface FinancialStatementInsight {
  readonly documentStatus: string;
  readonly currency: string | null;
  readonly unitMultiplier: number;
  readonly periods: readonly { readonly index: number; readonly label: string }[];
  readonly facts: readonly CanonicalFactView[];
  readonly metrics: Readonly<Record<string, number | null>>;
  readonly statement: Partial<RatioStatement>;
  readonly priorStatement: Partial<RatioStatement>;
  readonly ratios: StatementRatioView;
  readonly comparative: readonly ComparativeEntry[];
  readonly integrity: readonly StatementIntegrityCheck[];
  readonly unavailableRatios: readonly string[];
  readonly limitations: readonly string[];
  readonly interpretation: readonly StatementInsightFinding[];
  readonly strengths: readonly StatementInsightFinding[];
  readonly weaknesses: readonly StatementInsightFinding[];
  readonly risks: readonly StatementInsightFinding[];
  readonly opportunities: readonly StatementInsightFinding[];
  readonly managementActions: readonly StatementInsightFinding[];
  readonly cashFlow: {
    readonly operating: number | null;
    readonly investing: number | null;
    readonly financing: number | null;
    readonly net: number | null;
  };
}

export interface FinancialStatementInsightInput {
  readonly document: FinancialDocumentUnderstanding;
  readonly derived: DerivedAnalysisInput;
  readonly prior?: Partial<RatioStatement>;
  readonly analytics?: FinancialAnalyticsResult;
}

const currentFact = (
  facts: readonly FinancialStatementFact[],
  measure: FinancialStatementFact["measure"],
): number | null => {
  const matches = facts.filter((fact) => fact.measure === measure);
  if (matches.length === 0) return null;
  const atPeriod = matches.find((fact) => fact.periodIndex === 0);
  return (atPeriod ?? matches[0]).value;
};

const statusOf = (value: number | null): string => (value === null ? "unavailable" : String(value));

const viewFor = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function composeFinancialStatementInsight(
  input: FinancialStatementInsightInput,
): FinancialStatementInsight {
  const { document, derived } = input;
  const facts = document.facts;
  const prior = input.prior ?? {};
  const analytics = input.analytics;

  const profitability = analytics?.ratios?.profitability ?? null;
  const leverage = analytics?.ratios?.leverage ?? null;
  const liquidity = analytics?.ratios?.liquidity ?? null;

  const ratios: StatementRatioView = {
    grossMargin: viewFor(profitability?.grossMargin),
    operatingMargin: viewFor(profitability?.operatingMargin),
    netMargin: viewFor(profitability?.netMargin),
    roa: viewFor(profitability?.roa),
    roe: viewFor(profitability?.roe),
    currentRatio: viewFor(liquidity?.currentRatio),
    quickRatio: viewFor(liquidity?.quickRatio),
    cashRatio: viewFor(liquidity?.cashRatio),
    debtToEquity: viewFor(leverage?.debtToEquity),
    debtToAssets: viewFor(leverage?.debtToAssets),
    equityRatio: viewFor(leverage?.equityRatio),
    unavailable: [
      ...(profitability?.unavailable ?? []),
      ...(leverage?.unavailable ?? []),
      ...(liquidity?.unavailable ?? []),
    ],
  };

  const revenue = viewFor(derived.statement.revenue);
  const cogs = viewFor(derived.statement.cogs);
  const grossProfit = viewFor(derived.statement.grossProfit);
  const operatingExpenses = viewFor(derived.statement.operatingExpenses);
  const operatingProfit = viewFor(derived.statement.operatingIncome);
  const netProfit = viewFor(derived.statement.netIncome);
  const currentAssets = viewFor(derived.statement.currentAssets);
  const totalAssets = viewFor(derived.statement.totalAssets);
  const currentLiabilities = viewFor(derived.statement.currentLiabilities);
  const totalLiabilities = viewFor(derived.statement.totalLiabilities);
  const equity = viewFor(derived.statement.equity);

  const operatingCashFlow = currentFact(facts, "OPERATING_CASH_FLOW");
  const investingCashFlow = currentFact(facts, "INVESTING_CASH_FLOW");
  const financingCashFlow = currentFact(facts, "FINANCING_CASH_FLOW");
  const netCashFlow = currentFact(facts, "NET_CASH_FLOW");

  const metrics: Record<string, number | null> = {
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingProfit,
    netProfit,
    currentAssets,
    totalAssets,
    currentLiabilities,
    totalLiabilities,
    equity,
    operatingCashFlow,
    investingCashFlow,
    financingCashFlow,
    netCashFlow,
  };

  const comparative: ComparativeEntry[] = (analytics?.ratios?.horizontal?.entries ?? []).map((entry) => ({
    line: entry.line,
    current: entry.current,
    prior: entry.prior,
    absoluteChange: entry.absoluteChange,
    pctChange: entry.pctChange,
  }));

  const periods = Array.from(
    new Map(
      facts.map((fact) => [fact.periodIndex, { index: fact.periodIndex, label: fact.periodLabel }]),
    ).values(),
  ).sort((a, b) => a.index - b.index);

  const integrity: StatementIntegrityCheck[] = [];
  const pushCheck = (
    id: string,
    description: string,
    expected: number | null,
    actual: number | null,
  ): void => {
    if (expected === null || actual === null) return;
    const difference = actual - expected;
    const tolerance = Math.max(1, Math.abs(expected) * 1e-6);
    integrity.push({
      id,
      description,
      expected,
      actual,
      difference,
      status: Math.abs(difference) <= tolerance ? "RECONCILED" : "MISMATCH",
    });
  };
  pushCheck(
    "balance-sheet-identity",
    "Liabilities + equity should equal total assets.",
    totalLiabilities !== null && equity !== null ? totalLiabilities + equity : null,
    totalAssets,
  );
  pushCheck(
    "gross-profit-identity",
    "Revenue - COGS should equal gross profit.",
    revenue !== null && cogs !== null ? revenue - cogs : null,
    grossProfit,
  );

  const interpretation: StatementInsightFinding[] = [];
  const strengths: StatementInsightFinding[] = [];
  const weaknesses: StatementInsightFinding[] = [];
  const risks: StatementInsightFinding[] = [];
  const opportunities: StatementInsightFinding[] = [];
  const managementActions: StatementInsightFinding[] = [];
  const limitations: string[] = [];

  const push = (
    collection: StatementInsightFinding[],
    message: string,
    level: EvidenceLevel,
    evidence: string[],
  ): void => {
    collection.push({ message, evidenceLevel: level, evidence });
  };

  if (netProfit !== null && revenue !== null) {
    const margin = ratios.netMargin;
    push(
      interpretation,
      margin === null
        ? `Net profit is ${netProfit} on revenue ${revenue}.`
        : `Net profit is ${netProfit} on revenue ${revenue}, a net margin of ${(margin * 100).toFixed(2)}%.`,
      "DERIVED_METRIC",
      [`netProfit=${netProfit}`, `revenue=${revenue}`],
    );
    if (netProfit > 0) {
      push(strengths, `The period produced a positive net profit of ${netProfit}.`, "DERIVED_METRIC", [`netProfit=${netProfit}`]);
    } else if (netProfit < 0) {
      push(weaknesses, `The period closed with a net loss of ${netProfit}.`, "DERIVED_METRIC", [`netProfit=${netProfit}`]);
      push(risks, `Continued losses would erode equity; reported equity is ${statusOf(equity)}.`, "INTERPRETATION", [`netProfit=${netProfit}`, `equity=${statusOf(equity)}`]);
      push(managementActions, "Stabilise profitability before committing further growth expenditure.", "MANAGEMENT_RECOMMENDATION", [`netProfit=${netProfit}`]);
    }
  } else {
    limitations.push("Net profit or revenue evidence is absent; profitability interpretation is unavailable.");
  }

  if (ratios.grossMargin !== null) {
    push(interpretation, `Gross margin is ${(ratios.grossMargin * 100).toFixed(2)}% (gross profit ${statusOf(grossProfit)} on revenue ${statusOf(revenue)}).`, "DERIVED_METRIC", [`grossMargin=${ratios.grossMargin}`, `grossProfit=${statusOf(grossProfit)}`, `revenue=${statusOf(revenue)}`]);
  }

  if (ratios.currentRatio !== null) {
    push(interpretation, `The current ratio is ${ratios.currentRatio.toFixed(4)} (current assets ${statusOf(currentAssets)} / current liabilities ${statusOf(currentLiabilities)}).`, "DERIVED_METRIC", [`currentRatio=${ratios.currentRatio}`, `currentAssets=${statusOf(currentAssets)}`, `currentLiabilities=${statusOf(currentLiabilities)}`]);
    if (currentAssets !== null && currentLiabilities !== null && currentAssets >= currentLiabilities) {
      push(strengths, "Current assets cover current liabilities in the reported period.", "DERIVED_METRIC", [`currentAssets=${currentAssets}`, `currentLiabilities=${currentLiabilities}`]);
    } else if (currentAssets !== null && currentLiabilities !== null) {
      push(risks, `Current liabilities (${currentLiabilities}) exceed current assets (${currentAssets}); short-term obligations are not covered by short-term resources.`, "INTERPRETATION", [`currentAssets=${currentAssets}`, `currentLiabilities=${currentLiabilities}`]);
      push(managementActions, `Close the short-term coverage gap; current liabilities exceed current assets by ${currentLiabilities - currentAssets}.`, "MANAGEMENT_RECOMMENDATION", [`currentLiabilities=${currentLiabilities}`, `currentAssets=${currentAssets}`]);
    }
  } else {
    limitations.push("Current assets/current liabilities evidence is incomplete; liquidity ratios are unavailable.");
  }

  if (ratios.debtToAssets !== null) {
    push(interpretation, `Liabilities represent ${(ratios.debtToAssets * 100).toFixed(2)}% of total assets (liabilities ${statusOf(totalLiabilities)} / assets ${statusOf(totalAssets)}).`, "DERIVED_METRIC", [`debtToAssets=${ratios.debtToAssets}`]);
  }
  if (ratios.equityRatio !== null) {
    push(interpretation, `Equity funds ${(ratios.equityRatio * 100).toFixed(2)}% of total assets.`, "DERIVED_METRIC", [`equityRatio=${ratios.equityRatio}`]);
  }
  if (totalLiabilities !== null && equity !== null && totalLiabilities > equity) {
    push(risks, `Liabilities (${totalLiabilities}) exceed equity (${equity}); the capital structure is debt-heavy.`, "INTERPRETATION", [`totalLiabilities=${totalLiabilities}`, `equity=${equity}`]);
    push(managementActions, "Reduce leverage or strengthen equity to rebalance the capital structure.", "MANAGEMENT_RECOMMENDATION", [`totalLiabilities=${totalLiabilities}`, `equity=${equity}`]);
  }
  if (equity !== null && equity < 0) {
    push(risks, `Reported equity is negative (${equity}); liabilities exceed total assets.`, "INTERPRETATION", [`equity=${equity}`]);
  }

  const revenueChange = comparative.find((entry) => entry.line === "revenue");
  if (revenueChange) {
    const direction = revenueChange.absoluteChange >= 0 ? "increased" : "decreased";
    push(interpretation, `Revenue ${direction} by ${Math.abs(revenueChange.absoluteChange)} (${(revenueChange.pctChange * 100).toFixed(2)}%) versus the prior period.`, "DERIVED_METRIC", [`revenue.current=${revenueChange.current}`, `revenue.prior=${revenueChange.prior}`]);
    if (revenueChange.absoluteChange > 0) {
      push(strengths, "Revenue grew relative to the prior period.", "INTERPRETATION", [`revenueChange=${revenueChange.absoluteChange}`, `pctChange=${revenueChange.pctChange}`]);
      push(opportunities, `Revenue momentum is positive (+${(revenueChange.pctChange * 100).toFixed(2)}%); consolidate the drivers of growth.`, "INTERPRETATION", [`revenueChange=${revenueChange.absoluteChange}`]);
    } else if (revenueChange.absoluteChange < 0) {
      push(weaknesses, "Revenue declined relative to the prior period.", "INTERPRETATION", [`revenueChange=${revenueChange.absoluteChange}`, `pctChange=${revenueChange.pctChange}`]);
      push(managementActions, `Investigate the revenue decline of ${Math.abs(revenueChange.absoluteChange)} versus the prior period.`, "MANAGEMENT_RECOMMENDATION", [`revenueChange=${revenueChange.absoluteChange}`]);
    }
  }
  const netProfitChange = comparative.find((entry) => entry.line === "netIncome");
  if (netProfitChange) {
    const direction = netProfitChange.absoluteChange >= 0 ? "improved" : "weakened";
    push(interpretation, `Net profit ${direction} by ${Math.abs(netProfitChange.absoluteChange)} versus the prior period.`, "DERIVED_METRIC", [`netIncome.current=${netProfitChange.current}`, `netIncome.prior=${netProfitChange.prior}`]);
  }

  if (operatingCashFlow !== null) {
    push(interpretation, `Net operating cash flow is ${operatingCashFlow}.`, "EXTRACTED_FACT", [`operatingCashFlow=${operatingCashFlow}`]);
    if (operatingCashFlow > 0) {
      push(strengths, "Operations generated positive net cash flow.", "EXTRACTED_FACT", [`operatingCashFlow=${operatingCashFlow}`]);
    } else {
      push(risks, `Operating cash flow is negative (${operatingCashFlow}); ongoing operations consumed cash.`, "INTERPRETATION", [`operatingCashFlow=${operatingCashFlow}`]);
      push(managementActions, "Review working-capital and operating cash drivers to restore positive operating cash flow.", "MANAGEMENT_RECOMMENDATION", [`operatingCashFlow=${operatingCashFlow}`]);
    }
  } else {
    limitations.push("Operating cash-flow evidence is absent.");
  }

  const mismatch = integrity.filter((check) => check.status === "MISMATCH");
  for (const check of mismatch) {
    push(risks, `Accounting check "${check.id}" does not reconcile: expected ${check.expected}, actual ${check.actual} (difference ${check.difference}).`, "DERIVED_METRIC", [check.id]);
    limitations.push(`Accounting check "${check.id}" does not reconcile with the extracted lines (difference ${check.difference}).`);
  }

  if (document.status !== "COMPLETED") {
    limitations.push(`The document is ${document.status}; some sections may be incomplete.`);
  }
  for (const measure of derived.missingMeasures) {
    limitations.push(`Measure ${measure} was not extracted.`);
  }
  if (ratios.unavailable.length > 0) {
    limitations.push(`Ratios unavailable for lack of evidence: ${ratios.unavailable.join(", ")}.`);
  }

  return {
    documentStatus: document.status,
    currency: document.currency,
    unitMultiplier: document.unitMultiplier,
    periods,
    facts: facts.map((fact) => ({
      section: fact.section,
      measure: fact.measure,
      periodIndex: fact.periodIndex,
      periodLabel: fact.periodLabel,
      value: fact.value,
      currency: fact.currency,
      unitMultiplier: fact.unitMultiplier,
      confidence: fact.confidence,
      line: fact.evidence.line,
    })),
    metrics,
    statement: derived.statement,
    priorStatement: prior,
    ratios,
    comparative,
    integrity,
    unavailableRatios: ratios.unavailable,
    limitations,
    interpretation,
    strengths,
    weaknesses,
    risks,
    opportunities,
    managementActions,
    cashFlow: {
      operating: operatingCashFlow,
      investing: investingCashFlow,
      financing: financingCashFlow,
      net: netCashFlow,
    },
  };
}
