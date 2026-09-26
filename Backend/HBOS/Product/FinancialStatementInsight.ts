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
 * and is reported as a limitation. Signed economics are preserved: losses,
 * negative margins/returns, negative equity and negative cash flows are valid
 * statement evidence and are interpreted honestly rather than coerced to zero
 * or silently dropped. A ratio that is financially undefined (for example
 * debt/equity with non-positive equity) is reported as not-applicable with a
 * reason instead of being hidden as "unavailable for lack of evidence".
 */
import type {
  FinancialDocumentUnderstanding,
  DerivedAnalysisInput,
  FinancialStatementFact,
  StatementMeasure,
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
  /** Ratios whose evidence is absent. */
  readonly unavailable: readonly string[];
  /** Ratios whose evidence exists but is financially undefined (with reason). */
  readonly notApplicable: readonly string[];
}

export interface ComparativeEntry {
  readonly line: string;
  readonly current: number;
  readonly prior: number;
  readonly absoluteChange: number;
  /** Null when mathematically undefined (prior zero) or misleading (sign reversal). */
  readonly pctChange: number | null;
  readonly signReversal: boolean;
  readonly pctChangeUnavailableReason?: "prior-value-zero" | "sign-reversal";
}

export interface StatementIntegrityCheck {
  readonly id: string;
  readonly description: string;
  readonly status: "RECONCILED" | "MISMATCH" | "NOT_TESTABLE";
  /** Expected value from the accounting identity, or null when not testable. */
  readonly expected: number | null;
  /** Extracted/derived actual value, or null when not testable. */
  readonly actual: number | null;
  readonly difference: number | null;
  /** Required evidence that is absent when the check is NOT_TESTABLE. */
  readonly missing: readonly string[];
}

export type QualityOfEarnings = "CASH_BACKED" | "PROFIT_NOT_CASH_BACKED" | "UNAVAILABLE";

export interface StatementCashFlowView {
  readonly operating: number | null;
  readonly investing: number | null;
  readonly financing: number | null;
  readonly net: number | null;
  readonly priorOperating: number | null;
  /** CFO + CFI + CFF = net cash flow, when all four measures exist. */
  readonly reconciliation: StatementIntegrityCheck | null;
  readonly qualityOfEarnings: QualityOfEarnings;
}

export interface StatementDerivedResidual {
  readonly value: number;
  readonly basis: "DERIVED_RESIDUAL";
  readonly note: string;
}

export type MetricEvidence = "EXTRACTED_FACT" | "DERIVED_METRIC" | "UNAVAILABLE";

export interface FinancialStatementInsight {
  readonly documentStatus: string;
  readonly currency: string | null;
  readonly unitMultiplier: number;
  readonly periods: readonly { readonly index: number; readonly label: string }[];
  readonly facts: readonly CanonicalFactView[];
  readonly metrics: Readonly<Record<string, number | null>>;
  /** Evidence level of each metric key: extracted from the document or derived. */
  readonly metricEvidence: Readonly<Record<string, MetricEvidence>>;
  readonly statement: Partial<RatioStatement>;
  readonly priorStatement: Partial<RatioStatement>;
  readonly ratios: StatementRatioView;
  readonly comparative: readonly ComparativeEntry[];
  readonly integrity: readonly StatementIntegrityCheck[];
  readonly unavailableRatios: readonly string[];
  /** Derived residual expense (revenue − net profit), clearly labelled. */
  readonly derivedResidual: StatementDerivedResidual | null;
  readonly limitations: readonly string[];
  readonly interpretation: readonly StatementInsightFinding[];
  readonly strengths: readonly StatementInsightFinding[];
  readonly weaknesses: readonly StatementInsightFinding[];
  readonly risks: readonly StatementInsightFinding[];
  readonly opportunities: readonly StatementInsightFinding[];
  readonly managementActions: readonly StatementInsightFinding[];
  readonly cashFlow: StatementCashFlowView;
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

const factAtPeriod = (
  facts: readonly FinancialStatementFact[],
  measure: StatementMeasure,
  periodIndex: number,
): number | null => {
  const match = facts.find((fact) => fact.measure === measure && fact.periodIndex === periodIndex);
  return match ? match.value : null;
};

const statusOf = (value: number | null): string => (value === null ? "unavailable" : String(value));

const viewFor = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const pctText = (entry: ComparativeEntry): string => {
  if (entry.pctChange === null) {
    return entry.pctChangeUnavailableReason === "sign-reversal"
      ? "percentage change not meaningful (sign reversal)"
      : "percentage change unavailable (prior period was zero)";
  }
  return `${(entry.pctChange * 100).toFixed(2)}%`;
};

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
    notApplicable: [
      ...(profitability?.notApplicable ?? []),
      ...(leverage?.notApplicable ?? []),
      ...(liquidity?.notApplicable ?? []),
    ],
  };

  const revenue = viewFor(derived.statement.revenue);
  const cogs = viewFor(derived.statement.cogs);
  const grossProfit = viewFor(derived.statement.grossProfit);
  const operatingExpenses = viewFor(derived.statement.operatingExpenses);
  const operatingProfit = viewFor(derived.statement.operatingIncome);
  const netProfit = viewFor(derived.statement.netIncome);
  const preTaxIncome = viewFor(derived.statement.preTaxIncome);
  const taxes = viewFor(derived.statement.taxes);
  const currentAssets = viewFor(derived.statement.currentAssets);
  const totalAssets = viewFor(derived.statement.totalAssets);
  const currentLiabilities = viewFor(derived.statement.currentLiabilities);
  const totalLiabilities = viewFor(derived.statement.totalLiabilities);
  const equity = viewFor(derived.statement.equity);

  const operatingCashFlow = currentFact(facts, "OPERATING_CASH_FLOW");
  const investingCashFlow = currentFact(facts, "INVESTING_CASH_FLOW");
  const financingCashFlow = currentFact(facts, "FINANCING_CASH_FLOW");
  const netCashFlow = currentFact(facts, "NET_CASH_FLOW");
  const priorOperatingCashFlow = factAtPeriod(facts, "OPERATING_CASH_FLOW", 1);

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

  const hasMeasure = (measure: StatementMeasure): boolean =>
    facts.some((fact) => fact.measure === measure && fact.periodIndex === 0);
  const metricEvidence: Record<string, MetricEvidence> = {
    revenue: hasMeasure("REVENUE") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    cogs: hasMeasure("COGS") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    grossProfit: hasMeasure("GROSS_PROFIT") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    operatingExpenses: hasMeasure("OPERATING_EXPENSES") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    operatingProfit: hasMeasure("OPERATING_PROFIT") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    netProfit: hasMeasure("NET_PROFIT") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    currentAssets: hasMeasure("CURRENT_ASSETS") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    totalAssets: hasMeasure("ASSETS") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    currentLiabilities: hasMeasure("CURRENT_LIABILITIES") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    totalLiabilities: hasMeasure("LIABILITIES") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    equity: hasMeasure("EQUITY") ? "EXTRACTED_FACT" : "UNAVAILABLE",
    operatingCashFlow: operatingCashFlow !== null ? "EXTRACTED_FACT" : "UNAVAILABLE",
    investingCashFlow: investingCashFlow !== null ? "EXTRACTED_FACT" : "UNAVAILABLE",
    financingCashFlow: financingCashFlow !== null ? "EXTRACTED_FACT" : "UNAVAILABLE",
    netCashFlow: netCashFlow !== null ? "EXTRACTED_FACT" : "UNAVAILABLE",
    analysisExpensesResidual: derived.analysisExpenses !== null ? "DERIVED_METRIC" : "UNAVAILABLE",
  };

  const comparative: ComparativeEntry[] = (analytics?.ratios?.horizontal?.entries ?? []).map((entry) => ({
    line: entry.line,
    current: entry.current,
    prior: entry.prior,
    absoluteChange: entry.absoluteChange,
    pctChange: entry.pctChange,
    signReversal: entry.signReversal,
    ...(entry.pctChangeUnavailableReason ? { pctChangeUnavailableReason: entry.pctChangeUnavailableReason } : {}),
  }));

  const periods = Array.from(
    new Map(
      facts.map((fact) => [fact.periodIndex, { index: fact.periodIndex, label: fact.periodLabel }]),
    ).values(),
  ).sort((a, b) => a.index - b.index);

  /* ---------------------------------------------------------------------- *
   * Cross-statement integrity checks (testable only when evidence exists)  *
   * ---------------------------------------------------------------------- */
  const integrity: StatementIntegrityCheck[] = [];
  const toleranceFor = (expected: number): number => Math.max(1, Math.abs(expected) * 1e-6);
  const pushCheck = (
    id: string,
    description: string,
    computeExpected: () => number | null,
    actualFact: number | null,
    required: readonly string[],
  ): void => {
    const expected = computeExpected();
    const missing = required.filter((name) => {
      switch (name) {
        case "revenue": return revenue === null;
        case "cogs": return cogs === null;
        case "grossProfit": return grossProfit === null;
        case "operatingExpenses": return operatingExpenses === null;
        case "operatingProfit": return operatingProfit === null;
        case "preTaxIncome": return preTaxIncome === null;
        case "taxes": return taxes === null;
        case "netProfit": return netProfit === null;
        case "totalAssets": return totalAssets === null;
        case "totalLiabilities": return totalLiabilities === null;
        case "equity": return equity === null;
        case "operatingCashFlow": return operatingCashFlow === null;
        case "investingCashFlow": return investingCashFlow === null;
        case "financingCashFlow": return financingCashFlow === null;
        case "netCashFlow": return netCashFlow === null;
        default: return true;
      }
    });
    if (expected === null || actualFact === null || missing.length > 0) {
      integrity.push({ id, description, status: "NOT_TESTABLE", expected: null, actual: actualFact, difference: null, missing });
      return;
    }
    const difference = actualFact - expected;
    integrity.push({
      id,
      description,
      status: Math.abs(difference) <= toleranceFor(expected) ? "RECONCILED" : "MISMATCH",
      expected,
      actual: actualFact,
      difference,
      missing: [],
    });
  };

  pushCheck(
    "balance-sheet-identity",
    "Total liabilities + equity should equal total assets.",
    () => (totalLiabilities !== null && equity !== null ? totalLiabilities + equity : null),
    totalAssets,
    ["totalLiabilities", "equity", "totalAssets"],
  );
  pushCheck(
    "gross-profit-identity",
    "Revenue - COGS should equal gross profit.",
    () => (revenue !== null && cogs !== null ? revenue - cogs : null),
    grossProfit,
    ["revenue", "cogs", "grossProfit"],
  );
  pushCheck(
    "operating-profit-identity",
    "Gross profit - operating expenses should equal operating profit.",
    () => (grossProfit !== null && operatingExpenses !== null ? grossProfit - operatingExpenses : null),
    operatingProfit,
    ["grossProfit", "operatingExpenses", "operatingProfit"],
  );
  // Operating profit + non-operating items should equal pre-tax profit, but no
  // canonical non-operating measure exists, so a difference can never be
  // attributed to a mismatch. It is NOT_TESTABLE unless the two are equal.
  if (operatingProfit === null || preTaxIncome === null) {
    integrity.push({
      id: "pre-tax-identity",
      description: "Operating profit + non-operating items should equal pre-tax profit.",
      status: "NOT_TESTABLE",
      expected: null,
      actual: preTaxIncome,
      difference: null,
      missing: [
        ...(operatingProfit === null ? ["operatingProfit"] : []),
        ...(preTaxIncome === null ? ["preTaxIncome"] : []),
      ],
    });
  } else if (Math.abs(preTaxIncome - operatingProfit) <= toleranceFor(operatingProfit)) {
    integrity.push({
      id: "pre-tax-identity",
      description: "Operating profit + non-operating items should equal pre-tax profit.",
      status: "RECONCILED",
      expected: operatingProfit,
      actual: preTaxIncome,
      difference: preTaxIncome - operatingProfit,
      missing: [],
    });
  } else {
    integrity.push({
      id: "pre-tax-identity",
      description: "Operating profit + non-operating items should equal pre-tax profit.",
      status: "NOT_TESTABLE",
      expected: operatingProfit,
      actual: preTaxIncome,
      difference: preTaxIncome - operatingProfit,
      missing: ["nonOperatingItems"],
    });
  }
  pushCheck(
    "net-profit-identity",
    "Pre-tax profit - taxes should equal net profit.",
    () => (preTaxIncome !== null && taxes !== null ? preTaxIncome - taxes : null),
    netProfit,
    ["preTaxIncome", "taxes", "netProfit"],
  );

  // Cash-flow reconciliation is testable from the canonical cash-flow measures.
  let reconciliation: StatementIntegrityCheck | null = null;
  if (
    operatingCashFlow !== null && investingCashFlow !== null &&
    financingCashFlow !== null && netCashFlow !== null
  ) {
    const expected = operatingCashFlow + investingCashFlow + financingCashFlow;
    const difference = netCashFlow - expected;
    reconciliation = {
      id: "cash-flow-identity",
      description: "Operating + investing + financing cash flows should equal the net cash change.",
      status: Math.abs(difference) <= toleranceFor(expected) ? "RECONCILED" : "MISMATCH",
      expected,
      actual: netCashFlow,
      difference,
      missing: [],
    };
  } else {
    reconciliation = {
      id: "cash-flow-identity",
      description: "Operating + investing + financing cash flows should equal the net cash change.",
      status: "NOT_TESTABLE",
      expected: null,
      actual: netCashFlow,
      difference: null,
      missing: [
        ...(operatingCashFlow === null ? ["operatingCashFlow"] : []),
        ...(investingCashFlow === null ? ["investingCashFlow"] : []),
        ...(financingCashFlow === null ? ["financingCashFlow"] : []),
        ...(netCashFlow === null ? ["netCashFlow"] : []),
      ],
    };
  }
  integrity.push(reconciliation);

  /* ---------------------------------------------------------------------- *
   * Interpretation, findings and grounded management actions               *
   * ---------------------------------------------------------------------- */
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
      `Extracted net profit is ${netProfit} on revenue ${revenue}.`,
      "EXTRACTED_FACT",
      [`netProfit=${netProfit}`, `revenue=${revenue}`],
    );
    push(
      interpretation,
      margin === null
        ? "A net margin could not be computed because the revenue base is zero."
        : `Net margin is ${(margin * 100).toFixed(2)}% (net profit ${netProfit} / revenue ${revenue}).`,
      "DERIVED_METRIC",
      [`netProfit=${netProfit}`, `revenue=${revenue}`],
    );
    if (netProfit > 0) {
      push(strengths, `The period produced a positive net profit of ${netProfit}.`, "EXTRACTED_FACT", [`netProfit=${netProfit}`]);
    } else if (netProfit < 0) {
      push(weaknesses, `The period closed with a net loss of ${netProfit}.`, "EXTRACTED_FACT", [`netProfit=${netProfit}`]);
      push(
        risks,
        `Continued losses would erode equity; reported equity is ${statusOf(equity)} and the loss is ${netProfit}.`,
        "INTERPRETATION",
        [`netProfit=${netProfit}`, `equity=${statusOf(equity)}`],
      );
      push(
        managementActions,
        `Investigate the specific drivers of the net loss of ${Math.abs(netProfit)} (gross margin, operating expenses and non-operating items) before committing further growth expenditure.`,
        "MANAGEMENT_RECOMMENDATION",
        [`netProfit=${netProfit}`],
      );
    }
  } else {
    limitations.push("Net profit or revenue evidence is absent; profitability interpretation is unavailable.");
  }

  if (ratios.grossMargin !== null) {
    push(
      interpretation,
      `Gross margin is ${(ratios.grossMargin * 100).toFixed(2)}% (gross profit ${statusOf(grossProfit)} on revenue ${statusOf(revenue)}).`,
      "DERIVED_METRIC",
      [`grossMargin=${ratios.grossMargin}`, `grossProfit=${statusOf(grossProfit)}`, `revenue=${statusOf(revenue)}`],
    );
  }
  if (ratios.operatingMargin !== null) {
    push(
      interpretation,
      `Operating margin is ${(ratios.operatingMargin * 100).toFixed(2)}% (operating profit ${statusOf(operatingProfit)} on revenue ${statusOf(revenue)}).`,
      "DERIVED_METRIC",
      [`operatingMargin=${ratios.operatingMargin}`],
    );
  }

  if (ratios.currentRatio !== null) {
    push(
      interpretation,
      `The current ratio is ${ratios.currentRatio.toFixed(4)} (current assets ${statusOf(currentAssets)} / current liabilities ${statusOf(currentLiabilities)}).`,
      "DERIVED_METRIC",
      [`currentRatio=${ratios.currentRatio}`, `currentAssets=${statusOf(currentAssets)}`, `currentLiabilities=${statusOf(currentLiabilities)}`],
    );
    if (currentAssets !== null && currentLiabilities !== null && currentAssets >= currentLiabilities) {
      push(strengths, "Current assets cover current liabilities in the reported period.", "DERIVED_METRIC", [`currentAssets=${currentAssets}`, `currentLiabilities=${currentLiabilities}`]);
    } else if (currentAssets !== null && currentLiabilities !== null) {
      push(risks, `Current liabilities (${currentLiabilities}) exceed current assets (${currentAssets}); short-term obligations are not covered by short-term resources.`, "INTERPRETATION", [`currentAssets=${currentAssets}`, `currentLiabilities=${currentLiabilities}`]);
      push(managementActions, `Close the short-term coverage gap; current liabilities exceed current assets by ${currentLiabilities - currentAssets}.`, "MANAGEMENT_RECOMMENDATION", [`currentLiabilities=${currentLiabilities}`, `currentAssets=${currentAssets}`]);
    }
  } else if (ratios.notApplicable.some((item) => item.startsWith("currentRatio"))) {
    // explained via the notApplicable limitation below
  } else {
    limitations.push("Current assets/current liabilities evidence is incomplete; liquidity ratios are unavailable.");
  }

  if (ratios.debtToAssets !== null) {
    push(
      interpretation,
      `Liabilities represent ${(ratios.debtToAssets * 100).toFixed(2)}% of total assets (liabilities ${statusOf(totalLiabilities)} / assets ${statusOf(totalAssets)}).`,
      "DERIVED_METRIC",
      [`debtToAssets=${ratios.debtToAssets}`],
    );
  }
  if (ratios.equityRatio !== null) {
    push(
      interpretation,
      `Equity funds ${(ratios.equityRatio * 100).toFixed(2)}% of total assets.`,
      "DERIVED_METRIC",
      [`equityRatio=${ratios.equityRatio}`],
    );
  }

  if (equity !== null && equity < 0) {
    push(
      risks,
      `Reported equity is negative (${equity}); liabilities exceed total assets. Debt/equity and ROE are not applicable because equity is non-positive, and the capital structure depends on continued creditor support.`,
      "INTERPRETATION",
      [`equity=${equity}`, `totalAssets=${statusOf(totalAssets)}`, `totalLiabilities=${statusOf(totalLiabilities)}`],
    );
    push(
      managementActions,
      "Investigate the accumulated-loss and liability drivers of negative equity and secure a capital-restoration plan before additional leverage.",
      "MANAGEMENT_RECOMMENDATION",
      [`equity=${equity}`],
    );
  } else if (totalLiabilities !== null && equity !== null && equity > 0 && totalLiabilities > equity) {
    push(
      risks,
      `Liabilities (${totalLiabilities}) exceed equity (${equity}); the capital structure is debt-heavy.`,
      "INTERPRETATION",
      [`totalLiabilities=${totalLiabilities}`, `equity=${equity}`],
    );
    push(
      managementActions,
      `Reduce leverage or strengthen equity to rebalance the capital structure; debt exceeds equity by ${totalLiabilities - equity}.`,
      "MANAGEMENT_RECOMMENDATION",
      [`totalLiabilities=${totalLiabilities}`, `equity=${equity}`],
    );
  }

  /* Comparative / trend interpretation (honest about undefined percentages) */
  const revenueChange = comparative.find((entry) => entry.line === "revenue");
  if (revenueChange) {
    const direction = revenueChange.absoluteChange > 0 ? "increased" : revenueChange.absoluteChange < 0 ? "decreased" : "was unchanged";
    push(
      interpretation,
      `Revenue ${direction} by ${Math.abs(revenueChange.absoluteChange)} (${pctText(revenueChange)}) versus the prior period.`,
      "DERIVED_METRIC",
      [`revenue.current=${revenueChange.current}`, `revenue.prior=${revenueChange.prior}`],
    );
    if (revenueChange.absoluteChange > 0) {
      push(strengths, "Revenue grew relative to the prior period.", "INTERPRETATION", [`revenueChange=${revenueChange.absoluteChange}`]);
      const momentum = revenueChange.pctChange === null
        ? `Revenue increased by ${Math.abs(revenueChange.absoluteChange)} versus the prior period (${pctText(revenueChange)}).`
        : `Revenue increased ${(revenueChange.pctChange * 100).toFixed(2)}% versus the prior period.`;
      push(
        opportunities,
        `${momentum} Confirm the operational drivers and preserve the working-capital and cash-flow capacity required to sustain it.`,
        "INTERPRETATION",
        [`revenueChange=${revenueChange.absoluteChange}`],
      );
    } else if (revenueChange.absoluteChange < 0) {
      push(weaknesses, "Revenue declined relative to the prior period.", "INTERPRETATION", [`revenueChange=${revenueChange.absoluteChange}`]);
      push(managementActions, `Investigate the revenue decline of ${Math.abs(revenueChange.absoluteChange)} versus the prior period.`, "MANAGEMENT_RECOMMENDATION", [`revenueChange=${revenueChange.absoluteChange}`]);
    }
  }
  const netProfitChange = comparative.find((entry) => entry.line === "netIncome");
  if (netProfitChange) {
    if (netProfitChange.signReversal) {
      const moved = netProfitChange.current >= 0
        ? `changed from a loss of ${Math.abs(netProfitChange.prior)} to a profit of ${netProfitChange.current}`
        : `changed from a profit of ${netProfitChange.prior} to a loss of ${Math.abs(netProfitChange.current)}`;
      push(
        interpretation,
        `Net result ${moved} between periods; the absolute change is ${netProfitChange.absoluteChange} and a single percentage would be misleading.`,
        "DERIVED_METRIC",
        [`netIncome.current=${netProfitChange.current}`, `netIncome.prior=${netProfitChange.prior}`, "signReversal=true"],
      );
    } else {
      const direction = netProfitChange.absoluteChange > 0 ? "improved" : netProfitChange.absoluteChange < 0 ? "weakened" : "was unchanged";
      push(
        interpretation,
        `Net profit ${direction} by ${Math.abs(netProfitChange.absoluteChange)} (${pctText(netProfitChange)}) versus the prior period.`,
        "DERIVED_METRIC",
        [`netIncome.current=${netProfitChange.current}`, `netIncome.prior=${netProfitChange.prior}`],
      );
    }
  }

  /* Cash-flow interpretation (operating, investing, financing, net, quality) */
  let qualityOfEarnings: QualityOfEarnings = "UNAVAILABLE";
  if (operatingCashFlow !== null) {
    push(interpretation, `Net operating cash flow is ${operatingCashFlow}.`, "EXTRACTED_FACT", [`operatingCashFlow=${operatingCashFlow}`]);
    if (operatingCashFlow > 0) {
      push(strengths, "Operations generated positive net cash flow.", "EXTRACTED_FACT", [`operatingCashFlow=${operatingCashFlow}`]);
    } else if (operatingCashFlow < 0) {
      push(risks, `Operating cash flow is negative (${operatingCashFlow}); ongoing operations consumed cash.`, "INTERPRETATION", [`operatingCashFlow=${operatingCashFlow}`]);
      push(managementActions, `Review working-capital and operating cash drivers to restore positive operating cash flow; the reported operating cash outflow is ${Math.abs(operatingCashFlow)}.`, "MANAGEMENT_RECOMMENDATION", [`operatingCashFlow=${operatingCashFlow}`]);
    }
    if (priorOperatingCashFlow !== null && priorOperatingCashFlow < 0 && operatingCashFlow >= 0) {
      push(interpretation, `Operating cash flow reversed from negative ${priorOperatingCashFlow} in the prior period to positive ${operatingCashFlow} in the current period.`, "DERIVED_METRIC", [`operatingCashFlow.prior=${priorOperatingCashFlow}`, `operatingCashFlow.current=${operatingCashFlow}`]);
    } else if (priorOperatingCashFlow !== null && priorOperatingCashFlow >= 0 && operatingCashFlow < 0) {
      push(risks, `Operating cash flow reversed from positive ${priorOperatingCashFlow} in the prior period to negative ${operatingCashFlow} in the current period.`, "DERIVED_METRIC", [`operatingCashFlow.prior=${priorOperatingCashFlow}`, `operatingCashFlow.current=${operatingCashFlow}`]);
    }
  } else {
    limitations.push("Operating cash-flow evidence is absent.");
  }
  if (investingCashFlow !== null) {
    push(
      interpretation,
      investingCashFlow < 0
        ? `Investing activities absorbed ${Math.abs(investingCashFlow)} of cash; confirm whether this reflects maintenance or growth capital expenditure.`
        : `Investing activities generated ${investingCashFlow} of cash.`,
      "EXTRACTED_FACT",
      [`investingCashFlow=${investingCashFlow}`],
    );
  }
  if (financingCashFlow !== null) {
    push(
      interpretation,
      financingCashFlow < 0
        ? `Financing activities used ${Math.abs(financingCashFlow)} of cash (debt service, repayments or distributions).`
        : `Financing activities provided ${financingCashFlow} of cash.`,
      "EXTRACTED_FACT",
      [`financingCashFlow=${financingCashFlow}`],
    );
  }
  if (netCashFlow !== null) {
    push(
      interpretation,
      `Net cash change over the period is ${netCashFlow}.`,
      "EXTRACTED_FACT",
      [`netCashFlow=${netCashFlow}`],
    );
    if (netCashFlow < 0) {
      push(risks, `Overall cash decreased by ${Math.abs(netCashFlow)} over the period.`, "INTERPRETATION", [`netCashFlow=${netCashFlow}`]);
    }
  }
  if (operatingCashFlow !== null && netProfit !== null) {
    if (operatingCashFlow >= netProfit) {
      qualityOfEarnings = "CASH_BACKED";
      push(strengths, `Operating cash flow (${operatingCashFlow}) covers the reported net profit (${netProfit}); earnings are cash-backed.`, "DERIVED_METRIC", [`operatingCashFlow=${operatingCashFlow}`, `netProfit=${netProfit}`]);
    } else {
      qualityOfEarnings = "PROFIT_NOT_CASH_BACKED";
      push(weaknesses, `Operating cash flow (${operatingCashFlow}) is below reported net profit (${netProfit}); earnings are not fully cash-backed and may depend on accruals or non-cash income.`, "DERIVED_METRIC", [`operatingCashFlow=${operatingCashFlow}`, `netProfit=${netProfit}`]);
      push(managementActions, `Reconcile the gap of ${netProfit - operatingCashFlow} between net profit and operating cash flow to identify non-cash or accrual drivers.`, "MANAGEMENT_RECOMMENDATION", [`operatingCashFlow=${operatingCashFlow}`, `netProfit=${netProfit}`]);
    }
  }

  /* Derived residual disclosure — never presented as an extracted expense */
  let derivedResidual: StatementDerivedResidual | null = null;
  if (derived.analysisExpenses !== null) {
    derivedResidual = {
      value: derived.analysisExpenses,
      basis: "DERIVED_RESIDUAL",
      note: "Revenue minus net profit. This is a derived residual expense burden, not an extracted accounting total; it bundles COGS, operating expenses, finance cost, tax and non-operating items.",
    };
    push(
      interpretation,
      `The analysis contract's total-expense input is a derived residual of ${derived.analysisExpenses} (revenue − net profit); it is not an extracted accounting total.`,
      "DERIVED_METRIC",
      [`revenue=${statusOf(revenue)}`, `netProfit=${statusOf(netProfit)}`],
    );
    limitations.push(derivedResidual.note);
  }

  /* Integrity results */
  for (const check of integrity) {
    if (check.status === "MISMATCH") {
      push(risks, `Accounting check "${check.id}" does not reconcile: expected ${check.expected}, actual ${check.actual} (difference ${check.difference}).`, "DERIVED_METRIC", [check.id]);
      const extra = check.id === "operating-profit-identity"
        ? " Intermediate operating lines (for example other operating income or expenses) may exist between gross profit and operating profit in the source statement but are not represented in the canonical measures."
        : "";
      limitations.push(`Accounting check "${check.id}" does not reconcile with the extracted lines (difference ${check.difference}).${extra}`);
    }
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
  for (const reason of ratios.notApplicable) {
    const [ratio, cause] = reason.split(":");
    if (cause === "equity-non-positive") {
      limitations.push(`${ratio} is not applicable: equity is zero or negative, so the ratio would be financially misleading.`);
    } else if (cause === "current-liabilities-non-positive") {
      limitations.push(`${ratio} is not applicable: current liabilities are zero or negative, so the ratio denominator is undefined.`);
    } else {
      limitations.push(`${ratio} is not applicable (${cause}).`);
    }
  }
  // Growth grounding: statement evidence bounds what can be concluded.
  limitations.push("This statement cannot establish market demand, competitive position or future sales; growth-readiness conclusions are limited to financial capacity (profitability, liquidity, leverage, cash generation and trend).");

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
    metricEvidence,
    statement: derived.statement,
    priorStatement: prior,
    ratios,
    comparative,
    integrity,
    unavailableRatios: ratios.unavailable,
    derivedResidual,
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
      priorOperating: priorOperatingCashFlow,
      reconciliation,
      qualityOfEarnings,
    },
  };
}
