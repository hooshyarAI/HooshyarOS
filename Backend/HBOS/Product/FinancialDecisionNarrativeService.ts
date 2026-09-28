/**
 * product.financial-decision-narrative — Persian-first decision-support
 * narrative composed over the governed statement insight.
 *
 * This is a COMPOSITION service, not an Engine and not a second financial
 * model. It owns no financial mathematics: every value it renders comes from
 * the already-verified `FinancialStatementInsight` (canonical facts, derived
 * metrics, ratios, comparative, integrity checks and cash-flow view). It routes
 * a user question to the appropriate answer structure and turns the verified
 * evidence into a question-specific Persian answer.
 *
 * Rules enforced here (mirroring the governing charter):
 *   - A user asking a question must receive an answer to THAT question: the
 *     intent is classified and the answer structure changes accordingly.
 *   - Every statement is traceable to evidence or is explicitly labelled as an
 *     interpretation/recommendation/assumption.
 *   - Ratios are indicators, never automatically risks: a risk claim always
 *     carries an explicit evidence-based rationale (a threshold, a trend, an
 *     exposure or an accounting mismatch).
 *   - Missing evidence stays explicit; nothing is fabricated.
 *   - No internal identifier (canonical English field names, engine names or
 *     raw numbers in scientific notation) ever reaches the normal user surface.
 */

import type { ComparativeEntry, FinancialStatementInsight } from "./FinancialStatementInsight";

export type AssistantIntent =
  | "SCENARIOS"
  | "RISK"
  | "PROFIT_CHANGE"
  | "PRODUCT"
  | "DATA_GAPS"
  | "ANALYZE"
  | "GENERAL";

export type NarrativeEvidenceLevel =
  | "EXTRACTED_FACT"
  | "DERIVED_METRIC"
  | "INTERPRETATION"
  | "MANAGEMENT_RECOMMENDATION";

export interface NarrativeFinding {
  readonly message: string;
  readonly evidenceLevel: NarrativeEvidenceLevel;
  readonly evidence: readonly string[];
}

export interface FindingGroups {
  readonly strengths: readonly NarrativeFinding[];
  readonly weaknesses: readonly NarrativeFinding[];
  readonly risks: readonly NarrativeFinding[];
  readonly opportunities: readonly NarrativeFinding[];
  readonly actions: readonly NarrativeFinding[];
}

export interface NarrativeSection {
  readonly heading: string;
  readonly lines: readonly string[];
}

export interface ScenarioView {
  readonly key: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
  readonly label: string;
  readonly objective: string;
  readonly assumptions: readonly string[];
  readonly actions: readonly string[];
  readonly expectedDirection: readonly string[];
  readonly principalRisks: readonly string[];
  readonly earlyWarnings: readonly string[];
  readonly decisionCriteria: readonly string[];
  readonly requiredEvidence: readonly string[];
}

export interface ComposedAnswer {
  readonly intent: AssistantIntent;
  readonly answer: string;
  readonly sections: readonly NarrativeSection[];
  readonly scenarios: readonly ScenarioView[];
  readonly limitations: readonly string[];
}

/* ------------------------------------------------------------------------- *
 * Deterministic Persian number formatting.
 *
 * Grouping/digit conversion is done manually (no ICU dependency) so the exact
 * canonical integer is always shown: a value is never re-parsed from a
 * scientific-notation string and silently rounded to a different figure.
 * ------------------------------------------------------------------------- */

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;

export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

const groupInteger = (digits: string): string =>
  toPersianDigits(digits.replace(/\B(?=(\d{3})+(?!\d))/g, "٬"));

/** Exact grouped integer in Persian digits. Never rounds a magnitude away. */
export function formatFaInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "نامشخص";
  const rounded = Math.round(Number(value));
  const sign = rounded < 0 ? "−" : "";
  return `${sign}${groupInteger(Math.abs(rounded).toString())}`;
}

/** Grouped decimal in Persian digits with the Persian decimal separator. */
export function formatFaDecimal(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "نامشخص";
  const fixed = Number(value).toFixed(Math.max(0, digits));
  const trimmed = fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
  const negative = trimmed.startsWith("-");
  const [intPart, decPart] = (negative ? trimmed.slice(1) : trimmed).split(".");
  const grouped = groupInteger(intPart || "0");
  return `${negative ? "−" : ""}${decPart ? `${grouped}٫${toPersianDigits(decPart)}` : grouped}`;
}

export function formatFaAmount(value: number | null | undefined, currency = "IRR"): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "نامشخص";
  const unit = currency === "IRR" ? "ریال" : (currency || "واحد پول");
  return `${formatFaInteger(value)} ${unit}`;
}

export function formatFaPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "نامشخص";
  return `${formatFaDecimal(Number(value) * 100, 2)}٪`;
}

export function formatFaRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "نامشخص";
  return `${formatFaDecimal(value, 2)} برابر`;
}

/* ------------------------------------------------------------------------- *
 * Persian labels for canonical identifiers and localized limitations.
 *
 * Canonical measure/ratio/integrity identifiers are internal contract names.
 * They must never reach the normal user surface, so every reference is mapped
 * to a Persian label before it is composed into an answer.
 * ------------------------------------------------------------------------- */

const MEASURE_LABELS_FA: Readonly<Record<string, string>> = {
  revenue: "درآمد",
  cogs: "بهای تمام‌شده",
  grossProfit: "سود ناخالص",
  operatingExpenses: "هزینه‌های عملیاتی",
  operatingProfit: "سود عملیاتی",
  preTaxIncome: "سود قبل از مالیات",
  taxes: "مالیات",
  netProfit: "سود خالص",
  currentAssets: "دارایی‌های جاری",
  totalAssets: "کل دارایی‌ها",
  currentLiabilities: "بدهی‌های جاری",
  totalLiabilities: "کل بدهی‌ها",
  equity: "حقوق مالکانه",
  cash: "موجودی نقد",
  receivables: "دریافتنی‌های تجاری",
  inventory: "موجودی مواد و کالا",
  ppe: "دارایی‌های ثابت مشهود",
  payables: "پرداختنی‌های تجاری",
  shortTermDebt: "تسهیلات مالی کوتاه‌مدت",
  longTermDebt: "تسهیلات مالی بلندمدت",
  interest: "هزینه مالی",
  operatingCashFlow: "جریان نقد عملیاتی",
  investingCashFlow: "جریان نقد سرمایه‌گذاری",
  financingCashFlow: "جریان نقد تأمین مالی",
  netCashFlow: "تغییر خالص وجه نقد",
  nonOperatingItems: "اقلام غیرعملیاتی",
  grossMargin: "حاشیه سود ناخالص",
  operatingMargin: "حاشیه سود عملیاتی",
  netMargin: "حاشیه سود خالص",
  roa: "بازده دارایی",
  roe: "بازده حقوق مالکانه",
  currentRatio: "نسبت جاری",
  quickRatio: "نسبت آنی",
  cashRatio: "نسبت نقد",
  debtToEquity: "بدهی به حقوق مالکانه",
  debtToAssets: "بدهی به دارایی",
  equityRatio: "نسبت حقوق مالکانه",
};

/** Canonical statement-measure identifiers (uppercase) used in limitations. */
const STATEMENT_MEASURE_LABELS_FA: Readonly<Record<string, string>> = {
  ASSETS: "کل دارایی‌ها",
  CURRENT_ASSETS: "دارایی‌های جاری",
  NON_CURRENT_ASSETS: "دارایی‌های غیرجاری",
  LIABILITIES: "کل بدهی‌ها",
  CURRENT_LIABILITIES: "بدهی‌های جاری",
  NON_CURRENT_LIABILITIES: "بدهی‌های غیرجاری",
  EQUITY: "حقوق مالکانه",
  REVENUE: "درآمد",
  COGS: "بهای تمام‌شده",
  GROSS_PROFIT: "سود ناخالص",
  OPERATING_EXPENSES: "هزینه‌های عملیاتی",
  OPERATING_PROFIT: "سود عملیاتی",
  EXPENSES: "هزینه‌ها",
  NET_PROFIT: "سود خالص",
  OPERATING_CASH_FLOW: "جریان نقد عملیاتی",
  INVESTING_CASH_FLOW: "جریان نقد سرمایه‌گذاری",
  FINANCING_CASH_FLOW: "جریان نقد تأمین مالی",
  NET_CASH_FLOW: "تغییر خالص وجه نقد",
  CASH: "موجودی نقد",
  RECEIVABLES: "دریافتنی‌های تجاری",
  INVENTORY: "موجودی مواد و کالا",
  PPE: "دارایی‌های ثابت مشهود",
  PAYABLES: "پرداختنی‌های تجاری",
  SHORT_TERM_DEBT: "تسهیلات مالی کوتاه‌مدت",
  LONG_TERM_DEBT: "تسهیلات مالی بلندمدت",
  INTEREST: "هزینه مالی",
  PRE_TAX_INCOME: "سود قبل از مالیات",
};

const INTEGRITY_LABELS_FA: Readonly<Record<string, string>> = {
  "balance-sheet-identity": "ترازنامه",
  "gross-profit-identity": "سود ناخالص",
  "operating-profit-identity": "سود عملیاتی",
  "pre-tax-identity": "سود قبل از مالیات",
  "net-profit-identity": "سود خالص",
  "cash-flow-identity": "جریان نقد",
};

const faMeasure = (name: string): string => {
  if (!name) return "قلم مالی";
  return MEASURE_LABELS_FA[name]
    ?? STATEMENT_MEASURE_LABELS_FA[name]
    ?? MEASURE_LABELS_FA[name.charAt(0).toLowerCase() + name.slice(1)]
    ?? "قلم مالی";
};
const faIntegrity = (id: string): string => INTEGRITY_LABELS_FA[id] ?? "کنترل حسابداری";
const faDocumentStatus = (status: string): string =>
  status === "COMPLETED" ? "کامل" : status === "PARTIAL" ? "ناقص" : "نامشخص";

/**
 * Localize the canonical English limitation strings produced by
 * `composeFinancialStatementInsight` into useful Persian. Anything that remains
 * untranslated is replaced with a truthful generic Persian limitation so no raw
 * English accounting/technical text ever reaches the user.
 */
export function localizeStatementLimitation(value: string): string {
  const text = String(value ?? "");
  if (text.startsWith("Revenue minus net profit.")) {
    return "این عدد «درآمد منهای سود خالص» است؛ یک مقدار باقی‌مانده مشتق‌شده است، نه جمع هزینه‌های استخراج‌شده از صورت مالی، و می‌تواند شامل بهای تمام‌شده، هزینه‌های عملیاتی، هزینه مالی، مالیات و اقلام غیرعملیاتی باشد.";
  }
  if (text === "Net profit or revenue evidence is absent; profitability interpretation is unavailable.") {
    return "شواهد سود خالص یا درآمد در دسترس نیست؛ تفسیر سودآوری ممکن نیست.";
  }
  if (text === "Current assets/current liabilities evidence is incomplete; liquidity ratios are unavailable.") {
    return "شواهد دارایی‌ها و بدهی‌های جاری ناقص است؛ نسبت‌های نقدینگی قابل محاسبه نیستند.";
  }
  if (text === "Operating cash-flow evidence is absent.") {
    return "شواهد جریان نقد عملیاتی در دسترس نیست.";
  }
  let match = text.match(/^The document is (.+); some sections may be incomplete\.$/);
  if (match) return match[1] === "PARTIAL" ? "سند ناقص است و ممکن است بخشی از اطلاعات در دسترس نباشد." : `وضعیت سند: ${match[1]}؛ ممکن است بخشی از اطلاعات ناقص باشد.`;
  match = text.match(/^Ratios unavailable for lack of evidence: (.+)\.$/);
  if (match) return `این نسبت‌ها به دلیل کمبود شواهد قابل محاسبه نیستند: ${match[1].split(",").map((item) => faMeasure(item.trim())).join("، ")}.`;
  match = text.match(/^Measure (.+) was not extracted\.$/);
  if (match) return `قلم «${faMeasure(match[1].trim())}» از سند استخراج نشده است.`;
  if (text.startsWith("This statement cannot establish market demand")) {
    return "این صورت مالی به‌تنهایی تقاضای بازار، جایگاه رقابتی یا فروش آینده را اثبات نمی‌کند؛ نتیجه‌گیری درباره رشد فقط به شواهد مالی موجود محدود است.";
  }
  match = text.match(/^Accounting check "([^"]+)"/);
  if (match) return `کنترل حسابداری «${faIntegrity(match[1])}» با اقلام استخراج‌شده کاملاً منطبق نیست؛ علت اختلاف باید بررسی شود.`;
  match = text.match(/^(\w+) is not applicable: equity is zero or negative/);
  if (match) return `نسبت «${faMeasure(match[1])}» به دلیل صفر یا منفی بودن حقوق مالکانه قابل اتکا نیست.`;
  match = text.match(/^(\w+) is not applicable: current liabilities are zero or negative/);
  if (match) return `نسبت «${faMeasure(match[1])}» به دلیل صفر یا منفی بودن بدهی‌های جاری قابل محاسبه نیست.`;
  match = text.match(/^(\w+) is not applicable/);
  if (match) return `نسبت «${faMeasure(match[1])}» با شواهد فعلی قابل محاسبه نیست.`;
  if (/[A-Za-z]{3,}/.test(text) && !/[آ-ی]/.test(text)) {
    // A residual untranslated canonical string: never leak it verbatim.
    return "یک محدودیت فنی در شواهد این تحلیل وجود دارد که باید با داده تکمیلی بررسی شود.";
  }
  return text;
}

export function localizeStatementLimitations(insight: FinancialStatementInsight): readonly string[] {
  return (insight.limitations ?? []).map(localizeStatementLimitation);
}

/* ------------------------------------------------------------------------- *
 * Intent classification.
 * ------------------------------------------------------------------------- */

export function classifyQuestion(question: string): AssistantIntent {
  const q = String(question ?? "").replace(/\s+/g, " ").trim();
  if (!q) return "GENERAL";
  if (/سناریو|scenario/i.test(q)) return "SCENARIOS";
  if (/ریسک|خطر|risk/i.test(q)) return "RISK";
  if (/(چرا|why).*(سود|profit)|سود.*(تغییر|عوض|چرا)|profit.*(chang|why)/i.test(q)) return "PROFIT_CHANGE";
  // Product / segment / sales-mix questions are answered from the document's own
  // per-product revenue table when it exists (never from company totals).
  if (/محصول|بخش|ترکیب فروش|segment|product|sales mix|mix/i.test(q)) return "PRODUCT";
  if (/(چه چیزی|چه اطلاعاتی|چه داده|what).*(کم|ناقص|نیاز|missing|gap)|کم است|کم است؟|ناقص|missing|data gap/i.test(q)) return "DATA_GAPS";
  if (/تحلیل کن|تحلیل.*(صورت|مالی)|این صورت مالی|analy[sz]e/i.test(q)) return "ANALYZE";
  return "GENERAL";
}

/* ------------------------------------------------------------------------- *
 * Grounded Persian findings.
 * ------------------------------------------------------------------------- */

const metric = (insight: FinancialStatementInsight, key: string): number | null => {
  const value = insight.metrics?.[key];
  return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
};

const change = (insight: FinancialStatementInsight, line: string): ComparativeEntry | undefined =>
  (insight.comparative ?? []).find((entry) => entry.line === line);

const directionWord = (entry: ComparativeEntry): string =>
  entry.absoluteChange > 0 ? "افزایش" : entry.absoluteChange < 0 ? "کاهش" : "بدون تغییر";

const changeText = (entry: ComparativeEntry): string => {
  if (entry.pctChange === null) {
    return entry.signReversal
      ? `${directionWord(entry)} ${formatFaAmount(Math.abs(entry.absoluteChange))} (درصد تغییر به دلیل تغییر علامت قابل اتکا نیست)`
      : `${directionWord(entry)} ${formatFaAmount(Math.abs(entry.absoluteChange))} (درصد تغییر قابل محاسبه نیست)`;
  }
  return `${directionWord(entry)} ${formatFaPercent(Math.abs(entry.pctChange))}`;
};

const missingEvidence = (insight: FinancialStatementInsight): readonly string[] => {
  const gaps: string[] = [];
  for (const check of insight.integrity ?? []) {
    if (check.status === "NOT_TESTABLE" && check.missing.length > 0) {
      gaps.push(...check.missing);
    }
  }
  for (const ratio of insight.unavailableRatios ?? []) gaps.push(ratio);
  return Array.from(new Set(gaps));
};

/**
 * Compose Persian strengths/weaknesses/risks/opportunities/actions from the
 * governed insight. Only evidence present in the insight is used; a ratio alone
 * never becomes a risk without an explicit rationale.
 */
export function composeFindingGroups(insight: FinancialStatementInsight): FindingGroups {
  const currency = insight.currency || "IRR";
  const netProfit = metric(insight, "netProfit");
  const grossProfit = metric(insight, "grossProfit");
  const operatingProfit = metric(insight, "operatingProfit");
  const totalAssets = metric(insight, "totalAssets");
  const totalLiabilities = metric(insight, "totalLiabilities");
  const currentAssets = metric(insight, "currentAssets");
  const currentLiabilities = metric(insight, "currentLiabilities");
  const equity = metric(insight, "equity");
  const revenue = metric(insight, "revenue");
  const operating = insight.cashFlow?.operating ?? null;
  const netCash = insight.cashFlow?.net ?? null;
  const quality = insight.cashFlow?.qualityOfEarnings ?? "UNAVAILABLE";

  const revenueChange = change(insight, "revenue");
  const netProfitChange = change(insight, "netIncome");
  const grossProfitChange = change(insight, "grossProfit");
  const operatingExpenseChange = change(insight, "operatingExpenses");

  const strengths: NarrativeFinding[] = [];
  const weaknesses: NarrativeFinding[] = [];
  const risks: NarrativeFinding[] = [];
  const opportunities: NarrativeFinding[] = [];
  const actions: NarrativeFinding[] = [];

  if (netProfit !== null && netProfit > 0) {
    strengths.push({
      message: `سود خالص مثبت است (${formatFaAmount(netProfit, currency)})؛ دوره با سود بسته شده است.`,
      evidenceLevel: "EXTRACTED_FACT",
      evidence: [`netProfit=${netProfit}`],
    });
  }
  if (operatingProfit !== null && operatingProfit > 0) {
    strengths.push({
      message: `سود عملیاتی مثبت (${formatFaAmount(operatingProfit, currency)}) است؛ عملیات اصلی در دوره سودآور بوده است.`,
      evidenceLevel: "EXTRACTED_FACT",
      evidence: [`operatingProfit=${operatingProfit}`],
    });
  }
  if (insight.ratios.currentRatio !== null && currentAssets !== null && currentLiabilities !== null && insight.ratios.currentRatio >= 1) {
    strengths.push({
      message: `داراییهای جاری با نسبت جاری ${formatFaRatio(insight.ratios.currentRatio)} بدهیهای جاری را پوشش میدهند.`,
      evidenceLevel: "DERIVED_METRIC",
      evidence: [`currentRatio=${insight.ratios.currentRatio}`, `currentAssets=${currentAssets}`, `currentLiabilities=${currentLiabilities}`],
    });
  }
  if (operating !== null && operating > 0) {
    strengths.push({
      message: `عملیات ${formatFaAmount(operating, currency)} جریان نقد مثبت ایجاد کرده است.`,
      evidenceLevel: "EXTRACTED_FACT",
      evidence: [`operatingCashFlow=${operating}`],
    });
  }
  if (quality === "CASH_BACKED") {
    strengths.push({
      message: "جریان نقد عملیاتی سود گزارششده را پوشش میدهد؛ سود از کیفیت نقدی پشتیبانی میشود.",
      evidenceLevel: "DERIVED_METRIC",
      evidence: ["qualityOfEarnings=CASH_BACKED"],
    });
  }
  if (revenueChange && revenueChange.absoluteChange > 0) {
    strengths.push({
      message: `درآمد نسبت به دوره قبل ${changeText(revenueChange)} است.`,
      evidenceLevel: "INTERPRETATION",
      evidence: [`revenue.current=${revenueChange.current}`, `revenue.prior=${revenueChange.prior}`],
    });
  }
  if (grossProfitChange && grossProfitChange.absoluteChange > 0) {
    strengths.push({
      message: `سود ناخالص ${changeText(grossProfitChange)} است؛ حاشیه سود ناخالص در حال تقویت است.`,
      evidenceLevel: "INTERPRETATION",
      evidence: [`grossProfit.current=${grossProfitChange.current}`, `grossProfit.prior=${grossProfitChange.prior}`],
    });
  }
  if (equity !== null && totalLiabilities !== null && equity > 0 && totalLiabilities <= equity) {
    strengths.push({
      message: "حقوق مالکانه مثبت است و بدهیها از حقوق مالکانه فراتر نرفتهاند؛ ساختار سرمایه متعادل است.",
      evidenceLevel: "DERIVED_METRIC",
      evidence: [`equity=${equity}`, `totalLiabilities=${totalLiabilities}`],
    });
  }

  if (netProfit !== null && netProfit < 0) {
    weaknesses.push({
      message: `دوره با زیان خالص ${formatFaAmount(Math.abs(netProfit), currency)} بسته شده است.`,
      evidenceLevel: "EXTRACTED_FACT",
      evidence: [`netProfit=${netProfit}`],
    });
  }
  if (revenueChange && revenueChange.absoluteChange < 0) {
    weaknesses.push({
      message: `درآمد نسبت به دوره قبل ${changeText(revenueChange)} است.`,
      evidenceLevel: "INTERPRETATION",
      evidence: [`revenueChange=${revenueChange.absoluteChange}`],
    });
  }
  if (netProfitChange && netProfitChange.absoluteChange < 0) {
    weaknesses.push({
      message: `سود خالص نسبت به دوره قبل ${changeText(netProfitChange)} است.`,
      evidenceLevel: "INTERPRETATION",
      evidence: [`netIncomeChange=${netProfitChange.absoluteChange}`],
    });
  }
  if (quality === "PROFIT_NOT_CASH_BACKED") {
    weaknesses.push({
      message: "همه سود گزارششده هنوز به جریان نقد تبدیل نشده است؛ کیفیت سود نقدی نیست.",
      evidenceLevel: "DERIVED_METRIC",
      evidence: ["qualityOfEarnings=PROFIT_NOT_CASH_BACKED"],
    });
  }
  if (operatingExpenseChange && operatingExpenseChange.absoluteChange > 0 && (!revenueChange || revenueChange.absoluteChange <= 0)) {
    weaknesses.push({
      message: "هزینههای عملیاتی افزایش یافته در حالی که درآمد رشد نکرده است؛ فشار هزینهای به سودآوری وارد میشود.",
      evidenceLevel: "INTERPRETATION",
      evidence: [`operatingExpenseChange=${operatingExpenseChange.absoluteChange}`],
    });
  }

  if (equity !== null && equity < 0) {
    risks.push({
      message: `حقوق مالکانه منفی (${formatFaAmount(equity, currency)}) است؛ بدهیها از کل داراییها فراتر رفته و تداوم فعالیت به پشتیبانی طلبکاران وابسته است.`,
      evidenceLevel: "INTERPRETATION",
      evidence: [`equity=${equity}`],
    });
    actions.push({
      message: "برنامه بازسازی سرمایه و کاهش زیان انباشته پیش از هر افزایش بدهی جدید تدوین شود.",
      evidenceLevel: "MANAGEMENT_RECOMMENDATION",
      evidence: [`equity=${equity}`],
    });
  } else if (equity !== null && totalLiabilities !== null && equity > 0 && totalLiabilities > equity) {
    risks.push({
      message: `بدهیها (${formatFaAmount(totalLiabilities, currency)}) از حقوق مالکانه (${formatFaAmount(equity, currency)}) فراتر رفته و ${formatFaAmount(totalLiabilities - equity, currency)} بیشتر است؛ ریسک اهرم مالی با شاهد ساختار سرمایه تأیید میشود.`,
      evidenceLevel: "DERIVED_METRIC",
      evidence: [`totalLiabilities=${totalLiabilities}`, `equity=${equity}`],
    });
    actions.push({
      message: "کاهش اهرم مالی یا تقویت حقوق مالکانه در برنامه تأمین مالی در اولویت قرار گیرد.",
      evidenceLevel: "MANAGEMENT_RECOMMENDATION",
      evidence: [`totalLiabilities=${totalLiabilities}`, `equity=${equity}`],
    });
  }
  if (insight.ratios.debtToAssets !== null && insight.ratios.debtToAssets >= 0.5) {
    risks.push({
      message: `نسبت بدهی به دارایی ${formatFaPercent(insight.ratios.debtToAssets)} است؛ بیش از نیمی از داراییها از طریق بدهی تأمین شده است (این نسبت بهتنهایی یک واقعیت است و ریسک بودن آن بر پایه همین آستانه اهرمی و ساختار تأمین مالی تفسیر میشود).`,
      evidenceLevel: "INTERPRETATION",
      evidence: [`debtToAssets=${insight.ratios.debtToAssets}`],
    });
  }
  if (currentAssets !== null && currentLiabilities !== null && currentLiabilities > currentAssets) {
    risks.push({
      message: `بدهیهای جاری (${formatFaAmount(currentLiabilities, currency)}) از داراییهای جاری (${formatFaAmount(currentAssets, currency)}) بیشتر است؛ کسری پوشش تعهدات کوتاهمدت وجود دارد.`,
      evidenceLevel: "INTERPRETATION",
      evidence: [`currentLiabilities=${currentLiabilities}`, `currentAssets=${currentAssets}`],
    });
    actions.push({
      message: `کسری پوشش تعهدات کوتاهمدت به میزان ${formatFaAmount(currentLiabilities - currentAssets, currency)} با بازآرایی سررسیدها یا تقویت دارایی جاری جبران شود.`,
      evidenceLevel: "MANAGEMENT_RECOMMENDATION",
      evidence: [`currentLiabilities=${currentLiabilities}`, `currentAssets=${currentAssets}`],
    });
  }
  if (operating !== null && operating < 0) {
    risks.push({
      message: `جریان نقد عملیاتی منفی (${formatFaAmount(operating, currency)}) است؛ عملیات جاری وجه نقد مصرف کرده است.`,
      evidenceLevel: "INTERPRETATION",
      evidence: [`operatingCashFlow=${operating}`],
    });
    actions.push({
      message: "محرکهای سرمایه در گردش و جریان نقد عملیاتی برای بازگشت به جریان مثبت بررسی شود.",
      evidenceLevel: "MANAGEMENT_RECOMMENDATION",
      evidence: [`operatingCashFlow=${operating}`],
    });
  }
  if (netCash !== null && netCash < 0) {
    risks.push({
      message: `موجودی نقد در دوره ${formatFaAmount(Math.abs(netCash), currency)} کاهش یافته است.`,
      evidenceLevel: "EXTRACTED_FACT",
      evidence: [`netCashFlow=${netCash}`],
    });
  }
  const mismatch = (insight.integrity ?? []).find((check) => check.status === "MISMATCH");
  if (mismatch) {
    risks.push({
      message: `کنترل حسابداری «${faIntegrity(mismatch.id)}» با اقلام استخراج‌شده منطبق نیست؛ ریسک ناشی از اختلاف داده بین ${formatFaAmount(Math.abs(mismatch.difference ?? 0), currency)} است.`,
      evidenceLevel: "DERIVED_METRIC",
      evidence: [mismatch.id],
    });
    actions.push({
      message: "اقلام میانی مرتبط با اختلاف کنترل حسابداری از سند یا یادداشتهای مالی تطبیق داده شود.",
      evidenceLevel: "MANAGEMENT_RECOMMENDATION",
      evidence: [mismatch.id],
    });
  }
  if (insight.documentStatus !== "COMPLETED") {
    risks.push({
      message: "سند کامل نیست؛ بخشی از نتیجهگیریها بر پایه شواهد ناقص است و باید با اطلاعات تکمیلی بازبینی شود.",
      evidenceLevel: "INTERPRETATION",
      evidence: [`documentStatus=${insight.documentStatus}`],
    });
    actions.push({
      message: "بخشهای ناقص سند (ترازنامه، سود و زیان یا جریان نقد) تکمیل شود تا تصویر مدیریتی کامل گردد.",
      evidenceLevel: "MANAGEMENT_RECOMMENDATION",
      evidence: [`documentStatus=${insight.documentStatus}`],
    });
  }

  if (revenueChange && revenueChange.absoluteChange > 0) {
    opportunities.push({
      message: `درآمد ${changeText(revenueChange)} است؛ با تثبیت علت عملیاتی این رشد و حفظ سرمایه در گردش، ظرفیت توسعه وجود دارد.`,
      evidenceLevel: "INTERPRETATION",
      evidence: [`revenueChange=${revenueChange.absoluteChange}`],
    });
  }
  if (operatingExpenseChange && operatingExpenseChange.absoluteChange < 0) {
    opportunities.push({
      message: "کاهش هزینههای عملیاتی زمینه بهبود حاشیه سود را فراهم کرده است.",
      evidenceLevel: "INTERPRETATION",
      evidence: [`operatingExpenseChange=${operatingExpenseChange.absoluteChange}`],
    });
  }
  if (operating !== null && operating > 0) {
    opportunities.push({
      message: "جریان نقد عملیاتی مثبت ظرفیت خودتأمینی برای سرمایهگذاریهای رشد را ایجاد میکند.",
      evidenceLevel: "DERIVED_METRIC",
      evidence: [`operatingCashFlow=${operating}`],
    });
  }
  if (grossProfitChange && grossProfitChange.absoluteChange > 0) {
    opportunities.push({
      message: "بهبود سود ناخالص ظرفیت افزایش سودآوری را در صورت کنترل هزینههای عملیاتی نشان میدهد.",
      evidenceLevel: "INTERPRETATION",
      evidence: [`grossProfitChange=${grossProfitChange.absoluteChange}`],
    });
  }

  const workingCapital = insight.workingCapital;
  if (workingCapital) {
    const ccc = workingCapital.cashConversionCycle;
    if (ccc > 0) {
      weaknesses.push({
        message: `چرخه تبدیل نقد ${formatFaDecimal(ccc, 0)} روز است (دوره وصول مطالبات ${formatFaDecimal(workingCapital.dso, 0)} روز، دوره نگهداری موجودی ${formatFaDecimal(workingCapital.dio, 0)} روز، دوره پرداخت به تأمین‌کنندگان ${formatFaDecimal(workingCapital.dpo, 0)} روز)؛ وجه نقد بیش از پوشش تأمین مالی تأمین‌کننده در عملیات درگیر می‌ماند.`,
        evidenceLevel: "DERIVED_METRIC",
        evidence: [`cashConversionCycle=${ccc}`],
      });
      actions.push({
        message: `کوتاه‌کردن چرخه تبدیل نقد (اکنون ${formatFaDecimal(ccc, 0)} روز) از طریق تسریع وصول مطالبات یا هم‌ترازی شرایط پرداخت با گردش موجودی.`,
        evidenceLevel: "MANAGEMENT_RECOMMENDATION",
        evidence: [`cashConversionCycle=${ccc}`],
      });
    } else if (ccc < 0) {
      strengths.push({
        message: `چرخه تبدیل نقد منفی (${formatFaDecimal(ccc, 0)} روز) است؛ تأمین مالی تأمین‌کننده دوره عملیاتی را پوشش می‌دهد و عملیات نقد آزاد می‌کند.`,
        evidenceLevel: "DERIVED_METRIC",
        evidence: [`cashConversionCycle=${ccc}`],
      });
    }
  }
  if (insight.coverage?.interestCoverage !== null && insight.coverage?.interestCoverage !== undefined) {
    const coverage = insight.coverage.interestCoverage;
    if (coverage < 1) {
      risks.push({
        message: `پوشش هزینه مالی ${formatFaRatio(coverage)} است؛ سود عملیاتی به‌تنهایی هزینه مالی دوره را پوشش نمی‌دهد.`,
        evidenceLevel: "INTERPRETATION",
        evidence: [`interestCoverage=${coverage}`],
      });
    } else {
      strengths.push({
        message: `سود عملیاتی ${formatFaRatio(coverage)} هزینه مالی را پوشش می‌دهد.`,
        evidenceLevel: "DERIVED_METRIC",
        evidence: [`interestCoverage=${coverage}`],
      });
    }
  }

  if (missingEvidence(insight).length > 0) {
    actions.push({
      message: `شواهد ناقص برای نتیجه‌گیری دقیق‌تر: ${missingEvidence(insight).map(faMeasure).join("، ")}. تکمیل این اقلام کیفیت تصمیم را بالا می‌برد.`,
      evidenceLevel: "MANAGEMENT_RECOMMENDATION",
      evidence: missingEvidence(insight),
    });
  }

  const fallback = (target: NarrativeFinding[], message: string): readonly NarrativeFinding[] =>
    target.length > 0 ? target : [{ message, evidenceLevel: "INTERPRETATION", evidence: [] }];

  return {
    strengths: fallback(strengths, "با شواهد فعلی، نقطه قوت ساختاری مشخصی شناسایی نشد؛ برای تشخیص نقطه قوت، تکمیل اقلام سود و زیان و ترازنامه لازم است."),
    weaknesses: fallback(weaknesses, "با شواهد فعلی، ضعف ساختاری مشخصی شناسایی نشد؛ نبود ضعف به معنای تأیید کیفیت نیست و باید با داده تکمیلی بازبینی شود."),
    risks: fallback(risks, "با شواهد فعلی، ریسک مشخصی شناسایی نشد؛ این نتیجهگیری به محدوده اطلاعات موجود محدود است."),
    opportunities: fallback(opportunities, "فرصت رشد مشخصی بدون شواهد تکمیلی قابل نتیجهگیری نیست."),
    actions: fallback(actions, "اقدام اصلاحی مشخصی از شواهد فعلی استخراج نشده است."),
  };
}

/* ------------------------------------------------------------------------- *
 * Three-scenario decision support.
 * ------------------------------------------------------------------------- */

export function composeScenarios(insight: FinancialStatementInsight): readonly ScenarioView[] {
  const currency = insight.currency || "IRR";
  const revenueChange = change(insight, "revenue");
  const netProfit = metric(insight, "netProfit");
  const totalLiabilities = metric(insight, "totalLiabilities");
  const equity = metric(insight, "equity");
  const currentAssets = metric(insight, "currentAssets");
  const currentLiabilities = metric(insight, "currentLiabilities");
  const operating = insight.cashFlow?.operating ?? null;

  const growthObserved = revenueChange ? revenueChange.absoluteChange > 0 : false;
  const leverageHigh = (totalLiabilities !== null && equity !== null && totalLiabilities > equity)
    || (insight.ratios.debtToAssets !== null && insight.ratios.debtToAssets >= 0.5);
  const liquidityTight = currentAssets !== null && currentLiabilities !== null && currentLiabilities > currentAssets;
  const cashNegative = operating !== null && operating < 0;
  const cashPositive = operating !== null && operating > 0;
  const gaps = missingEvidence(insight);

  const growthBasis = revenueChange
    ? `رشد درآمد مشاهدهشده در ${changeText(revenueChange)}`
    : "روند درآمد در دو دوره قابل استخراج نیست";
  const cashBasis = operating === null
    ? "جریان نقد عملیاتی در دسترس نیست (فرض: جریان نقد بدون تغییر باقی میماند)"
    : `جریان نقد عملیاتی ${formatFaAmount(operating, currency)}`;

  const conservative: ScenarioView = {
    key: "CONSERVATIVE",
    label: "محافظهکارانه",
    objective: "حفاظت از نقدینگی و کاهش اهرم مالی، پیش از هر اقدام توسعهای.",
    assumptions: [
      "تقاضا و درآمد فعلی بدون رشد قابل توجه ادامه مییابد.",
      `وضعیت نقدینگی و اهرم فعلی: ${liquidityTight ? "کسری پوشش تعهدات کوتاهمدت" : "پوشش تعهدات کوتاهمدت برقرار است"}؛ ${cashBasis}.`,
      "منبع تأمین مالی جدید وابسته به بدهی جدید در این سناریو استفاده نمیشود.",
    ],
    actions: [
      "توقف یا تعویق سرمایهگذاریهای غیرضروری تا تثبیت نقدینگی.",
      "برنامهریزی برای کاهش بدهی یا تقویت حقوق مالکانه در صورت بالا بودن اهرم.",
      "کنترل هزینههای عملیاتی و بازآرایی سررسید بدهیهای جاری.",
      gaps.length ? `تکمیل شواهد ناقص (${gaps.map(faMeasure).join("، ")}) پیش از هر تصمیم سرمایهگذاری.` : "تثبیت سامانه گزارشگری برای پایش ماهانه نقدینگی.",
    ],
    expectedDirection: [
      "فشار بر رشد کوتاهمدت به نفع پایداری نقدینگی.",
      leverageHigh ? "کاهش تدریجی اهرم مالی." : "حفظ ساختار سرمایه فعلی.",
      "کاهش ریسک نکول تعهدات کوتاهمدت.",
    ],
    principalRisks: [
      "از دست دادن فرصت رشد و سهم بازار در پی احتیاط.",
      liquidityTight ? "باقیماندن کسری پوشش تعهدات جاری در صورت نبود اقدام." : "احتمال افت درآمد در صورت رکود تقاضا.",
    ],
    earlyWarnings: [
      "کاهش نسبت جاری به زیر ۱.",
      "منفی شدن جریان نقد عملیاتی.",
      "افزایش نامتناسب بدهیهای جاری نسبت به داراییهای جاری.",
    ],
    decisionCriteria: [
      "پوشش تعهدات کوتاهمدت با دارایی جاری برقرار بماند.",
      "اهرم مالی کاهشی یا ثابت باشد.",
      "کنترلهای سازگاری حسابداری بدون اختلاف باقی بماند.",
    ],
    requiredEvidence: gaps.length ? gaps.map(faMeasure) : ["صورت جریان نقد کامل", "زمانبندی سررسید بدهیها"],
  };

  const balanced: ScenarioView = {
    key: "BALANCED",
    label: "متوازن",
    objective: "رشد در محدوده ظرفیت خودتأمینی، با حفظ کیفیت نقدی و کنترل اهرم.",
    assumptions: [
      growthBasis + " در صورت تداوم، مبنای رشد این سناریو است.",
      cashPositive ? "جریان نقد عملیاتی مثبت، رشد را خودتأمین می کند." : "برای رشد، نیاز به بهبود جریان نقد یا تأمین مالی هدفمند وجود دارد.",
      "رشد فقط تا سقف جریان نقد آزاد و کنترل اهرم ادامه مییابد.",
    ],
    actions: [
      "هدایت منابع به فعالیتهایی که حاشیه سود و گردش نقد را همزمان بهبود میدهند.",
      "بهبود بهرهوری هزینههای عملیاتی برای آزادسازی ظرفیت سرمایهگذاری.",
      "تعریف شاخصهای پایش ماهانه رشد درآمد و جریان نقد.",
      leverageHigh ? "حفظ اهرم در سطح فعلی و پرهیز از بدهی جدید پرمخاطره." : "استفاده محتاطانه از ظرفیت سرمایه فعلی.",
    ],
    expectedDirection: [
      growthObserved ? "تداوم رشد متعادل درآمد." : "رشد پایدار و قابل کنترل در صورت بهبود تقاضا.",
      "حفظ یا بهبود حاشیه سود و کیفیت نقد.",
      "ثبات ساختار تأمین مالی.",
    ],
    principalRisks: [
      "همزمانی رشد درآمد و افزایش غیرقابل کنترل سرمایه در گردش.",
      "فشار هزینهای بر سود در صورت افزایش سریع عملیات.",
      liquidityTight ? "تشدید کسری نقدینگی در صورت رشد بیضابطه." : "وابستگی رشد به تحقق فروش پیشبینیشده.",
    ],
    earlyWarnings: [
      "افزایش مطالبات و سرمایه در گردش سریعتر از رشد فروش.",
      "کاهش حاشیه سود ناخالص یا عملیاتی.",
      "عبور جریان نقد عملیاتی به محدوده منفی.",
    ],
    decisionCriteria: [
      "رشد درآمد همراه با حفظ یا بهبود جریان نقد عملیاتی.",
      "ثبات یا بهبود نسبتهای سودآوری.",
      "کنترل اهرم و پوشش تعهدات.",
    ],
    requiredEvidence: gaps.length ? gaps.map(faMeasure) : ["پیشبینی تفصیلی فروش و سرمایه در گردش", "برنامه تأمین مالی متوازن"],
  };

  const aggressive: ScenarioView = {
    key: "AGGRESSIVE",
    label: "تهاجمی",
    objective: "تسریع رشد و توسعه با پذیرش ریسک بالاتر و تأمین مالی هدفمند.",
    assumptions: [
      "رشد درآمد سریعتر از روند جاری و تقاضا حمایتکننده است.",
      "تأمین مالی جدید (سرمایه یا بدهی هدفمند) قابل جذب است.",
      "توان عملیاتی و مدیریت هزینه برای افزایش سریع مقیاس وجود دارد.",
    ],
    actions: [
      "سرمایهگذاری هدفمند در ظرفیت تولید، بازار یا فناوری.",
      "جذب سرمایه جدید یا بدهی با برنامه بازپرداخت مشخص.",
      "تقویت تیم و فرایندهای اجرایی برای مدیریت رشد سریع.",
      "پایش سختگیرانه نقدینگی و اهرم در طول اجرا.",
    ],
    expectedDirection: [
      "رشد سریعتر درآمد و سهم بازار در صورت تحقق فرضها.",
      "افزایش موقت نیاز به سرمایه در گردش و اهرم.",
      leverageHigh ? "افزایش بیشتر ریسک مالی در صورت عدم مدیریت اهرم." : "استفاده از ظرفیت اهرمی موجود.",
    ],
    principalRisks: [
      leverageHigh ? "افزایش شکنندگی سرمایه در صورت رشد از طریق بدهی جدید." : "پذیرش ریسک اجرایی و بازار در ازای رشد سریع.",
      "احتمال عدم تحقق پیشبینی فروش و فشار بر نقدینگی.",
      cashNegative ? "تشدید جریان نقد عملیاتی منفی." : "افزایش سرمایه در گردش فراتر از ظرفیت نقدی.",
    ],
    earlyWarnings: [
      "افزایش سریع نسبت بدهی به دارایی.",
      "کاهش نسبت جاری به زیر ۱.",
      "افزایش هزینه مالی و فشار بر سود عملیاتی.",
    ],
    decisionCriteria: [
      "وجود برنامه تأمین مالی و بازپرداخت مشخص.",
      "حفظ پوشش حداقلی تعهدات کوتاهمدت.",
      "توجیه پذیری بازگشت سرمایه با شواهد.",
    ],
    requiredEvidence: ["برنامه تجاری و پیشبینی فروش مستند", "برنامه تأمین مالی و بازپرداخت", "تحلیل سناریوی نقدینگی", ...(gaps.length ? gaps.map(faMeasure) : [])],
  };

  return [conservative, balanced, aggressive];
}

/* ------------------------------------------------------------------------- *
 * Answer composition.
 * ------------------------------------------------------------------------- */

const linesOf = (findings: readonly NarrativeFinding[]): readonly string[] => findings.map((finding) => finding.message);

const riskDrivers = (insight: FinancialStatementInsight): readonly string[] => {
  const drivers: string[] = [];
  const totalLiabilities = metric(insight, "totalLiabilities");
  const equity = metric(insight, "equity");
  if (insight.ratios.debtToAssets !== null) {
    drivers.push(`ساختار تأمین مالی: بدهی به دارایی ${formatFaPercent(insight.ratios.debtToAssets)} (شاخص اهرم).`);
  }
  if (totalLiabilities !== null && equity !== null && totalLiabilities > equity) {
    drivers.push(`بدهی (${formatFaAmount(totalLiabilities)}) از حقوق مالکانه (${formatFaAmount(equity)}) فراتر است؛ این مازاد معیار اهرم بالاست.`);
  }
  const operating = insight.cashFlow?.operating ?? null;
  if (operating !== null) {
    drivers.push(`جریان نقد عملیاتی ${formatFaAmount(operating)}؛ ${operating < 0 ? "منفی بودن آن توان بازپرداخت را محدود میکند" : "مثبت بودن آن بازپرداخت را پشتیبانی میکند"}.`);
  }
  const cash = insight.cashFlow?.net ?? null;
  if (cash !== null && cash < 0) drivers.push(`کاهش خالص نقد ${formatFaAmount(Math.abs(cash))} در دوره.`);
  const mismatch = (insight.integrity ?? []).find((check) => check.status === "MISMATCH");
  if (mismatch) drivers.push(`اختلاف کنترل حسابداری «${faIntegrity(mismatch.id)}» به میزان ${formatFaAmount(Math.abs(mismatch.difference ?? 0))}.`);
  const currentAssets = metric(insight, "currentAssets");
  const currentLiabilities = metric(insight, "currentLiabilities");
  if (currentAssets !== null && currentLiabilities !== null && currentLiabilities > currentAssets) {
    drivers.push(`کسری پوشش تعهدات کوتاهمدت به میزان ${formatFaAmount(currentLiabilities - currentAssets)}.`);
  }
  return drivers;
};

const monitorLine = (insight: FinancialStatementInsight): readonly string[] => {
  const lines: string[] = [];
  lines.push("نسبت بدهی به دارایی و روند آن در دورههای بعد.");
  lines.push("نسبت جاری و پوشش بدهیهای جاری با دارایی جاری.");
  lines.push("جریان نقد عملیاتی و کیفیت سود.");
  if (insight.ratios.notApplicable.length > 0) lines.push(`نسبتهای قابل اتکا نیستند: ${insight.ratios.notApplicable.map((item) => faMeasure(item.split(":")[0])).join("، ")}.`);
  return lines;
};

/**
 * Persian product/segment profitability section, built only from the
 * document's own per-product evidence. Returns [] when the document has no
 * per-product table, so the caller keeps the honest "not modeled" disclosure.
 */
const productSegmentSections = (insight: FinancialStatementInsight): NarrativeSection[] => {
  const segments = insight.productSegments;
  if (!segments) return [];
  const currency = insight.currency || "IRR";
  const overall = segments.overallGrossMargin;
  const contributions = [...segments.contributions]
    .filter((entry) => entry.revenue !== 0)
    .sort((a, b) => b.revenueShare - a.revenueShare);
  const lines: string[] = [
    `درآمد محصولات: ${formatFaAmount(segments.totalRevenue, currency)}؛ سود ناخالص محصولات: ${formatFaAmount(segments.totalGrossProfit, currency)}${overall === null ? "" : `؛ حاشیه سود ناخالص محصولات ${formatFaPercent(overall)}`}.`,
  ];
  if (segments.topRevenueContribution) {
    lines.push(`بیشترین سهم درآمد مربوط به «${segments.topRevenueContribution.name}» با ${formatFaPercent(segments.topRevenueContribution.revenueShare)} از درآمد محصولات است.`);
  }
  lines.push("تفکیک محصول:");
  for (const entry of contributions) {
    const margin = entry.grossMargin === null ? "نامشخص" : formatFaPercent(entry.grossMargin);
    const grossProfit = entry.grossProfit === null ? "نامشخص" : formatFaAmount(entry.grossProfit, currency);
    lines.push(`• ${entry.name}: درآمد ${formatFaAmount(entry.revenue, currency)}، سود ناخالص ${grossProfit}، حاشیه ${margin}، سهم درآمد ${formatFaPercent(entry.revenueShare)}.`);
  }
  if (segments.highMargin.length > 0) {
    lines.push("محصولات با حاشیه بالاتر از میانگین شرکت:");
    for (const entry of segments.highMargin) lines.push(`• ${entry.name} با حاشیه ${formatFaPercent(entry.grossMargin)}.`);
  }
  if (segments.negativeMargin.length > 0) {
    lines.push("محصولات با حاشیه منفی:");
    for (const entry of segments.negativeMargin) lines.push(`• ${entry.name} با حاشیه ${formatFaPercent(entry.grossMargin)} و سود ناخالص ${formatFaAmount(entry.grossProfit, currency)}.`);
  }
  if (segments.mixEffect) {
    const mix = segments.mixEffect;
    lines.push(`اثر ترکیب فروش: حاشیه سود محصولات از ${formatFaPercent(mix.priorOverallGrossMargin)} به ${formatFaPercent(mix.currentOverallGrossMargin)} رسیده است؛ سهم تغییر ترکیب فروش ${formatFaPercent(mix.mixEffect)} و سهم تغییر نرخ/بهای تمام شده ${formatFaPercent(mix.rateCostEffect)} است.`);
  }
  const sections: NarrativeSection[] = [{ heading: "سودآوری محصول/بخش", lines }];
  if (segments.limitations.length > 0) {
    sections.push({ heading: "محدودیتهای تحلیل محصول/بخش", lines: [...segments.limitations] });
  }
  return sections;
};

export function composeAnswer(insight: FinancialStatementInsight, question: string): ComposedAnswer {
  const intent = classifyQuestion(question);
  const groups = composeFindingGroups(insight);
  const scenarios = composeScenarios(insight);
  // Honest capability disclosure: only when the document actually lacks a
  // per-product revenue table. When the capability is present it is answered
  // from the document's own product evidence instead of a blanket disclaimer.
  const productSegmentDisclosure = insight.productSegments
    ? null
    : "سودآوری در سطح محصول/بخش در مدل کاننیکال این نسخه استخراج و تحلیل نمی‌شود؛ در صورت وجود این داده در سند، به قرارداد تحلیل بخش نیاز است و از جمع‌های کل شرکت استنتاج نمی‌شود.";
  const limitations = [
    ...localizeStatementLimitations(insight),
    ...(productSegmentDisclosure ? [productSegmentDisclosure] : []),
  ];
  const currency = insight.currency || "IRR";
  const sections: NarrativeSection[] = [];

  if (intent === "SCENARIOS") {
    sections.push({
      heading: "پیشنهاد رشد، توسعه و افزایش تابآوری در سه سناریو",
      lines: [
        `مبنای سناریوها: شواهد مالی همین سند (${insight.periods.map((period) => period.label).join("، ") || "دوره نامشخص"}). فرضهای هر سناریو بهصورت صریح ذکر شده و هیچ عدد آیندهنگرانهای ساخته نشده است.`,
      ],
    });
    for (const scenario of scenarios) {
      sections.push({
        heading: `سناریوی ${scenario.label}`,
        lines: [
          `هدف: ${scenario.objective}`,
          "فرضها:",
          ...scenario.assumptions.map((line) => `• ${line}`),
          "اقدامهای کلیدی:",
          ...scenario.actions.map((line) => `• ${line}`),
          "جهتگیری مورد انتظار:",
          ...scenario.expectedDirection.map((line) => `• ${line}`),
          "ریسکهای اصلی:",
          ...scenario.principalRisks.map((line) => `• ${line}`),
          "شاخصهای هشدار زودهنگام:",
          ...scenario.earlyWarnings.map((line) => `• ${line}`),
          "معیارهای تصمیم:",
          ...scenario.decisionCriteria.map((line) => `• ${line}`),
          "شواهد مورد نیاز:",
          ...scenario.requiredEvidence.map((line) => `• ${line}`),
        ],
      });
    }
    sections.push({ heading: "محدودیتها", lines: limitations.length ? limitations : ["محدودیت ثبتشدهای برای این تحلیل وجود ندارد."] });
  } else if (intent === "RISK") {
    sections.push({ heading: "ریسکهای اصلی", lines: linesOf(groups.risks) });
    sections.push({ heading: "چرا این ریسکها مهماند (محرکها و شواهد)", lines: riskDrivers(insight) });
    sections.push({ heading: "آنچه باید پایش شود", lines: monitorLine(insight) });
    sections.push({ heading: "اقدام پیشنهادی", lines: linesOf(groups.actions) });
    sections.push({ heading: "اطمینان و محدودیت", lines: limitations.length ? limitations : [`این تفسیر فقط بر شواهد همین سند (${currency}) استوار است.`] });
  } else if (intent === "PROFIT_CHANGE") {
    const netProfit = metric(insight, "netProfit");
    const netProfitChange = change(insight, "netIncome");
    const revenueChange = change(insight, "revenue");
    const grossProfitChange = change(insight, "grossProfit");
    const operatingExpenseChange = change(insight, "operatingExpenses");
    const operatingProfit = metric(insight, "operatingProfit");
    sections.push({
      heading: "تغییر سود",
      lines: netProfitChange
        ? [
          `سود خالص از ${formatFaAmount(netProfitChange.prior, currency)} به ${formatFaAmount(netProfitChange.current, currency)} رسیده است (${changeText(netProfitChange)}).`,
          netProfit !== null ? `سود خالص دوره جاری ${formatFaAmount(netProfit, currency)} است.` : "سود خالص دوره جاری در سند قابل استخراج نبود.",
        ]
        : [netProfit !== null ? `سود خالص دوره جاری ${formatFaAmount(netProfit, currency)} است؛ شواهد دوره قبل برای توضیح تغییر در دسترس نیست.` : "شواهد سود خالص یا دوره مقایسهای در دسترس نیست."],
    });
    sections.push({
      heading: "زنجیره عوامل قابل مشاهده",
      lines: [
        revenueChange ? `درآمد: ${changeText(revenueChange)}.` : "درآمد: شواهد مقایسهای در دسترس نیست.",
        grossProfitChange ? `سود ناخالص: ${changeText(grossProfitChange)}.` : "سود ناخالص: شواهد مقایسهای در دسترس نیست.",
        operatingExpenseChange ? `هزینههای عملیاتی: ${changeText(operatingExpenseChange)}.` : "هزینههای عملیاتی: شواهد مقایسهای در دسترس نیست.",
        operatingProfit !== null ? `سود عملیاتی دوره جاری: ${formatFaAmount(operatingProfit, currency)}.` : "سود عملیاتی: از سند استخراج نشده است.",
      ],
    });
    sections.push({
      heading: "واقعیت تأییدشده در برابر استنباط",
      lines: [
        "واقعیت: اقلام استخراجشده و تغییرات محاسبهشده در بخش بالا از خود سند میآید.",
        "استنباط: ربطدادن تغییر سود به یک علت واحد، بدون شواهد تکمیلی درباره بازار، قیمت یا ترکیب فروش، قطعی نیست.",
      ],
    });
    sections.push({ heading: "محدودیتها", lines: limitations.length ? limitations : ["محدودیت ثبتشدهای برای این تحلیل وجود ندارد."] });
  } else if (intent === "PRODUCT") {
    const productSections = productSegmentSections(insight);
    if (productSections.length > 0) {
      for (const section of productSections) sections.push(section);
    } else {
      sections.push({ heading: "Product/segment profitability", lines: ["داده سودآوری محصول/بخش در منبع موجود نیست؛ از جمع‌های کل شرکت استنتاج نمی‌شود و برای تحلیل بخش به جدول درآمد و بهای تمام شده محصول نیاز است."] });
    }
    if (groups.actions.length > 0) sections.push({ heading: "اقدامات پیشنهادی مرتبط", lines: linesOf(groups.actions) });
    sections.push({ heading: "محدودیت‌ها", lines: limitations.length ? limitations : ["محدودیت ثبت‌شده‌ای برای این تحلیل وجود ندارد."] });
  } else if (intent === "DATA_GAPS") {
    const integrityGaps = (insight.integrity ?? [])
      .filter((check) => check.status === "NOT_TESTABLE")
      .map((check) => `${faIntegrity(check.id)} (اقلام ناموجود: ${check.missing.map(faMeasure).join("، ") || "نامشخص"})`);
    const ratioGaps = (insight.unavailableRatios ?? []).map(faMeasure);
    const sectionGaps = insight.documentStatus === "COMPLETED"
      ? []
      : [`سند با وضعیت ${faDocumentStatus(insight.documentStatus)} ثبت شده و بخشی از اطلاعات ممکن است ناقص باشد.`];
    const operationalGaps = limitations.filter((line) => !line.startsWith("این نسبت‌ها") && !line.startsWith("قلم «"));
    const dataGaps = [...sectionGaps, ...ratioGaps, ...integrityGaps];
    sections.push({ heading: "شکافهای داده (شواهد استخراجنشده)", lines: dataGaps.length ? dataGaps : ["شکاف دادهای مشخصی شناسایی نشد."] });
    sections.push({ heading: "شکافهای اعتبارسنجی", lines: (insight.integrity ?? []).some((check) => check.status === "NOT_TESTABLE") ? (insight.integrity ?? []).filter((check) => check.status === "NOT_TESTABLE").map((check) => `${faIntegrity(check.id)}: کنترل کامل ممکن نیست.`) : ["همه کنترلهای سازگاری موجود قابل آزمون بودند."] });
    sections.push({ heading: "شکافهای عملیاتی", lines: operationalGaps.length ? operationalGaps : ["شکاف عملیاتی مشخصی در شواهد فعلی ثبت نشده است."] });
    sections.push({ heading: "اقدام برای تکمیل", lines: linesOf(groups.actions) });
  } else if (intent === "ANALYZE") {
    const keyFigures = [
      metric(insight, "revenue") !== null ? `درآمد: ${formatFaAmount(metric(insight, "revenue"), currency)}` : "درآمد: در سند استخراج نشده است",
      metric(insight, "netProfit") !== null ? `سود خالص: ${formatFaAmount(metric(insight, "netProfit"), currency)}` : "سود خالص: در سند استخراج نشده است",
      metric(insight, "grossProfit") !== null ? `سود ناخالص: ${formatFaAmount(metric(insight, "grossProfit"), currency)}` : null,
      metric(insight, "totalAssets") !== null ? `کل دارایی‌ها: ${formatFaAmount(metric(insight, "totalAssets"), currency)}` : null,
      metric(insight, "equity") !== null ? `حقوق مالکانه: ${formatFaAmount(metric(insight, "equity"), currency)}` : null,
    ].filter((line): line is string => Boolean(line));
    sections.push({ heading: "خلاصه مدیریتی", lines: [
      `این تحلیل بر سند با وضعیت ${faDocumentStatus(insight.documentStatus)} و دوره‌های ${insight.periods.map((period) => period.label).join("، ") || "نامشخص"} استوار است.`,
      ...keyFigures,
      ...linesOf(groups.strengths).slice(0, 3),
      ...linesOf(groups.weaknesses).slice(0, 3),
    ] });
    sections.push({ heading: "ریسکها", lines: linesOf(groups.risks) });
    sections.push({ heading: "فرصتها و رشد", lines: linesOf(groups.opportunities) });
    for (const section of productSegmentSections(insight)) sections.push(section);
    sections.push({ heading: "اقدامات پیشنهادی", lines: linesOf(groups.actions) });
    sections.push({ heading: "محدودیتها", lines: limitations.length ? limitations : ["محدودیت ثبتشدهای برای این تحلیل وجود ندارد."] });
  } else {
    sections.push({ heading: "خلاصه", lines: [
      `سند با وضعیت ${faDocumentStatus(insight.documentStatus)} بررسی شد؛ ارقام از همین سند استخراج شدهاند.`,
      metric(insight, "revenue") !== null ? `درآمد: ${formatFaAmount(metric(insight, "revenue"), currency)}.` : "درآمد: در سند استخراج نشده است.",
      metric(insight, "netProfit") !== null ? `سود خالص: ${formatFaAmount(metric(insight, "netProfit"), currency)}.` : "سود خالص: در سند استخراج نشده است.",
    ] });
    sections.push({ heading: "نقاط قوت", lines: linesOf(groups.strengths) });
    sections.push({ heading: "ریسک‌ها", lines: linesOf(groups.risks) });
    for (const section of productSegmentSections(insight)) sections.push(section);
    sections.push({ heading: "اقدامات پیشنهادی", lines: linesOf(groups.actions) });
    sections.push({ heading: "محدودیتها", lines: limitations.length ? limitations : ["محدودیت ثبتشدهای برای این تحلیل وجود ندارد."] });
  }

  const answer = sections
    .flatMap((section) => [section.heading, ...section.lines])
    .join("\n");

  return { intent, answer, sections, scenarios: intent === "SCENARIOS" ? scenarios : [], limitations };
}
