/**
 * HooshyarOS — Unified financial document understanding (supporting boundary).
 *
 * One Product-level normalization boundary shared by PDF (native + OCR), XLSX and
 * legacy XLS. It is NOT a new Engine, NOT a second ingestion path and NOT a
 * second canonical financial model: it produces *canonical financial facts*
 * (statement measures with provenance) that attach to the existing canonical
 * `FinancialCanonicalModel` under the optional `document` field, and it derives
 * the existing analysis inputs from those facts.
 *
 * The existing 5-column transaction model remains the correct representation for
 * a real transaction ledger. A complete annual financial report is NOT a ledger:
 * it is a set of sections (auditor report, board report, balance sheet, income
 * statement, cash flow, equity, notes). This boundary represents those sections
 * and normalizes statement tables into typed facts, never guessing an ambiguous
 * column or label.
 *
 * Truthfulness rules:
 *   - a section is reported COMPLETED / PARTIAL / FAILED from real extraction;
 *   - narrative sections never fail the report merely for not being tables;
 *   - an unrecognized label yields no fact (it is never guessed);
 *   - every fact retains its source line, raw text, period and unit;
 *   - no percentage or fact is fabricated.
 */
import {
  extractDeclaredCurrency,
  isChangeColumnHeader,
  isStatementPeriodHeader,
  isYearHeaderCell,
  normalizePersianLetters,
  parseStatementAmount,
  toAsciiDigits,
} from "./DocumentTableExtractor";
import type { RatioStatement } from "./RatioAnalysisService";

export type FinancialSectionType =
  | "AUDITOR_REPORT"
  | "BOARD_REPORT"
  | "BALANCE_SHEET"
  | "INCOME_STATEMENT"
  | "CASH_FLOW_STATEMENT"
  | "CHANGES_IN_EQUITY"
  | "NOTES"
  | "UNKNOWN";

export type FinancialSectionState = "COMPLETED" | "PARTIAL" | "FAILED";

export type FinancialDocumentStatus = "COMPLETED" | "PARTIAL" | "FAILED";

export type StatementMeasure =
  | "ASSETS"
  | "CURRENT_ASSETS"
  | "NON_CURRENT_ASSETS"
  | "CASH"
  | "RECEIVABLES"
  | "INVENTORY"
  | "PPE"
  | "LIABILITIES"
  | "CURRENT_LIABILITIES"
  | "NON_CURRENT_LIABILITIES"
  | "PAYABLES"
  | "SHORT_TERM_DEBT"
  | "LONG_TERM_DEBT"
  | "EQUITY"
  | "REVENUE"
  | "COGS"
  | "GROSS_PROFIT"
  | "OPERATING_EXPENSES"
  | "OPERATING_PROFIT"
  | "OTHER_OPERATING_INCOME"
  | "OTHER_OPERATING_EXPENSES"
  | "NON_OPERATING_INCOME"
  | "INTEREST"
  | "PRE_TAX_INCOME"
  | "TAX"
  | "EXPENSES"
  | "NET_PROFIT"
  | "OPERATING_CASH_FLOW"
  | "INVESTING_CASH_FLOW"
  | "FINANCING_CASH_FLOW"
  | "NET_CASH_FLOW";

export const STATEMENT_MEASURES: ReadonlyArray<StatementMeasure> = [
  "ASSETS",
  "CURRENT_ASSETS",
  "NON_CURRENT_ASSETS",
  "CASH",
  "RECEIVABLES",
  "INVENTORY",
  "PPE",
  "LIABILITIES",
  "CURRENT_LIABILITIES",
  "NON_CURRENT_LIABILITIES",
  "PAYABLES",
  "SHORT_TERM_DEBT",
  "LONG_TERM_DEBT",
  "EQUITY",
  "REVENUE",
  "COGS",
  "GROSS_PROFIT",
  "OPERATING_EXPENSES",
  "OPERATING_PROFIT",
  "OTHER_OPERATING_INCOME",
  "OTHER_OPERATING_EXPENSES",
  "NON_OPERATING_INCOME",
  "INTEREST",
  "PRE_TAX_INCOME",
  "TAX",
  "EXPENSES",
  "NET_PROFIT",
  "OPERATING_CASH_FLOW",
  "INVESTING_CASH_FLOW",
  "FINANCING_CASH_FLOW",
  "NET_CASH_FLOW",
];

/** Measures a complete statement of each type is expected to expose. */
const PRIMARY_MEASURES: Partial<Record<FinancialSectionType, ReadonlyArray<StatementMeasure>>> = {
  BALANCE_SHEET: ["ASSETS", "LIABILITIES", "EQUITY"],
  INCOME_STATEMENT: ["REVENUE", "NET_PROFIT"],
  CASH_FLOW_STATEMENT: ["OPERATING_CASH_FLOW"],
  CHANGES_IN_EQUITY: ["EQUITY"],
};

const NARRATIVE_SECTIONS: ReadonlySet<FinancialSectionType> = new Set([
  "AUDITOR_REPORT",
  "BOARD_REPORT",
  "NOTES",
]);

export interface FinancialFactEvidence {
  /** 1-based line index inside the whole document. */
  readonly line: number;
  /** 1-based page index when the source was paged (PDF); absent otherwise. */
  readonly page?: number;
  /** The raw source line/cells that produced the fact. */
  readonly text: string;
}

export interface FinancialStatementFact {
  readonly measure: StatementMeasure;
  readonly section: FinancialSectionType;
  /** Original (normalized-for-display) label text from the document. */
  readonly label: string;
  /** Period label from the column header, or the positional fallback. */
  readonly periodLabel: string;
  /** Column index of the period inside the statement grid. */
  readonly periodIndex: number;
  /** Value exactly as printed (positive hundreds as declared, signed). */
  readonly rawValue: number;
  /** rawValue already scaled by the declared unit multiplier. */
  readonly value: number;
  /** Declared unit multiplier (1, 1e3, 1e6, 1e9). */
  readonly unitMultiplier: number;
  /** Currency code (IRR / IRT / declared ISO code); empty when undeclared. */
  readonly currency: string;
  /** 1 when the row/columns mapped exactly; lower when columns were inferred. */
  readonly confidence: number;
  readonly evidence: FinancialFactEvidence;
}

export interface FinancialDocumentSection {
  readonly type: FinancialSectionType;
  readonly state: FinancialSectionState;
  readonly startLine: number;
  readonly endLine: number;
  readonly pageStart?: number;
  readonly pageEnd?: number;
  readonly facts: ReadonlyArray<FinancialStatementFact>;
  /** Precise, non-fabricated notes (e.g. ambiguous columns, undeclared unit). */
  readonly notes: ReadonlyArray<string>;
  /** Precise technical code when the section could not be completed. */
  readonly failureCode?: string;
}

export interface FinancialDocumentUnderstanding {
  readonly status: FinancialDocumentStatus;
  readonly currency: string | null;
  readonly unitMultiplier: number;
  readonly sections: ReadonlyArray<FinancialDocumentSection>;
  readonly facts: ReadonlyArray<FinancialStatementFact>;
  /**
   * Product/segment-level revenue, cost-of-goods-sold, gross profit, quantity
   * and unit price extracted from a document's per-product revenue table (for
   * example the "درآمدهای عملیاتی و بهای تمام شده" table). This is an additive,
   * optional canonical projection: a document without such a table simply
   * carries no segments and every downstream capability discloses the gap
   * honestly. Values are scaled by the declared unit multiplier except the unit
   * price, which is expressed in currency-per-unit as printed.
   */
  readonly segments?: ReadonlyArray<ProductSegment>;
}

export interface ProductSegmentPeriodValue {
  readonly quantityProduced: number | null;
  readonly quantitySold: number | null;
  /** Price per unit as printed (currency per unit, not scaled by the unit multiplier). */
  readonly unitPrice: number | null;
  /** Sales amount, scaled by the declared unit multiplier. */
  readonly revenue: number;
  /** Cost of goods sold shown for the product, scaled and sign-normalized. */
  readonly cost: number | null;
  /** Gross profit shown for the product, scaled and signed (may be negative). */
  readonly grossProfit: number | null;
}

export interface ProductSegment {
  readonly name: string;
  readonly unit: string;
  readonly current: ProductSegmentPeriodValue;
  readonly prior: ProductSegmentPeriodValue | null;
  /** 1 when the product row mapped exactly from the revenue table. */
  readonly confidence: number;
  readonly evidence: FinancialFactEvidence;
}

export const FINANCIAL_DOCUMENT_ERROR_CODES = {
  INSUFFICIENT_EVIDENCE: "financial-report-insufficient-evidence",
  AMBIGUOUS_TABLE: "financial-report-ambiguous-table",
  PARTIAL_SUCCESS: "financial-report-partial-success",
  SPREADSHEET_STATEMENT_AMBIGUOUS: "spreadsheet-statement-ambiguous",
  /** A `.xls`/`.xlsx` whose real content is HTML, not OLE2/BIFF or OOXML. */
  SPREADSHEET_HTML_CONTENT_DETECTED: "spreadsheet-html-content-detected",
  /** HTML content detected in a spreadsheet file that yields no valid financial table. */
  SPREADSHEET_HTML_CONTENT_UNSUPPORTED: "spreadsheet-html-content-unsupported",
} as const;

/* ------------------------------------------------------------------------- *
 * Label normalization
 * ------------------------------------------------------------------------- */

const ARABIC_TO_PERSIAN: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u064a\u0649]/g, "ی"],
  [/[\u0643]/g, "ک"],
  [/[\u0629]/g, "ه"],
  [/[\u0623\u0625\u0622\u0671]/g, "ا"],
];

/** Normalize a document label for deterministic, non-fuzzy alias matching. */
export function normalizeStatementLabel(value: string): string {
  if (typeof value !== "string") return "";
  // Drop zero-width joiners/marks so "دارایی‌ها" and "داراییها" are identical.
  let out = toAsciiDigits(value).replace(/[\u200c\u200e\u200f]/g, "").replace(/\u00a0/g, " ");
  for (const [pattern, replacement] of ARABIC_TO_PERSIAN) out = out.replace(pattern, replacement);
  out = out
    .replace(/[()\[\]{}«»"'`.,،؛:;|_\-–—−/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  // Drop a leading note marker ("1-", "۱ -") and a trailing note reference.
  out = out.replace(/^\d+\s*/, "").replace(/\s+\d+$/, "").trim();
  return out;
}

const stripSpaces = (value: string): string => value.replace(/\s+/g, "");
const matchKey = (value: string): string => stripSpaces(normalizeStatementLabel(value));

function buildAliasMap(
  entries: ReadonlyArray<readonly [StatementMeasure, ReadonlyArray<string>]>,
): Map<string, StatementMeasure> {
  const map = new Map<string, StatementMeasure>();
  for (const [measure, aliases] of entries) {
    for (const alias of aliases) {
      const key = matchKey(alias);
      if (key) map.set(key, measure);
    }
  }
  return map;
}

const MEASURE_ALIASES = buildAliasMap([
  ["ASSETS", ["جمع دارایی‌ها", "جمع کل دارایی‌ها", "مجموع دارایی‌ها", "total assets", "assets"]],
  ["CURRENT_ASSETS", ["جمع دارایی‌های جاری", "دارایی‌های جاری", "total current assets", "current assets"]],
  ["NON_CURRENT_ASSETS", ["جمع دارایی‌های غیرجاری", "دارایی‌های غیرجاری", "دارایی‌های ثابت", "total non-current assets", "non-current assets", "fixed assets"]],
  ["LIABILITIES", ["جمع بدهی‌ها", "مجموع بدهی‌ها", "total liabilities", "liabilities"]],
  ["CURRENT_LIABILITIES", ["جمع بدهی‌های جاری", "بدهی‌های جاری", "total current liabilities", "current liabilities"]],
  ["NON_CURRENT_LIABILITIES", ["جمع بدهی‌های غیرجاری", "بدهی‌های غیرجاری", "total non-current liabilities", "non-current liabilities"]],
  ["EQUITY", ["جمع حقوق مالکانه", "حقوق مالکانه", "مجموع حقوق مالکانه", "total equity", "equity"]],
  ["REVENUE", ["درآمد عملیاتی", "درآمدهای عملیاتی", "فروش", "درآمد", "revenue", "sales", "operating revenue"]],
  ["COGS", ["بهای تمام شده کالای فروش رفته", "بهای تمام‌شده کالای فروش رفته", "بهای تمام شده", "بهای تمام شده درآمدهای عملیاتی", "بهای تمام شده درآمد عملیاتی", "بهای تمام شده فروش", "cost of goods sold", "cost of sales"]],
  ["GROSS_PROFIT", ["سود ناخالص", "سود زیان ناخالص", "زیان ناخالص", "gross profit", "gross loss"]],
  ["OPERATING_EXPENSES", ["هزینه‌های فروش اداری و عمومی", "هزینه‌های عملیاتی", "هزینه‌های فروش و اداری و عمومی", "operating expenses", "selling general and administrative expenses"]],
  ["OPERATING_PROFIT", ["سود زیان عملیاتی", "سود عملیاتی", "زیان عملیاتی", "operating profit", "operating income", "operating loss"]],
  // Other operating income / expense are the two lines a real Iranian income
  // statement prints between SG&A and operating profit ("سایر درآمدها" /
  // "سایر هزینه‌ها"). Without them the operating-profit identity cannot be
  // evaluated, because gross profit - SG&A is not the whole operating result.
  ["OTHER_OPERATING_INCOME", ["سایر درآمدها", "سایر درآمدهای عملیاتی", "سایر درآمد عملیاتی", "سایر درآمدهای عملیات", "other operating income", "other income"]],
  ["OTHER_OPERATING_EXPENSES", ["سایر هزینه‌ها", "سایر هزینه ها", "سایر هزینه‌های عملیاتی", "سایر هزینه های عملیاتی", "سایر هزینه عملیاتی", "other operating expenses", "other expenses"]],
  ["EXPENSES", ["جمع هزینه‌ها", "مجموع هزینه‌ها", "هزینه‌ها", "total expenses", "expenses"]],
  ["NET_PROFIT", ["سود زیان خالص", "سود خالص", "زیان خالص", "سود زیان پس از مالیات", "net profit", "net income", "net loss", "profit for the year"]],
  ["OPERATING_CASH_FLOW", ["جریان نقدی عملیاتی", "جریان‌های نقدی عملیاتی", "خالص جریان‌های نقدی عملیاتی", "جریان نقدینگی عملیاتی", "جریان خالص ورود خروج نقد حاصل از فعالیت های عملیاتی", "جریان خالص ورود خروج نقد حاصل از فعالیتهای عملیاتی", "net cash from operating activities", "net cash provided by operating activities", "cash flows from operating activities"]],
  ["INVESTING_CASH_FLOW", ["جریان نقدی سرمایه‌گذاری", "جریان‌های نقدی سرمایه‌گذاری", "خالص جریان‌های نقدی سرمایه‌گذاری", "جریان خالص ورود خروج نقد حاصل از فعالیت های سرمایه گذاری", "جریان خالص ورود خروج نقد حاصل از فعالیتهای سرمایه‌گذاری", "net cash from investing activities", "cash flows from investing activities"]],
  ["FINANCING_CASH_FLOW", ["جریان نقدی تامین مالی", "جریان‌های نقدی تامین مالی", "خالص جریان‌های نقدی تامین مالی", "جریان خالص ورود خروج نقد حاصل از فعالیت های تامین مالی", "جریان خالص ورود خروج نقد حاصل از فعالیتهای تامین مالی", "net cash from financing activities", "cash flows from financing activities"]],
  ["NET_CASH_FLOW", ["خالص افزایش کاهش نقد", "خالص افزایش کاهش در موجودی نقد", "خالص جریان نقدی", "افزایش کاهش خالص نقد", "net increase in cash", "net decrease in cash", "net cash flow"]],
  // Working-capital / capital-structure detail measures. These are the exact
  // line items the canonical `FinancialIntelligenceEngine.workingCapital` /
  // `liquidityRatios` and the `RatioStatement` contract require; without them
  // the platform cannot compute quick/cash liquidity, DSO/DIO/DPO/CCC or
  // interest coverage from a real statement. Only explicit label matches are
  // accepted — nothing is inferred.
  ["CASH", ["موجودی نقد", "موجودی نقد و بانک", "نقد و بانک", "موجودی نقد و معادل نقد", "موجودی نقد و بانک‌ها", "cash", "cash and cash equivalents", "cash and bank balances"]],
  ["RECEIVABLES", ["دریافتنی‌های تجاری و سایر دریافتنی‌ها", "دریافتنی‌های تجاری", "حساب‌های دریافتنی تجاری", "حساب‌های دریافتنی", "مطالبات تجاری", "طلب از مشتریان", "trade receivables", "accounts receivable", "receivables"]],
  ["INVENTORY", ["موجودی مواد و کالا", "موجودی کالا", "موجودی مواد", "inventory", "inventories"]],
  ["PPE", ["دارایی‌های ثابت مشهود", "دارایی ثابت مشهود", "اموال ماشین آلات و تجهیزات", "property plant and equipment", "property, plant and equipment", "ppe", "fixed tangible assets"]],
  ["PAYABLES", ["پرداختنی‌های تجاری و سایر پرداختنی‌ها", "پرداختنی‌های تجاری", "حساب‌های پرداختنی تجاری", "حساب‌های پرداختنی", "بدهی به تامین کنندگان", "trade payables", "accounts payable", "payables"]],
  ["SHORT_TERM_DEBT", ["تسهیلات مالی", "تسهیلات مالی کوتاه مدت", "تسهیلات کوتاه مدت", "بدهی‌های کوتاه مدت", "short-term debt", "short term debt", "short-term borrowings"]],
  ["LONG_TERM_DEBT", ["تسهیلات مالی بلندمدت", "تسهیلات مالی بلند مدت", "بدهی‌های بلندمدت", "long-term debt", "long term debt", "long-term borrowings"]],
  ["INTEREST", ["هزینه‌های مالی", "هزینه مالی", "هزینه‌های تامین مالی", "finance costs", "finance cost", "interest expense", "interest expenses"]],
  // The net non-operating result a real statement prints between finance costs
  // and the pre-tax line ("سایر درآمدها و هزینه‌های غیرعملیاتی"). It is a signed
  // net amount: income positive, expense negative, exactly as printed. Without it
  // the pre-tax identity cannot be evaluated at all.
  ["NON_OPERATING_INCOME", ["سایر درآمدها و هزینه‌های غیرعملیاتی", "سایر درآمدها و هزینه های غیرعملیاتی", "سایر درآمدها و هزینه‌های غیر عملیاتی", "سایر درآمدها و هزینه های غیر عملیاتی", "سایر درآمد و هزینه غیرعملیاتی", "سایر درآمدهای و هزینه های غیرعملیاتی", "سایر درآمد و هزینه‌های غیرعملیاتی", "non-operating income and expenses", "other non-operating income and expenses", "other income and expenses non-operating"]],
  // Real Persian statements print the pre-tax line as "عملیات در حال تداوم"
  // (operations) as often as "عملیاتی" (operating); both spellings must match or
  // the pre-tax line is silently discarded on a real report.
  ["PRE_TAX_INCOME", ["سود(زیان) عملیاتی در حال تداوم قبل از مالیات", "سود زیان عملیاتی در حال تداوم قبل از مالیات", "سود(زیان) عملیات در حال تداوم قبل از مالیات", "سود زیان عملیات در حال تداوم قبل از مالیات", "سود(زیان) قبل از مالیات", "سود قبل از مالیات", "سود و زیان قبل از مالیات", "profit before tax", "income before tax", "pre-tax profit", "profit before income tax"]],
  // Income-tax expense header. The tax amount may be printed on the header row
  // itself or split across detail rows ("سال جاری" / "سال‌های قبل"), which are
  // aggregated while this header context is open (see extractSectionFacts).
  ["TAX", ["هزینه مالیات بر درآمد", "هزینه مالیات بر درآمد عملیات", "هزینه مالیات", "مالیات بر درآمد", "income tax expense", "tax expense"]],
]);

/** Detail rows that split a single income-tax-expense header (exact matches only). */
const TAX_DETAIL_ALIASES: ReadonlySet<string> = new Set(
  ["سال جاری", "سال مالی جاری", "سال‌های قبل", "سالهای قبل", "سال گذشته", "سال‌های گذشته", "current year", "prior years", "previous years"]
    .map((alias) => matchKey(alias))
    .filter(Boolean),
);

/** Map a statement label to a canonical measure, or null when unrecognized. */
export function matchStatementMeasure(label: string): StatementMeasure | null {
  const key = matchKey(label);
  if (!key) return null;
  return MEASURE_ALIASES.get(key) ?? null;
}

/* ------------------------------------------------------------------------- *
 * Units and currency
 * ------------------------------------------------------------------------- */

export interface StatementUnitDeclaration {
  readonly multiplier: number;
  readonly currency: string | null;
}

/**
 * Detect the declared statement unit and currency. Only an explicit declaration
 * is accepted; a bare number is never assumed to be thousands/millions.
 *
 * Real Persian reports mix Arabic and Persian letter variants (`ميليون` vs
 * `میلیون`), so every comparison first normalizes the letters. The scale is
 * taken from the most frequent explicit scale phrase (`هزار/میلیون/میلیارد ریال`,
 * "thousand/million/billion rials"): the statements declare their unit many
 * times, so one narrative amount such as
 * `افزايش سرمايه به مبلغ ۵هزار ميليارد ريال` can never override the unit the
 * statements actually declare, and a generic `ريال` never overrides a specific
 * `هزار/میلیون/میلیارد` unit.
 */
const SCALE_PHRASES: ReadonlyArray<readonly [RegExp, number]> = [
  [/(?:میلیارد|billions?)\s*(?:ریال|تومان|rials?|irr|tomans?)/i, 1_000_000_000],
  [/(?:میلیون|millions?)\s*(?:ریال|تومان|rials?|irr|tomans?)/i, 1_000_000],
  [/(?:هزار|thousands?)\s*(?:ریال|تومان|rials?|irr|tomans?)/i, 1_000],
];

/**
 * Count every explicit scale phrase and take the most frequent, so a single
 * narrative `میلیارد ریال` never beats the many `میلیون ریال` occurrences the
 * statements declare. Ties resolve to the larger scale deterministically.
 */
function dominantScaleInText(text: string): number {
  let best = 1;
  let bestCount = 0;
  for (const [pattern, multiplier] of SCALE_PHRASES) {
    const global = new RegExp(pattern.source, `${pattern.flags}g`);
    const count = text.match(global)?.length ?? 0;
    if (count > bestCount) {
      best = multiplier;
      bestCount = count;
    }
  }
  return bestCount > 0 ? best : 1;
}

export function detectStatementUnit(text: string): StatementUnitDeclaration {
  const normalized = normalizePersianLetters(
    toAsciiDigits(typeof text === "string" ? text : ""),
  ).replace(/[\u200c\u200e\u200f]/g, " ");
  const compact = normalized.replace(/\s+/g, " ");

  const multiplier = dominantScaleInText(compact);

  let currency: string | null = null;
  if (/تومان/.test(compact)) currency = "IRT";
  else if (/ریال/.test(compact)) currency = "IRR";
  const declared = extractDeclaredCurrency(toAsciiDigits(compact));
  if (declared) currency = declared;
  if (!currency) {
    // An explicit unit phrase followed by a code ("figures in million IRR").
    const unitCurrency = compact.match(/(?:millions?|thousands?|billions?|هزار|میلیون|میلیارد)\s*(rials?|irr|tomans?|irt)\b/i);
    if (unitCurrency) currency = /toman|irt/i.test(unitCurrency[1]) ? "IRT" : "IRR";
  }

  return { multiplier, currency };
}

/* ------------------------------------------------------------------------- *
 * Section detection
 * ------------------------------------------------------------------------- */

interface SectionAliasGroup {
  readonly type: FinancialSectionType;
  readonly aliases: ReadonlyArray<string>;
}

const SECTION_ALIAS_GROUPS: ReadonlyArray<SectionAliasGroup> = [
  { type: "BALANCE_SHEET", aliases: ["صورت وضعیت مالی", "صورت‌های وضعیت مالی", "ترازنامه", "statement of financial position", "balance sheet"] },
  { type: "INCOME_STATEMENT", aliases: ["صورت سود و زیان", "صورت سود و زیان جامع", "سود و زیان", "income statement", "statement of profit or loss", "profit and loss"] },
  { type: "CASH_FLOW_STATEMENT", aliases: ["صورت جریان‌های نقدی", "صورت جریان وجوه نقد", "جریان وجوه نقد", "جریان‌های نقدی", "cash flow statement", "statement of cash flows"] },
  { type: "CHANGES_IN_EQUITY", aliases: ["صورت تغییرات در حقوق مالکانه", "تغییرات در حقوق مالکانه", "changes in equity", "statement of changes in equity"] },
  { type: "AUDITOR_REPORT", aliases: ["گزارش حسابرس مستقل", "گزارش حسابرسان مستقل", "گزارش حسابرس", "independent auditor", "auditor's report", "auditors report"] },
  { type: "BOARD_REPORT", aliases: ["گزارش هیئت مدیره", "گزارش هیئت‌مدیره", "گزارش مدیران", "گزارش فعالیت هیئت مدیره", "board of directors report", "directors report", "management report"] },
  { type: "NOTES", aliases: ["یادداشت‌های توضیحی", "یادداشت توضیحی", "یادداشت‌ها", "notes to the financial statements", "notes to financial statements"] },
];

const SECTION_ALIAS_KEYS: ReadonlyArray<{ type: FinancialSectionType; key: string }> = SECTION_ALIAS_GROUPS
  .flatMap((group) => group.aliases.map((alias) => ({ type: group.type, key: stripSpaces(normalizeStatementLabel(alias)) })))
  .sort((a, b) => b.key.length - a.key.length);

/**
 * Match a document line to a section type. A heading is a short line that
 * contains a section alias; the longest alias wins so overlapping titles stay
 * deterministic. Narrative mentions inside long sentences are not headings.
 */
export function matchFinancialSectionHeading(line: string): FinancialSectionType | null {
  if (typeof line !== "string") return null;
  const raw = line.trim();
  if (!raw || raw.length > 120) return null;
  const key = stripSpaces(normalizeStatementLabel(raw));
  if (!key) return null;

  // A table-of-contents reference ("- صورت سود و زیان تلفیقی 5") is NOT a
  // section: it is a list entry pointing at a page. Detecting it as a heading
  // produced dozens of empty FAILED sections in the real scanned report.
  const ascii = toAsciiDigits(raw);
  if (/^[-–—•*]\s+/.test(ascii)) return null;
  if (/\s\d{1,3}$/.test(ascii)) return null;

  let matched: FinancialSectionType | null = null;
  for (const alias of SECTION_ALIAS_KEYS) {
    if (key === alias.key || key.startsWith(alias.key)) {
      matched = alias.type;
      break;
    }
  }
  if (matched) return matched;

  // OCR may attach a short suffix ("... ( ادامه )") or prefix ("صورت مالی ...").
  const tokenCount = raw.split(/\s+/).filter(Boolean).length;
  if (tokenCount <= 8) {
    for (const alias of SECTION_ALIAS_KEYS) {
      if (alias.key.length >= 6 && key.includes(alias.key)) return alias.type;
    }
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * Row/column primitives
 * ------------------------------------------------------------------------- */

/** Split one document text line into cells. Handles OCR single-space output. */
export function splitStatementRow(line: string): string[] {
  if (typeof line !== "string") return [];
  const trimmed = line.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return [];
  if (trimmed.includes("|")) return trimmed.split("|").map((cell) => cell.trim());
  if (trimmed.includes("\t")) return trimmed.split("\t").map((cell) => cell.trim());
  const wide = trimmed.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
  if (wide.length >= 2) return wide;
  return trimmed.split(/\s+/).map((cell) => cell.trim());
}

const RELATIVE_PERIOD_KEYS = new Set([
  "دورهجاری", "سالجاری", "جاری", "current", "currentyear", "دورهقبل", "سالقبل", "قبل", "prior", "previous", "comparative", "دورهبعد",
]);

function isPeriodToken(cell: string): boolean {
  if (isYearHeaderCell(cell)) return true;
  if (RELATIVE_PERIOD_KEYS.has(stripSpaces(normalizeStatementLabel(cell)))) return true;
  // Comparative-statement headers carry a real year ("دوره منتهی به ۱۴۰۵/۰۴/۳۱").
  // A change/percentage column is explicitly NOT a period.
  if (isChangeColumnHeader(cell)) return false;
  return isStatementPeriodHeader(cell);
}

function isNumericCell(cell: string): boolean {
  const trimmed = String(cell ?? "").trim();
  if (!trimmed) return false;
  return parseStatementAmount(trimmed) !== null;
}

const DEFAULT_PERIOD_LABELS = ["current", "prior", "prior-2", "prior-3"] as const;

interface StatementGrid {
  /** Index of the first value column (label columns are before it). */
  readonly labelEnd: number;
  readonly periodColumns: ReadonlyArray<number>;
  readonly periodLabels: ReadonlyArray<string>;
  readonly hasHeader: boolean;
}

/**
 * Locate the period columns of a statement grid. A header row is the first row
 * whose first cell is not itself a period and that declares at least one period
 * token in a later cell. When no header exists, the grid is treated as freeform
 * and the rows are read from their trailing numeric tokens.
 */
function locateStatementGrid(rows: ReadonlyArray<ReadonlyArray<string>>): StatementGrid {
  for (let r = 0; r < Math.min(rows.length, 6); r += 1) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    if (isPeriodToken(row[0] ?? "")) continue;
    const periodColumns: number[] = [];
    const periodLabels: string[] = [];
    for (let c = 1; c < row.length; c += 1) {
      const cell = String(row[c] ?? "").trim();
      if (!cell) continue;
      if (isPeriodToken(cell)) {
        periodColumns.push(c);
        periodLabels.push(cell);
      }
    }
    if (periodColumns.length > 0) {
      return { labelEnd: periodColumns[0], periodColumns, periodLabels, hasHeader: true };
    }
  }
  return { labelEnd: 1, periodColumns: [1], periodLabels: [DEFAULT_PERIOD_LABELS[0]], hasHeader: false };
}

function valueFromCell(cell: string | undefined): number | null {
  const trimmed = String(cell ?? "").trim();
  if (!trimmed) return null;
  return parseStatementAmount(trimmed);
}

function joinRowText(row: ReadonlyArray<string>): string {
  return row.map((cell) => String(cell ?? "").trim()).filter(Boolean).join(" ").slice(0, 300);
}

/* ------------------------------------------------------------------------- *
 * Fact extraction
 * ------------------------------------------------------------------------- */

interface FactExtractionResult {
  readonly facts: ReadonlyArray<FinancialStatementFact>;
  readonly notes: ReadonlyArray<string>;
}

function extractSectionFacts(
  rows: ReadonlyArray<ReadonlyArray<string>>,
  sectionType: FinancialSectionType,
  unit: StatementUnitDeclaration,
  lineOffset: number,
  positional: boolean,
  pageNumbers?: ReadonlyArray<number | undefined>,
): FactExtractionResult {
  const grid = locateStatementGrid(rows);
  const facts: FinancialStatementFact[] = [];
  const notes: string[] = [];
  if (!unit.currency) notes.push("currency-undeclared");
  if (unit.multiplier === 1) notes.push("unit-not-declared-assumed-rial");

  let pendingLabel = "";
  let inferredColumns = false;
  // A single income-tax-expense header may be followed by detail rows
  // ("سال جاری" / "سال‌های قبل"). Their amounts are aggregated into one TAX fact
  // per period while the header context is open. Only exact detail labels are
  // accepted, so an unrelated unrecognized row can never be folded into tax.
  let taxContextOpen = false;
  const taxAccumulator = new Map<number, { label: string; value: number; confidence: number; rowIndex: number }>();

  const emitFact = (
    measure: StatementMeasure,
    label: string,
    entry: { index: number; label: string; value: number; confidence: number },
    rowIndex: number,
  ): void => {
    const page = pageNumbers?.[rowIndex];
    facts.push({
      measure,
      section: sectionType,
      label,
      periodLabel: entry.label,
      periodIndex: entry.index,
      rawValue: entry.value,
      value: entry.value * unit.multiplier,
      unitMultiplier: unit.multiplier,
      currency: unit.currency ?? "",
      confidence: entry.confidence,
      evidence: { line: lineOffset + rowIndex + 1, text: joinRowText(rows[rowIndex] ?? []), ...(typeof page === "number" ? { page } : {}) },
    });
  };

  const flushTax = (): void => {
    if (taxAccumulator.size === 0) return;
    const ordered = [...taxAccumulator.entries()].sort((a, b) => a[0] - b[0]);
    for (const [index, entry] of ordered) {
      emitFact(
        "TAX",
        entry.label,
        { index, label: grid.periodLabels[index] ?? DEFAULT_PERIOD_LABELS[index] ?? `period-${index}`, value: entry.value, confidence: entry.confidence },
        entry.rowIndex,
      );
    }
    taxAccumulator.clear();
  };

  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const cells = row.map((cell) => String(cell ?? "").trim());
    // A single text cell is the raw OCR/document line: tokenize it so the
    // label is everything before the trailing numeric value run.
    const effective = cells.length === 1 && /\s/.test(cells[0]) ? splitStatementRow(cells[0]) : cells;

    let label = "";
    let periodValues: Array<{ index: number; label: string; value: number; confidence: number }> = [];

    if (positional && grid.hasHeader) {
      label = String(effective[0] ?? "").trim();
      grid.periodColumns.forEach((column, index) => {
        const value = valueFromCell(effective[column]);
        if (value === null) return;
        periodValues.push({
          index,
          label: grid.periodLabels[index] ?? DEFAULT_PERIOD_LABELS[index] ?? `period-${index}`,
          value,
          confidence: 1,
        });
      });
    } else if (positional) {
      const nonEmpty = effective.filter(Boolean);
      label = nonEmpty[0] ?? "";
      const valueCells = effective.slice(1).filter(Boolean);
      const numeric = valueCells.filter(isNumericCell);
      if (numeric.length > 0) {
        if (numeric.length !== valueCells.length) inferredColumns = true;
        periodValues = numeric.map((cell, index) => ({
          index,
          label: grid.periodLabels[index] ?? DEFAULT_PERIOD_LABELS[index] ?? `period-${index}`,
          value: parseStatementAmount(cell) as number,
          confidence: 1,
        }));
      }
    } else {
      const tokens = effective.filter(Boolean);
      const trailing: number[] = [];
      for (let t = tokens.length - 1; t >= 0; t -= 1) {
        const parsed = parseStatementAmount(tokens[t]);
        if (parsed === null) break;
        trailing.unshift(parsed);
      }
      if (trailing.length > 0) {
        inferredColumns = true;
        label = tokens.slice(0, tokens.length - trailing.length).join(" ").trim();
        periodValues = trailing.slice(0, 4).map((value, index) => ({
          index,
          label: grid.periodLabels[index] ?? DEFAULT_PERIOD_LABELS[index] ?? `period-${index}`,
          value,
          confidence: trailing.length === 1 ? 0.9 : 0.75,
        }));
      } else {
        label = tokens.join(" ").trim();
      }
    }

    const effectiveLabel = label || pendingLabel;

    // While a tax-expense header context is open, exact tax detail rows are
    // accumulated; any other row closes the context and is processed normally.
    if (taxContextOpen) {
      if (TAX_DETAIL_ALIASES.has(matchKey(effectiveLabel)) && periodValues.length > 0) {
        for (const entry of periodValues) {
          const previous = taxAccumulator.get(entry.index);
          taxAccumulator.set(entry.index, {
            label: previous?.label ?? effectiveLabel,
            value: (previous?.value ?? 0) + entry.value,
            confidence: Math.min(previous?.confidence ?? 1, entry.confidence),
            rowIndex: previous?.rowIndex ?? r,
          });
        }
        pendingLabel = "";
        continue;
      }
      flushTax();
      taxContextOpen = false;
    }

    if (periodValues.length === 0) {
      // A tax-expense header without its own value opens the detail context.
      if (matchStatementMeasure(effectiveLabel) === "TAX" && isMeasureForSection("TAX", sectionType)) {
        taxContextOpen = true;
        pendingLabel = "";
        continue;
      }
      if (effectiveLabel) pendingLabel = effectiveLabel;
      continue;
    }
    pendingLabel = "";

    const measure = matchStatementMeasure(effectiveLabel);
    if (!measure) continue;
    if (!isMeasureForSection(measure, sectionType)) continue;

    for (const entry of periodValues) {
      emitFact(measure, effectiveLabel, entry, r);
    }
  }
  flushTax();

  if (inferredColumns) notes.push("period-columns-inferred-from-trailing-values");
  return { facts, notes };
}

function isMeasureForSection(measure: StatementMeasure, sectionType: FinancialSectionType): boolean {
  if (sectionType === "BALANCE_SHEET") {
    return ["ASSETS", "CURRENT_ASSETS", "NON_CURRENT_ASSETS", "CASH", "RECEIVABLES", "INVENTORY", "PPE", "LIABILITIES", "CURRENT_LIABILITIES", "NON_CURRENT_LIABILITIES", "PAYABLES", "SHORT_TERM_DEBT", "LONG_TERM_DEBT", "EQUITY"].includes(measure);
  }
  if (sectionType === "INCOME_STATEMENT") {
    return ["REVENUE", "COGS", "GROSS_PROFIT", "OPERATING_EXPENSES", "OPERATING_PROFIT", "OTHER_OPERATING_INCOME", "OTHER_OPERATING_EXPENSES", "NON_OPERATING_INCOME", "INTEREST", "PRE_TAX_INCOME", "TAX", "EXPENSES", "NET_PROFIT"].includes(measure);
  }
  if (sectionType === "CASH_FLOW_STATEMENT") {
    return ["OPERATING_CASH_FLOW", "INVESTING_CASH_FLOW", "FINANCING_CASH_FLOW", "NET_CASH_FLOW"].includes(measure);
  }
  if (sectionType === "CHANGES_IN_EQUITY") return measure === "EQUITY";
  return false;
}

function sectionState(
  type: FinancialSectionType,
  facts: ReadonlyArray<FinancialStatementFact>,
  rowCount: number,
): { state: FinancialSectionState; failureCode?: string } {
  if (NARRATIVE_SECTIONS.has(type)) {
    // A narrative section is never "failed" for lacking tables; it is complete
    // when it actually contains content.
    return rowCount > 0 ? { state: "COMPLETED" } : { state: "FAILED", failureCode: FINANCIAL_DOCUMENT_ERROR_CODES.INSUFFICIENT_EVIDENCE };
  }
  if (facts.length === 0) return { state: "FAILED", failureCode: FINANCIAL_DOCUMENT_ERROR_CODES.AMBIGUOUS_TABLE };
  const primary = PRIMARY_MEASURES[type] ?? [];
  const present = new Set(facts.map((fact) => fact.measure));
  const complete = primary.every((measure) => present.has(measure));
  return complete ? { state: "COMPLETED" } : { state: "PARTIAL", failureCode: FINANCIAL_DOCUMENT_ERROR_CODES.PARTIAL_SUCCESS };
}

/* ------------------------------------------------------------------------- *
 * Document assembly
 * ------------------------------------------------------------------------- */

export interface OcrGeometryBoundingBox {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface OcrGeometryWord {
  readonly text: string;
  readonly bbox?: OcrGeometryBoundingBox;
}

export interface OcrGeometryLine {
  readonly text: string;
  readonly words: ReadonlyArray<OcrGeometryWord>;
}

/** One OCR page with real line/word geometry, as produced by an OcrAdapter. */
export interface OcrPageInput {
  readonly pageNumber: number;
  readonly lines: ReadonlyArray<OcrGeometryLine>;
}

/**
 * Rebuild one OCR line into deterministic cells using real word geometry.
 *
 * OCR collapses column spacing to single spaces, which destroys the positional
 * grid. The engine does preserve each word's bounding box, and tesseract emits
 * the words of an RTL line in logical reading order (label first, then the
 * numeric columns). Splitting at real inter-word x-gaps therefore recovers the
 * columns evidence-based, handles RTL and LTR, and never re-orders words.
 */
export function ocrLineToCells(line: OcrGeometryLine): string[] {
  const words = (line.words ?? [])
    .map((word) => ({ text: String(word?.text ?? "").trim(), bbox: word?.bbox }))
    .filter((word) => word.text.length > 0);
  if (words.length === 0) {
    const text = String(line.text ?? "").trim();
    return text ? [text] : [];
  }
  const boxed = words.filter(
    (word): word is { text: string; bbox: OcrGeometryBoundingBox } => !!word.bbox,
  );
  if (boxed.length !== words.length || boxed.length === 1) {
    return [words.map((word) => word.text).join(" ")];
  }

  const centers = boxed.map((word) => (word.bbox.x0 + word.bbox.x1) / 2);
  const leftToRight = centers[0] < centers[centers.length - 1];
  const heights = boxed
    .map((word) => Math.abs(word.bbox.y1 - word.bbox.y0))
    .filter((height) => height > 0)
    .sort((a, b) => a - b);
  const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 0;
  const gapThreshold = Math.max(6, medianHeight * 0.75);

  const cells: string[] = [];
  let current: string[] = [];
  let previous: { x0: number; x1: number } | null = null;
  for (const word of boxed) {
    if (previous) {
      const gap = leftToRight ? word.bbox.x0 - previous.x1 : previous.x0 - word.bbox.x1;
      if (gap > gapThreshold && current.length > 0) {
        cells.push(current.join(" "));
        current = [];
      }
    }
    current.push(word.text);
    previous = { x0: word.bbox.x0, x1: word.bbox.x1 };
  }
  if (current.length > 0) cells.push(current.join(" "));
  return cells;
}

/**
 * Build the unified document understanding from OCR pages using real word
 * geometry. Rows are reconstructed with `ocrLineToCells`, and page provenance is
 * preserved so every fact still points at its page. The same section/measure
 * contract as PDF/XLSX/XLS is used; nothing is invented.
 */
export function buildFinancialDocumentUnderstandingFromOcrPages(
  pages: ReadonlyArray<OcrPageInput>,
): FinancialDocumentUnderstanding {
  const blocks: DocumentSectionInput[] = [];
  for (const page of pages) {
    const lines = (page.lines ?? []).filter(
      (line) => line && ((line.words?.length ?? 0) > 0 || String(line.text ?? "").trim().length > 0),
    );
    if (lines.length === 0) continue;
    blocks.push({
      rows: lines.map((line) => ocrLineToCells(line)),
      pageNumbers: lines.map(() => page.pageNumber),
    });
  }
  return buildFinancialDocumentUnderstanding(blocks);
}

export interface DocumentSectionInput {
  /** Section hint from a worksheet name; used only when no heading is found. */
  readonly name?: string;
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
  /** 1-based line offset of the first row inside the whole document. */
  readonly lineOffset?: number;
  /**
   * True when `rows` come from a spreadsheet grid whose columns are meaningful
   * (XLSX / XLS). False for freeform text (PDF / OCR) where values are read from
   * the trailing numeric run of each line.
   */
  readonly positioned?: boolean;
  /**
   * 1-based page number for each row, aligned by index. Only supplied when the
   * source is paged (PDF), so section page ranges come from real evidence.
   */
  readonly pageNumbers?: ReadonlyArray<number>;
}

interface DocumentLine {
  readonly text: string;
  readonly row: ReadonlyArray<string>;
  readonly line: number;
  readonly page?: number;
}

function buildLines(input: DocumentSectionInput, startLine: number): DocumentLine[] {
  return input.rows.map((row, index) => {
    const page = input.pageNumbers?.[index];
    return {
      text: joinRowText(row.length > 0 ? row : [""]),
      row,
      line: startLine + index,
      ...(typeof page === "number" ? { page } : {}),
    };
  });
}

function segmentByHeadings(lines: ReadonlyArray<DocumentLine>, nameHint?: string): Array<{ type: FinancialSectionType; lines: DocumentLine[] }> {
  const segments: Array<{ type: FinancialSectionType; lines: DocumentLine[] }> = [];
  const hintType = nameHint ? matchFinancialSectionHeading(nameHint) : null;
  let current: { type: FinancialSectionType; lines: DocumentLine[] } = { type: "UNKNOWN", lines: [] };

  for (const line of lines) {
    const heading = matchFinancialSectionHeading(line.text);
    if (heading && heading !== current.type && current.lines.length > 0) {
      segments.push(current);
      current = { type: heading, lines: [line] };
    } else if (heading && current.lines.length === 0) {
      current = { type: heading, lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0) segments.push(current);

  // A worksheet whose name identifies a section but whose rows carry no heading
  // is still that section; never leave it UNKNOWN when the name is evidenced.
  if (hintType) {
    for (const segment of segments) {
      if (segment.type === "UNKNOWN") segment.type = hintType;
    }
  }
  return segments.filter((segment) => segment.type !== "UNKNOWN" || segment.lines.length > 0);
}

/* ------------------------------------------------------------------------- *
 * Product / segment revenue table extraction
 * ------------------------------------------------------------------------- */

/** Metric columns of a per-product revenue-and-cost table, in canonical order. */
const PRODUCT_METRIC_MATCHERS: ReadonlyArray<readonly [RegExp, keyof ProductSegmentPeriodValue]> = [
  [/تعدادتولید/, "quantityProduced"],
  [/تعدادفروش/, "quantitySold"],
  [/نرخفروش/, "unitPrice"],
  [/مبلغفروش/, "revenue"],
  [/مبلغبهایتمامشده/, "cost"],
  [/سودناخالص/, "grossProfit"],
];

function productMetricFor(cell: string): keyof ProductSegmentPeriodValue | null {
  const key = matchKey(cell);
  if (!key) return null;
  for (const [pattern, metric] of PRODUCT_METRIC_MATCHERS) {
    if (pattern.test(key)) return metric;
  }
  return null;
}

/** A year printed in a period header cell (e.g. "سال مالی منتهی به ۱۴۰۴/۰۴/۳۱"). */
function yearInCell(cell: string): number | null {
  const ascii = toAsciiDigits(String(cell ?? ""));
  const match = ascii.match(/\b(1[34]\d{2})\b/);
  return match ? Number(match[1]) : null;
}

type ProductPeriodKind = "current" | "prior" | "other";

function relativePeriodKind(cell: string): ProductPeriodKind | null {
  const key = matchKey(cell);
  if (!key) return null;
  if (/دورهجاری|سالجاری|جاری|current|currentyear/.test(key)) return "current";
  if (/دورهقبل|سالقبل|قبل|prior|previous|comparative/.test(key)) return "prior";
  return null;
}

const PRODUCT_SECTION_MARKERS = [/^فروشداخلی/, /^فروشصادراتی/, /^درآمدارائهخدمات/, /^سایر/, /^نوعکالا/, /^شرحکالا/, /^شرح$/];

/**
 * Extract per-product/segment revenue, COGS, gross profit, quantity and unit
 * price from a document's operating-revenue-and-cost table. Only a table whose
 * header row declares a product column together with `مبلغ فروش` and
 * `سود ناخالص` is accepted; the two most recent period years (or explicit
 * current/prior labels) are mapped to the current and prior slots. Nothing is
 * inferred from company totals: a row is kept only when it carries its own
 * revenue evidence for the current period.
 */
function extractProductSegments(
  blocks: ReadonlyArray<DocumentSectionInput>,
  unit: StatementUnitDeclaration,
): ProductSegment[] {
  const segments: ProductSegment[] = [];
  const seenNames = new Set<string>();
  const multiplier = unit.multiplier > 0 ? unit.multiplier : 1;

  for (const block of blocks) {
    const rows = block.rows;
    let headerIndex = -1;
    for (let r = 0; r < rows.length; r += 1) {
      const keys = rows[r].map((cell) => matchKey(cell));
      const hasProduct = keys.some((key) => key.includes("نوعکالا") || key.includes("شرحکالا") || key.includes("شرح محصول".replace(/\s/g, "")));
      const hasRevenue = keys.some((key) => key.includes("مبلغفروش"));
      const hasGrossProfit = keys.some((key) => key.includes("سودناخالص"));
      if (hasProduct && hasRevenue && hasGrossProfit) {
        headerIndex = r;
        break;
      }
    }
    if (headerIndex < 0) continue;

    const headerCells = rows[headerIndex];
    const metricColumns: Array<{ column: number; metric: keyof ProductSegmentPeriodValue; year: number | null; relative: ProductPeriodKind | null }> = [];
    const years: number[] = [];
    for (let c = 1; c < headerCells.length; c += 1) {
      const metric = productMetricFor(headerCells[c]);
      if (!metric) continue;
      let year: number | null = null;
      let relative: ProductPeriodKind | null = null;
      for (let rr = headerIndex - 1; rr >= Math.max(0, headerIndex - 4); rr -= 1) {
        const cell = rows[rr]?.[c] ?? "";
        // An estimate/forecast period ("برآورد ... ۱۴۰۶") is never a historical
        // current/prior period: it must not become the current-period mapping.
        // (Note: label normalization folds the alef-madda so "برآورد" -> "براورد".)
        if (/برآورد|براورد|پیشبینی|پیشبینی|estimate|forecast/.test(matchKey(cell))) {
          relative = "other";
          break;
        }
        const found = yearInCell(cell);
        if (found !== null) {
          year = found;
          if (!years.includes(found)) years.push(found);
          break;
        }
        const rel = relativePeriodKind(cell);
        if (rel) {
          relative = rel;
          break;
        }
      }
      metricColumns.push({ column: c, metric, year, relative });
    }

    const sortedYears = [...years].sort((a, b) => b - a);
    const currentYear = sortedYears[0] ?? null;
    const priorYear = sortedYears[1] ?? null;
    const kindOf = (entry: { year: number | null; relative: ProductPeriodKind | null }): ProductPeriodKind => {
      if (entry.relative) return entry.relative;
      if (entry.year !== null && currentYear !== null && entry.year === currentYear) return "current";
      if (entry.year !== null && priorYear !== null && entry.year === priorYear) return "prior";
      return "other";
    };

    const collectPeriod = (period: ProductPeriodKind, row: ReadonlyArray<string>): ProductSegmentPeriodValue | null => {
      const raw: Partial<Record<keyof ProductSegmentPeriodValue, number | null>> = {};
      for (const entry of metricColumns) {
        if (kindOf(entry) !== period) continue;
        raw[entry.metric] = valueFromCell(row[entry.column]);
      }
      const revenueRaw = raw.revenue;
      if (revenueRaw === null || revenueRaw === undefined) return null;
      const scale = (value: number | null | undefined, signed = true): number | null => {
        if (value === null || value === undefined) return null;
        return (signed ? value : Math.abs(value)) * multiplier;
      };
      return {
        quantityProduced: raw.quantityProduced ?? null,
        quantitySold: raw.quantitySold ?? null,
        unitPrice: raw.unitPrice ?? null,
        revenue: revenueRaw * multiplier,
        cost: scale(raw.cost, false),
        grossProfit: scale(raw.grossProfit, true),
      };
    };

    for (let r = headerIndex + 1; r < rows.length; r += 1) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const firstKey = matchKey(row[0] ?? "");
      if (!firstKey) continue;
      if (firstKey.startsWith("جمع")) break;
      if (PRODUCT_SECTION_MARKERS.some((pattern) => pattern.test(firstKey))) continue;
      const unitCell = String(row[1] ?? "").trim();
      if (!unitCell) continue;
      const name = String(row[0] ?? "").trim();
      if (!name || seenNames.has(name)) continue;

      const current = collectPeriod("current", row);
      if (!current) continue;
      const prior = collectPeriod("prior", row);
      const hasActivity = current.revenue !== 0 || (prior?.revenue ?? 0) !== 0 || current.quantitySold !== null || (current.cost ?? 0) !== 0;
      if (!hasActivity) continue;

      seenNames.add(name);
      segments.push({
        name,
        unit: unitCell,
        current,
        prior,
        confidence: 1,
        evidence: {
          line: (block.lineOffset ?? 1) + r + 1,
          text: joinRowText(row),
          ...(typeof block.pageNumbers?.[r] === "number" ? { page: block.pageNumbers[r] as number } : {}),
        },
      });
    }
    // One product revenue table per document; later duplicate tables (estimates
    // or recaps) are intentionally not merged to avoid double counting.
    if (segments.length > 0) break;
  }

  return segments;
}

/** Exposed for tests and for callers that build a document by hand. */
export function extractProductSegmentsFromBlocks(blocks: ReadonlyArray<DocumentSectionInput>): ProductSegment[] {
  const documentText = blocks.flatMap((block) => block.rows.map((row) => row.join(" "))).join("\n");
  return extractProductSegments(blocks, detectStatementUnit(documentText));
}


/**
 * Build the unified document understanding from one or more blocks (PDF pages
 * or worksheets). The same boundary is used for every source so PDF, XLSX and
 * XLS cannot diverge.
 */
export function buildFinancialDocumentUnderstanding(blocks: ReadonlyArray<DocumentSectionInput>): FinancialDocumentUnderstanding {
  const sections: FinancialDocumentSection[] = [];
  const allFacts: FinancialStatementFact[] = [];
  const documentText = blocks
    .flatMap((block) => block.rows.map((row) => row.join(" ")))
    .join("\n");
  const documentUnit = detectStatementUnit(documentText);

  let cursor = 1;
  for (const block of blocks) {
    const blockUnit = detectStatementUnit(block.rows.map((row) => row.join(" ")).join("\n"));
    const unit: StatementUnitDeclaration = {
      multiplier: blockUnit.multiplier !== 1 || documentUnit.multiplier === 1 ? blockUnit.multiplier : documentUnit.multiplier,
      currency: blockUnit.currency ?? documentUnit.currency,
    };
    const lines = buildLines(block, block.lineOffset ?? cursor);
    cursor = (block.lineOffset ?? cursor) + block.rows.length;
    if (lines.length === 0) continue;

    for (const segment of segmentByHeadings(lines, block.name)) {
      // An UNKNOWN run is text that is not one of the canonical sections (cover
      // pages, disclaimers, non-financial tables). It owns no canonical measure,
      // so it is not surfaced as a section at all; keeping it would inflate the
      // section list with meaningless FAILED entries.
      if (segment.type === "UNKNOWN") continue;
      const rows = segment.lines.map((line) => line.row);
      const { facts, notes } = extractSectionFacts(
        rows,
        segment.type,
        unit,
        segment.lines[0].line - 1,
        block.positioned === true,
        segment.lines.map((line) => line.page),
      );
      const { state, failureCode } = sectionState(segment.type, facts, rows.length);
      const pages = segment.lines.map((line) => line.page).filter((page): page is number => typeof page === "number");
      sections.push({
        type: segment.type,
        state,
        startLine: segment.lines[0].line,
        endLine: segment.lines[segment.lines.length - 1].line,
        ...(pages.length > 0 ? { pageStart: Math.min(...pages), pageEnd: Math.max(...pages) } : {}),
        facts,
        notes: notes.filter((note, index, array) => array.indexOf(note) === index),
        ...(failureCode ? { failureCode } : {}),
      });
      allFacts.push(...facts);
    }
  }

  const statementSections = sections.filter((section) => !NARRATIVE_SECTIONS.has(section.type) && section.type !== "UNKNOWN");
  const narrativeContent = sections.some((section) => NARRATIVE_SECTIONS.has(section.type) && section.state === "COMPLETED");

  let status: FinancialDocumentStatus;
  if (allFacts.length === 0 && !narrativeContent) status = "FAILED";
  else if (allFacts.length === 0) status = "PARTIAL";
  else if (statementSections.some((section) => section.state !== "COMPLETED")) status = "PARTIAL";
  else status = "COMPLETED";

  return {
    status,
    currency: documentUnit.currency,
    unitMultiplier: documentUnit.multiplier,
    sections,
    facts: allFacts,
    segments: extractProductSegments(blocks, documentUnit),
  };
}

/* ------------------------------------------------------------------------- *
 * Derived views for the existing analysis/analytics owners
 * ------------------------------------------------------------------------- */

export interface DerivedAnalysisInput {
  readonly revenue: number;
  /**
   * Operating-type expenses (EXPENSES, else OPERATING_EXPENSES) used by the
   * vertical analysis. Kept unchanged for backward compatibility.
   */
  readonly expenses: number;
  /**
   * DERIVED RESIDUAL expense used to reconcile revenue to net profit
   * (`revenue - netProfit`) when both are evidence-backed, so the existing
   * analysis contract's `profit = revenue - expenses` equals the statement's
   * real net profit. It is NOT an extracted accounting total: it bundles COGS,
   * operating expenses, finance cost, tax and non-operating items. Null when
   * the statement's net profit or revenue evidence is absent.
   */
  readonly analysisExpenses: number | null;
  /**
   * Provenance of `analysisExpenses` for honest evidence labelling. It is always
   * `"DERIVED_RESIDUAL"` when present, or null when no residual could be
   * derived. Extracted COGS / operating expenses remain authoritative for the
   * component-level metrics on `statement`.
   */
  readonly analysisExpensesSource: "DERIVED_RESIDUAL" | null;
  readonly assets: number;
  readonly liabilities: number;
  readonly equity: number;
  /** Partial statement for the existing ratio analytics; missing keys are absent. */
  readonly statement: Partial<RatioStatement>;
  /** Explicit derivation notes (which measures were absent). */
  readonly missingMeasures: ReadonlyArray<StatementMeasure>;
}

function valueAtPeriod(
  facts: ReadonlyArray<FinancialStatementFact>,
  measure: StatementMeasure,
  periodIndex: number,
): number | null {
  const matches = facts.filter((fact) => fact.measure === measure);
  if (matches.length === 0) return null;
  const atPeriod = matches.find((fact) => fact.periodIndex === periodIndex);
  if (atPeriod) return atPeriod.value;
  // Period index 0 is the current period in every supported layout; only the
  // current period may fall back to the first extracted value.
  return periodIndex === 0 ? matches[0].value : null;
}

function latestValue(facts: ReadonlyArray<FinancialStatementFact>, measure: StatementMeasure): number | null {
  return valueAtPeriod(facts, measure, 0);
}

/**
 * Statement cost measures are printed with a negative sign in many real Persian
 * statements (`هزینه های ... (۲۹۱,۶۳۴)`) while the analysis contract consumes a
 * positive cost magnitude. Normalize the sign without changing the extracted
 * evidence (the raw signed value stays on the fact).
 */
function costMagnitude(value: number | null): number | null {
  return value === null ? null : Math.abs(value);
}

/**
 * Build the existing ratio-statement view for one reporting period from
 * canonical facts. Only measures actually extracted for that period are set;
 * nothing is padded with fabricated zeros.
 */
function statementForPeriod(
  facts: ReadonlyArray<FinancialStatementFact>,
  periodIndex: number,
): Partial<RatioStatement> {
  const statement: Partial<RatioStatement> = {};
  const set = (field: keyof RatioStatement, measure: StatementMeasure, magnitude = false): void => {
    const value = valueAtPeriod(facts, measure, periodIndex);
    const normalized = magnitude ? costMagnitude(value) : value;
    if (normalized !== null) (statement as Record<string, number>)[field] = normalized;
  };
  set("revenue", "REVENUE");
  set("cogs", "COGS", true);
  set("grossProfit", "GROSS_PROFIT");
  set("operatingExpenses", "OPERATING_EXPENSES", true);
  set("operatingIncome", "OPERATING_PROFIT");
  set("interest", "INTEREST", true);
  set("preTaxIncome", "PRE_TAX_INCOME");
  set("taxes", "TAX", true);
  set("netIncome", "NET_PROFIT");
  set("cash", "CASH");
  set("receivables", "RECEIVABLES");
  set("inventory", "INVENTORY");
  set("currentAssets", "CURRENT_ASSETS");
  set("ppe", "PPE");
  set("totalAssets", "ASSETS");
  set("payables", "PAYABLES");
  set("shortTermDebt", "SHORT_TERM_DEBT");
  set("currentLiabilities", "CURRENT_LIABILITIES");
  set("longTermDebt", "LONG_TERM_DEBT");
  set("totalLiabilities", "LIABILITIES");
  set("equity", "EQUITY");
  return statement;
}

/**
 * Derive the existing analysis inputs from canonical statement facts. Only
 * measures that were actually extracted are used; nothing is invented and the
 * absent measures are reported so a downstream engine can fail closed honestly.
 */
export function deriveAnalysisInput(document: FinancialDocumentUnderstanding): DerivedAnalysisInput {
  const facts = document.facts;
  const assets = latestValue(facts, "ASSETS");
  const liabilities = latestValue(facts, "LIABILITIES");
  const equity = latestValue(facts, "EQUITY");
  const revenue = latestValue(facts, "REVENUE");
  const expenses = costMagnitude(latestValue(facts, "EXPENSES") ?? latestValue(facts, "OPERATING_EXPENSES"));
  const netProfit = latestValue(facts, "NET_PROFIT");

  const statement = statementForPeriod(facts, 0);

  // The residual is kept even when negative (net profit above revenue is
  // possible through non-operating income) so that the analysis contract's
  // `profit = revenue - expenses` still equals the statement's verified net
  // profit. It is disclosed as a derived residual, never as a total expense.
  const analysisExpenses = revenue !== null && netProfit !== null ? revenue - netProfit : null;

  const missing: StatementMeasure[] = [];
  if (assets === null) missing.push("ASSETS");
  if (liabilities === null) missing.push("LIABILITIES");
  if (revenue === null) missing.push("REVENUE");
  if (expenses === null) missing.push("EXPENSES");

  return {
    revenue: revenue ?? 0,
    expenses: expenses ?? 0,
    analysisExpenses,
    analysisExpensesSource: analysisExpenses !== null ? "DERIVED_RESIDUAL" : null,
    assets: assets ?? 0,
    liabilities: liabilities ?? 0,
    equity: equity ?? 0,
    statement,
    missingMeasures: missing,
  };
}

/**
 * Derive the prior-period statement (period index 1) for horizontal analysis.
 * Returns an empty object when no prior-period evidence exists, so the existing
 * `RatioAnalysisService.horizontal` reports BLOCKED rather than comparing
 * against fabricated values.
 */
export function derivePriorStatement(document: FinancialDocumentUnderstanding): Partial<RatioStatement> {
  return statementForPeriod(document.facts, 1);
}

/**
 * Measures the existing statement analysis contract consumes directly. A
 * report analysis must not return READY unless every one of these was derived
 * from real evidence for the CURRENT period.
 */
const ANALYSIS_REQUIRED_MEASURES: ReadonlyArray<StatementMeasure> = [
  "ASSETS",
  "LIABILITIES",
  "REVENUE",
];

/** Sections whose completeness the statement analysis contract depends on. */
const ANALYSIS_REQUIRED_SECTIONS: ReadonlyArray<FinancialSectionType> = [
  "BALANCE_SHEET",
  "INCOME_STATEMENT",
];

export interface StatementAnalysisReadiness {
  /** True only when the required measures and sections were really extracted. */
  readonly ready: boolean;
  readonly missingMeasures: ReadonlyArray<StatementMeasure>;
  readonly incompleteSections: ReadonlyArray<FinancialSectionType>;
  /** Precise typed code when not ready (financial-report-insufficient-evidence). */
  readonly code?: string;
  /** Short, non-fabricated explanation of what evidence is missing. */
  readonly reason: string;
}

/**
 * Fail-closed sufficiency gate for statement analysis. A PARTIAL/insufficient
 * document must never be analyzed as if it were complete: the balance sheet and
 * income statement sections must be COMPLETED and the current-period assets,
 * liabilities and revenue the analysis contract consumes must be evidence-backed.
 * A partial document (for example a scanned report with two readable facts) stays
 * BLOCKED with `financial-report-insufficient-evidence` instead of returning a
 * READY analysis built from absent values. Ledger analysis is unaffected because
 * it does not call this gate.
 */
export function assessStatementAnalysisReadiness(document: FinancialDocumentUnderstanding): StatementAnalysisReadiness {
  const hasCurrent = (measure: StatementMeasure): boolean =>
    document.facts.some(
      (fact) => fact.measure === measure && fact.periodIndex === 0 && Number.isFinite(fact.value),
    );

  const missingMeasures: StatementMeasure[] = [];
  for (const measure of ANALYSIS_REQUIRED_MEASURES) {
    if (!hasCurrent(measure)) missingMeasures.push(measure);
  }

  const incompleteSections: FinancialSectionType[] = [];
  for (const type of ANALYSIS_REQUIRED_SECTIONS) {
    const section = document.sections.find((candidate) => candidate.type === type);
    if (!section || section.state !== "COMPLETED") incompleteSections.push(type);
  }

  const ready = missingMeasures.length === 0 && incompleteSections.length === 0;
  if (ready) {
    return { ready: true, missingMeasures: [], incompleteSections: [], reason: "required-statement-evidence-present" };
  }

  const parts: string[] = [];
  if (missingMeasures.length > 0) parts.push(`missing-measures:${missingMeasures.join(",")}`);
  if (incompleteSections.length > 0) parts.push(`incomplete-sections:${incompleteSections.join(",")}`);
  return {
    ready: false,
    missingMeasures,
    incompleteSections,
    code: FINANCIAL_DOCUMENT_ERROR_CODES.INSUFFICIENT_EVIDENCE,
    reason: parts.join(";"),
  };
}

export interface FinancialDocumentSummary {
  readonly status: FinancialDocumentStatus;
  readonly currency: string | null;
  readonly unitMultiplier: number;
  readonly sectionCount: number;
  readonly factCount: number;
  readonly sections: ReadonlyArray<{
    readonly type: FinancialSectionType;
    readonly state: FinancialSectionState;
    readonly factCount: number;
    readonly pageStart?: number;
    readonly pageEnd?: number;
    readonly failureCode?: string;
  }>;
}

/** Compact, truthful projection of the document for job/API responses. */
export function summarizeFinancialDocument(document: FinancialDocumentUnderstanding): FinancialDocumentSummary {
  return {
    status: document.status,
    currency: document.currency,
    unitMultiplier: document.unitMultiplier,
    sectionCount: document.sections.length,
    factCount: document.facts.length,
    sections: document.sections.map((section) => ({
      type: section.type,
      state: section.state,
      factCount: section.facts.length,
      ...(section.pageStart !== undefined ? { pageStart: section.pageStart } : {}),
      ...(section.pageEnd !== undefined ? { pageEnd: section.pageEnd } : {}),
      ...(section.failureCode ? { failureCode: section.failureCode } : {}),
    })),
  };
}

export function hasFinancialDocumentFacts(document: FinancialDocumentUnderstanding | undefined): boolean {
  return !!document && document.facts.length > 0;
}

/** Every numeric field the existing ratio analytics requires for a statement. */
const RATIO_STATEMENT_FIELDS: ReadonlyArray<keyof RatioStatement> = [
  "revenue", "cogs", "grossProfit", "operatingExpenses", "operatingIncome", "interest",
  "preTaxIncome", "taxes", "netIncome", "cash", "receivables", "inventory", "currentAssets",
  "ppe", "totalAssets", "payables", "shortTermDebt", "currentLiabilities", "longTermDebt",
  "totalLiabilities", "equity",
];

/**
 * Informational predicate: true only when every ratio-statement field was
 * actually derived from evidence. It is retained for callers that want to know
 * whether the derivation is complete, but it is NOT an analytics gate: the
 * existing ratio analytics computes each ratio from the evidence it has and
 * reports the rest as unavailable, so a partial statement is analyzed honestly
 * instead of being blocked as a whole.
 */
export function isCompleteRatioStatement(statement: Partial<RatioStatement>): boolean {
  return RATIO_STATEMENT_FIELDS.every(
    (field) => typeof (statement as Record<string, unknown>)[field] === "number",
  );
}
