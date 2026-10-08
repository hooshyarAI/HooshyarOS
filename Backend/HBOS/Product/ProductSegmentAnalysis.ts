/**
 * Canonical product / segment profitability analytics.
 *
 * This is a focused composition service over the canonical product-segment
 * extraction owned by `FinancialDocumentUnderstanding`. It owns no new
 * financial-statement mathematics: it only aggregates the per-product revenue,
 * cost-of-goods-sold and gross profit actually printed in the document, and
 * derives standard, explicitly-defined contributions, concentration and mix
 * decomposition. Nothing is inferred from company-level totals, and every
 * absent input stays absent (a limitation is reported instead of a value).
 *
 * "High"/"low" margin is defined contextually against the same document's
 * overall gross margin, never against an invented universal threshold.
 */
import type {
  FinancialDocumentUnderstanding,
  ProductSegment,
  ProductSegmentPeriodValue,
} from "./FinancialDocumentUnderstanding";

export interface ProductSegmentContribution {
  readonly name: string;
  readonly unit: string;
  readonly revenue: number;
  readonly grossProfit: number | null;
  /** Gross profit / revenue, or null when revenue is non-positive or GP absent. */
  readonly grossMargin: number | null;
  /** Share of the document's total product revenue. */
  readonly revenueShare: number;
  /** Share of the document's total product gross profit. */
  readonly grossProfitShare: number | null;
  readonly quantitySold: number | null;
}

export interface ProductSegmentMixEffect {
  readonly priorOverallGrossMargin: number;
  readonly currentOverallGrossMargin: number;
  readonly marginChange: number;
  /**
   * Contribution of the sales-mix shift to the margin change: the prior-period
   * revenue weights applied to the current segment margins, minus the prior
   * overall margin. Positive means mix shifted toward higher-margin products.
   */
  readonly mixEffect: number;
  /**
   * The residual margin change not explained by mix (rate/price and cost
   * movements within products): current overall margin minus the mix-weighted
   * prior-weight margin.
   */
  readonly rateCostEffect: number;
}

export interface ProductSegmentAnalytics {
  readonly currency: string;
  readonly unitMultiplier: number;
  readonly segmentCount: number;
  readonly contributions: readonly ProductSegmentContribution[];
  readonly totalRevenue: number;
  readonly totalGrossProfit: number;
  readonly overallGrossMargin: number | null;
  readonly topRevenueContribution: ProductSegmentContribution | null;
  readonly topGrossProfitContribution: ProductSegmentContribution | null;
  /** Herfindahl-Hirschman index of revenue shares (0..1); 1 = a single product. */
  readonly revenueHhi: number | null;
  /** Segments whose gross margin exceeds the document's overall gross margin. */
  readonly highMargin: readonly ProductSegmentContribution[];
  /** Profitable segments at or below the document's overall gross margin. */
  readonly lowMargin: readonly ProductSegmentContribution[];
  /** Segments with a negative gross margin. */
  readonly negativeMargin: readonly ProductSegmentContribution[];
  readonly mixEffect: ProductSegmentMixEffect | null;
  readonly limitations: readonly string[];
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

const grossMarginOf = (value: ProductSegmentPeriodValue): number | null =>
  value.revenue > 0 && value.grossProfit !== null ? value.grossProfit / value.revenue : null;

function overallMargin(segments: readonly ProductSegment[], period: "current" | "prior"): { revenue: number; grossProfit: number; margin: number | null } {
  const values = segments
    .map((segment) => (period === "current" ? segment.current : segment.prior))
    .filter((value): value is ProductSegmentPeriodValue => value !== null);
  const revenue = sum(values.map((value) => value.revenue));
  const allGpPresent = values.length > 0 && values.every((value) => value.grossProfit !== null);
  const grossProfit = sum(values.filter((value) => value.grossProfit !== null).map((value) => value.grossProfit as number));
  if (!allGpPresent || values.length !== segments.length) return { revenue, grossProfit, margin: null };
  return { revenue, grossProfit, margin: revenue > 0 ? grossProfit / revenue : null };
}

export function analyzeProductSegments(document: FinancialDocumentUnderstanding): ProductSegmentAnalytics | null {
  const segments = document.segments ?? [];
  if (segments.length === 0) return null;

  const current = overallMargin(segments, "current");
  const totalRevenue = current.revenue;
  const totalGrossProfit = current.grossProfit;
  const overallGrossMargin = current.margin;

  const contributions: ProductSegmentContribution[] = segments.map((segment) => {
    const revenue = segment.current.revenue;
    const grossProfit = segment.current.grossProfit;
    return {
      name: segment.name,
      unit: segment.unit,
      revenue,
      grossProfit,
      grossMargin: grossMarginOf(segment.current),
      revenueShare: totalRevenue !== 0 ? revenue / totalRevenue : 0,
      grossProfitShare: totalGrossProfit !== 0 && grossProfit !== null ? grossProfit / totalGrossProfit : null,
      quantitySold: segment.current.quantitySold,
    };
  });

  const withMargin = contributions.filter((entry) => entry.grossMargin !== null);
  const highMargin = overallGrossMargin === null
    ? []
    : withMargin.filter((entry) => (entry.grossMargin as number) > overallGrossMargin);
  const lowMargin = overallGrossMargin === null
    ? []
    : withMargin.filter((entry) => (entry.grossMargin as number) >= 0 && (entry.grossMargin as number) <= overallGrossMargin);
  const negativeMargin = withMargin.filter((entry) => (entry.grossMargin as number) < 0);

  const topRevenueContribution = contributions.length > 0
    ? contributions.reduce((best, entry) => (entry.revenueShare > best.revenueShare ? entry : best))
    : null;
  const grossProfitContributions = contributions.filter((entry) => entry.grossProfitShare !== null);
  const topGrossProfitContribution = grossProfitContributions.length > 0
    ? grossProfitContributions.reduce((best, entry) => ((entry.grossProfitShare as number) > (best.grossProfitShare as number) ? entry : best))
    : null;
  const revenueHhi = totalRevenue > 0
    ? contributions.reduce((total, entry) => total + entry.revenueShare ** 2, 0)
    : null;

  const limitations: string[] = [
    "ارقام محصول/بخش از جدول درآمدها و بهای تمام شده خودِ سند استخراج شده‌اند و از جمع‌های کل شرکت استنتاج نشده‌اند.",
  ];
  if (current.margin === null) {
    limitations.push("برای بخشی از محصولات، سود ناخالص یا درآمد کامل در سند موجود نیست؛ حاشیه سود کل فقط برای ردیف‌های دارای شاهد محاسبه می‌شود.");
  }

  const prior = overallMargin(segments, "prior");
  let mixEffect: ProductSegmentMixEffect | null = null;
  if (prior.margin !== null && current.margin !== null && prior.revenue > 0) {
    // Only prior-period products with a real prior revenue carry mix weight; a
    // zero-revenue segment cannot move the prior mix. Every weighted segment
    // must still expose a current gross margin, otherwise the decomposition is
    // not defined and is reported as unavailable.
    const priorActive = segments.filter(
      (segment): segment is ProductSegment & { prior: ProductSegmentPeriodValue } =>
        segment.prior !== null && segment.prior.revenue > 0,
    );
    const allHaveCurrentMargin = priorActive.length > 0 && priorActive.every((segment) => grossMarginOf(segment.current) !== null);
    if (allHaveCurrentMargin) {
      const weightedCurrentMargin = sum(
        priorActive.map((segment) => (segment.prior.revenue / prior.revenue) * (grossMarginOf(segment.current) as number)),
      );
      mixEffect = {
        priorOverallGrossMargin: prior.margin,
        currentOverallGrossMargin: current.margin,
        marginChange: current.margin - prior.margin,
        mixEffect: weightedCurrentMargin - prior.margin,
        rateCostEffect: current.margin - weightedCurrentMargin,
      };
    } else {
      limitations.push("تحلیل اثر ترکیب فروش ممکن نیست؛ برای برخی محصولات با فروش دوره قبل، حاشیه سود دوره جاری موجود نیست.");
    }
  } else if (prior.revenue === 0) {
    limitations.push("دوره مقایسه‌ای برای تحلیل ترکیب فروش در سند موجود نیست.");
  }

  return {
    currency: document.currency ?? "IRR",
    unitMultiplier: document.unitMultiplier,
    segmentCount: segments.length,
    contributions,
    totalRevenue,
    totalGrossProfit,
    overallGrossMargin,
    topRevenueContribution,
    topGrossProfitContribution,
    revenueHhi,
    highMargin,
    lowMargin,
    negativeMargin,
    mixEffect,
    limitations,
  };
}
