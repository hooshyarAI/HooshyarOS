/**
 * Stage 08-DOC.4 — Document Table Extraction / Normalization.
 *
 * A pure supporting service that scans free-form document text (PDF text
 * layer or DOCX text) for tabular blocks, then attempts to map each block
 * to the canonical 5-column financial-transaction schema:
 *
 *   date | account | debit | credit | currency
 *
 * Ambiguous mappings (multiple candidate headers, partial matches, etc.)
 * surface `ingestion-ambiguous-table-mapping` so the caller can either
 * fall back to OCR + manual review or skip the block.
 *
 * This module is NOT a new Engine. It is a pure helper.
 */

export const TABLE_ERROR_CODES = {
  AMBIGUOUS: "ingestion-ambiguous-table-mapping",
  SCHEMA_INVALID: "ingestion-table-schema-invalid",
} as const;

export interface TableCandidate {
  /** zero-based offset into the source text where the block starts */
  readonly offset: number;
  /** number of header columns detected */
  readonly columnCount: number;
  /** raw rows (each row is an array of trimmed cells) */
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
  /** detected header tokens (lower-cased, trimmed) */
  readonly headers: ReadonlyArray<string>;
  /** confidence in [0,1] of header detection; 1 = exact match */
  readonly headerConfidence: number;
}

export interface CanonicalExpectedSchema {
  readonly headers: ReadonlyArray<string>;
}

export const CANONICAL_FINANCIAL_SCHEMA: CanonicalExpectedSchema = {
  headers: ["date", "account", "debit", "credit", "currency"],
};

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "transaction date", "posting date", "tx date", "value date", "تاریخ", "تاریخ تراکنش"],
  account: ["account", "account name", "description", "narration", "particulars", "details", "gl account", "ledger account", "شرح", "شرح تراکنش", "طرف حساب"],
  debit: ["debit", "dr", "withdrawal", "withdrawals", "amount debit", "بدهکار", "برداشت"],
  credit: ["credit", "cr", "deposit", "deposits", "amount credit", "بستانکار", "واریز"],
  currency: ["currency", "ccy", "curr", "ارز", "واحد پول"],
};

/**
 * Columns that legitimately appear in real financial statements but carry no
 * canonical transaction semantic. They are tolerated (ignored) by the
 * statement mapper and never silently mistaken for a canonical field.
 */
export const NON_CANONICAL_STATEMENT_HEADERS: ReadonlyArray<string> = [
  "balance", "running balance", "closing balance", "opening balance",
  "reference", "ref", "ref no", "reference no", "doc no", "document no",
  "type", "transaction type", "type of transaction", "serial", "no",
  "مانده", "مانده حساب", "شماره سند", "شماره", "نوع", "نوع تراکنش",
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
}

function splitCells(line: string): string[] {
  // Treat a run of 2+ spaces, OR a tab, OR a "|", as column delimiter.
  if (line.includes("|")) {
    return line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
  }
  if (line.includes("\t")) {
    return line.split("\t").map((c) => c.trim()).filter((c) => c.length > 0);
  }
  const parts = line.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
  return parts.length >= 2 ? parts : [line.trim()];
}

/**
 * Find table-like blocks in text. A "block" is a contiguous run of lines
 * that have at least 2 non-empty cells. Headers are the first row of the
 * block. Confidence is 1.0 when the header row matches a known alias set
 * for the canonical schema, otherwise 0.5.
 */
export function detectTables(text: string): TableCandidate[] {
  if (typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const candidates: TableCandidate[] = [];

  let blockStart = -1;
  let blockLines: string[] = [];
  const flush = (endIdx: number) => {
    if (blockLines.length >= 2) {
      const rows = blockLines.map(splitCells);
      const headerCount = rows[0].length;
      const consistent = rows.every((r) => r.length === headerCount);
      if (consistent && headerCount >= 2) {
        const headers = rows[0].map((h) => normalize(h));
        const conf = scoreHeaders(headers);
        candidates.push({
          offset: blockStart,
          columnCount: headerCount,
          rows,
          headers,
          headerConfidence: conf,
        });
      }
    }
    blockStart = -1;
    blockLines = [];
    void endIdx;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const cells = splitCells(lines[i]);
    if (cells.length >= 2) {
      if (blockStart === -1) blockStart = i;
      blockLines.push(lines[i]);
    } else {
      if (blockStart !== -1) flush(i);
    }
  }
  if (blockStart !== -1) flush(lines.length);

  return candidates;
}

function scoreHeaders(headers: string[]): number {
  const required = Object.keys(HEADER_ALIASES);
  const matched = required.filter((field) => {
    const aliases = HEADER_ALIASES[field];
    return headers.some((h) => aliases.some((a) => a === h));
  });
  return matched.length === required.length ? 1.0 : 0.5;
}

/**
 * Build a canonical `TableCandidate` from an already-separated grid of cells.
 * Used by non-text acquisition routes (DOCX tables, HTML tables, repeating XML
 * rows) so they converge on the SAME table-mapping contract as PDF/text tables
 * instead of each inventing its own mapper. Returns null when the grid cannot be
 * a rectangular table.
 */
export function buildTableCandidate(
  rows: ReadonlyArray<ReadonlyArray<string>>,
  offset = 0,
): TableCandidate | null {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const columnCount = rows[0].length;
  if (columnCount < 2) return null;
  if (!rows.every((row) => row.length === columnCount)) return null;
  const normalizedRows = rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
  const headers = normalizedRows[0].map((cell) => normalize(cell));
  return {
    offset,
    columnCount,
    rows: normalizedRows,
    headers,
    headerConfidence: scoreHeaders(headers),
  };
}

function matchHeaderIndex(headers: ReadonlyArray<string>, field: string): number {
  const aliases = HEADER_ALIASES[field];
  for (let i = 0; i < headers.length; i += 1) {
    if (aliases.some((a) => a === headers[i])) return i;
  }
  return -1;
}

function parseDate(value: string): string | null {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // accept DD/MM/YYYY or MM/DD/YYYY
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]); const y = Number(m[3]);
    // prefer DD/MM/YYYY if first part > 12
    if (a > 12) return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    if (b > 12) return `${y}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    // default to YYYY-MM-DD ordering by swapping to DD/MM (most non-US ledgers)
    return `${y}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }
  return null;
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[, ]/g, "").replace(/[()]/g, "-");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

export interface MappedTransaction {
  readonly date: string;
  readonly account: string;
  readonly debit: number;
  readonly credit: number;
  readonly currency: string;
}

/**
 * Map a table candidate to canonical financial transactions.
 * - Requires headerConfidence === 1.0 and exactly 5 columns matching the
 *   expected schema. Otherwise throws ingestion-ambiguous-table-mapping.
 */
export function mapTableToCanonical(
  table: TableCandidate,
  expected: CanonicalExpectedSchema = CANONICAL_FINANCIAL_SCHEMA,
): MappedTransaction[] {
  if (table.headers.length !== expected.headers.length) {
    throw new Error(TABLE_ERROR_CODES.AMBIGUOUS);
  }
  const expectedNorm = expected.headers.map(normalize);
  // Match each expected header to the table header position
  const positions: Record<string, number> = {};
  for (const field of Object.keys(HEADER_ALIASES)) {
    const idx = matchHeaderIndex(table.headers, field);
    if (idx === -1) {
      throw new Error(TABLE_ERROR_CODES.AMBIGUOUS);
    }
    positions[field] = idx;
  }
  // Verify ordering flexibility: we accept any column order but require all fields
  for (let i = 0; i < expectedNorm.length; i += 1) {
    const expectedField = expectedNorm[i];
    const aliases = HEADER_ALIASES[expectedField] ?? [expectedField];
    const actual = table.headers[positions[expectedField]];
    if (!aliases.some((a) => a === actual)) {
      throw new Error(TABLE_ERROR_CODES.AMBIGUOUS);
    }
  }

  const transactions: MappedTransaction[] = [];
  for (let r = 1; r < table.rows.length; r += 1) {
    const row = table.rows[r];
    const dateCell = row[positions.date] ?? "";
    const accountCell = row[positions.account] ?? "";
    const debitCell = row[positions.debit] ?? "";
    const creditCell = row[positions.credit] ?? "";
    const currencyCell = row[positions.currency] ?? "";

    const date = parseDate(dateCell);
    if (!date) throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:date:${r}`);
    if (!accountCell.trim()) throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:account:${r}`);
    if (!currencyCell.trim()) throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:currency:${r}`);

    const debit = parseAmount(debitCell) ?? 0;
    const credit = parseAmount(creditCell) ?? 0;
    if (debit === 0 && credit === 0) {
      throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:zero-row:${r}`);
    }
    if (debit > 0 && credit > 0) {
      throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:double-sided-row:${r}`);
    }
    transactions.push({ date, account: accountCell.trim(), debit, credit, currency: currencyCell.trim() });
  }
  return transactions;
}

/* ------------------------------------------------------------------------- *
 * Stage 15-DOC.5 — Realistic financial-statement normalization.
 *
 * Real scanned statements (bank/ledger statements produced by OCR) rarely
 * match the synthetic 5-column ledger CSV. They carry extra columns
 * (balance/reference), alternative header labels (description/narration),
 * partial amount columns and a document-level currency declaration. The
 * helpers below extend the SAME canonical table boundary to those layouts
 * without inventing a second financial model.
 *
 * Safety: only columns that map unambiguously to a canonical field are used;
 * a duplicated or missing required field, an unparseable amount, a row without
 * a single signed amount, or an undeclared currency all fail closed with a
 * precise typed error. Unmapped columns are ignored, never guessed.
 * ------------------------------------------------------------------------- */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * Arabic letter variants that Persian financial documents mix freely
 * (`ي`/`ی`, `ك`/`ک`, `ة`/`ه`, `أ`/`ا`). OCR output and real spreadsheets use
 * both forms, so every deterministic match (unit words, section titles, measure
 * labels) must converge on ONE canonical spelling before comparison. Without
 * this, `ميليون ريال` (Arabic yeh) never matched the `میلیون ریال` unit phrase
 * and a narrative `میلیارد` elsewhere silently became the document unit.
 */
const ARABIC_TO_PERSIAN_LETTERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[\u064a\u0649]/g, "ی"],
  [/[\u0643]/g, "ک"],
  [/[\u0629]/g, "ه"],
  [/[\u0623\u0625\u0622\u0671]/g, "ا"],
];

/** Normalize Arabic/Persian letter variants to their canonical Persian form. */
export function normalizePersianLetters(value: string): string {
  let out = typeof value === "string" ? value : "";
  for (const [pattern, replacement] of ARABIC_TO_PERSIAN_LETTERS) out = out.replace(pattern, replacement);
  return out;
}

/** Remove zero-width joiners/marks that make visually identical labels differ. */
export function stripZeroWidth(value: string): string {
  return typeof value === "string" ? value.replace(/[\u200c\u200e\u200f]/g, " ") : "";
}

/**
 * A header cell that is a percentage/change column ("درصد تغییر", "% change",
 * "percentage change", "growth"). Such a column is NOT a monetary period and
 * must never be normalized as one.
 */
const CHANGE_COLUMN_HEADER_RE = /(%|درصد\s*تغيير|درصد\s*تغییر|تغيير\s*درصد|تغییر\s*درصد|percentage|percent|change|growth|رشد)/i;

export function isChangeColumnHeader(cell: string): boolean {
  if (typeof cell !== "string") return false;
  const normalized = stripZeroWidth(normalizePersianLetters(toAsciiDigits(cell)));
  if (!normalized.trim()) return false;
  return CHANGE_COLUMN_HEADER_RE.test(normalized);
}

function isFourDigitYear(digits: string): boolean {
  if (!/^\d{4}$/.test(digits)) return false;
  const year = Number(digits);
  return (year >= 1300 && year <= 1500) || (year >= 1900 && year <= 2100);
}

/**
 * A comparative-statement column header such as `دوره منتهی به ۱۴۰۵/۰۴/۳۱`,
 * `به تاریخ ۱۴۰۴/۰۴/۳۱` or `سال مالی ۱۴۰۲`. It carries a real Jalali/Gregorian
 * year, which is the deterministic evidence that the column is a monetary
 * period. Used to locate statement grids from real Persian headers.
 */
export function isStatementPeriodHeader(cell: string): boolean {
  if (typeof cell !== "string") return false;
  const normalized = stripZeroWidth(normalizePersianLetters(toAsciiDigits(cell)));
  if (!normalized.trim()) return false;
  for (const token of normalized.match(/\d{4}/g) ?? []) {
    if (isFourDigitYear(token)) return true;
  }
  return false;
}

/** True when the cell is a bare four-digit year (`1402`, `2024`). */
export function isYearHeaderCell(cell: string): boolean {
  const digits = toAsciiDigits(String(cell ?? "")).replace(/[^\d]/g, "");
  return isFourDigitYear(digits);
}

export function toAsciiDigits(value: string): string {
  let out = "";
  for (const char of value) {
    const persian = PERSIAN_DIGITS.indexOf(char);
    if (persian !== -1) { out += String(persian); continue; }
    const arabic = ARABIC_INDIC_DIGITS.indexOf(char);
    if (arabic !== -1) { out += String(arabic); continue; }
    out += char;
  }
  return out;
}

/**
 * Parse a statement amount cell. Blank and dash-only cells are a real zero.
 * Thousands separators, Persian/Arabic-Indic digits and parenthesised
 * negatives are handled. Anything else returns null so the caller can fail
 * closed with the precise `ingestion-table-schema-invalid` error.
 * Negative magnitudes are rejected by the mapper (the canonical model stores
 * positive debit/credit magnitudes) rather than being silently re-signed.
 */
export function parseStatementAmount(value: string): number | null {
  if (typeof value !== "string") return null;
  let v = toAsciiDigits(value).replace(/[\u00a0\u200f\u200e\u200c]/g, " ").trim();
  if (!v) return 0;
  if (/^[-–—−]+$/.test(v)) return 0;
  let negative = false;
  const paren = v.match(/^\((.*)\)$/);
  if (paren) { negative = true; v = paren[1]; }
  // Arabic decimal separator -> ".", Arabic/Persian thousands separators -> "".
  v = v.replace(/٫/g, ".").replace(/[,٬،\s]/g, "").replace(/[ریاليا$€£]/g, "");
  if (v.startsWith("-") || v.startsWith("−")) { negative = true; v = v.slice(1); }
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * A header row is a canonical statement header when it declares a date, an
 * account/description and at least one of debit/credit. Currency may come from
 * the row itself or from a document-level declaration.
 */
export function isCanonicalStatementHeader(headers: ReadonlyArray<string>): boolean {
  const has = (field: string): boolean => matchHeaderIndex(headers, field) !== -1;
  return has("date") && has("account") && (has("debit") || has("credit"));
}

/**
 * Find statement table blocks tolerantly: a block starts at a canonical
 * statement header and continues while lines split into at least two cells.
 * Ragged rows (common after OCR) are padded/truncated to the header width;
 * they are never re-ordered, so a mis-detected layout stays visible as a row
 * error instead of being silently reshaped.
 */
export function detectStatementTables(text: string): TableCandidate[] {
  if (typeof text !== "string") return [];
  const rawLines = text.split(/\r?\n/).map((line) => line.replace(/\u00a0/g, " ").replace(/\s+$/g, ""));
  const candidates: TableCandidate[] = [];
  let i = 0;
  while (i < rawLines.length) {
    const headerLine = rawLines[i].trim();
    if (!headerLine) { i += 1; continue; }
    const headerCells = splitCells(headerLine);
    const normalizedHeader = headerCells.map((cell) => normalize(cell));
    if (headerCells.length < 2 || !isCanonicalStatementHeader(normalizedHeader)) { i += 1; continue; }

    const width = headerCells.length;
    const rows: string[][] = [headerCells.map((cell) => cell.trim())];
    let j = i + 1;
    while (j < rawLines.length) {
      const line = rawLines[j].trim();
      if (!line) break;
      const cells = splitCells(line);
      if (cells.length < 2) break;
      const padded = cells.slice(0, width).map((cell) => cell.trim());
      while (padded.length < width) padded.push("");
      rows.push(padded);
      j += 1;
    }

    if (rows.length >= 2) {
      candidates.push({
        offset: i,
        columnCount: width,
        rows,
        headers: normalizedHeader,
        headerConfidence: scoreHeaders(normalizedHeader),
      });
    }
    i = j > i ? j : i + 1;
  }
  return candidates;
}

/**
 * Columns that behave numerically in a statement (amounts and balances). Used
 * by the OCR-tolerant detector to identify the trailing numeric block.
 */
const NUMERIC_HEADER_ALIASES = new Set<string>([
  ...HEADER_ALIASES.debit,
  ...HEADER_ALIASES.credit,
  "balance", "running balance", "closing balance", "opening balance",
  "amount", "value", "مبلغ", "مانده",
]);

function isNumericHeaderToken(token: string): boolean {
  return NUMERIC_HEADER_ALIASES.has(token);
}

/**
 * OCR-tolerant statement detection.
 *
 * Real OCR collapses column spacing to single spaces, which destroys the
 * positional grid `detectStatementTables` relies on. This detector rebuilds the
 * SAME `TableCandidate` grid from single-space OCR lines using structure that
 * OCR does preserve:
 *   - a header line whose trailing columns are numeric (debit/credit/balance);
 *   - each data row begins with a parseable date;
 *   - each data row ends with exactly the header's numeric columns;
 *   - the account/description is the free text between them (multi-word safe).
 *
 * A line that does not fit this shape ends the block (footers/totals are not
 * silently absorbed), and the reconstructed grid is then mapped by the same
 * `mapStatementToCanonical` contract.
 */
export function detectOcrStatementTables(text: string): TableCandidate[] {
  if (typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\u00a0/g, " ").trim()).filter((line) => line.length > 0);
  const candidates: TableCandidate[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const headerTokens = lines[i].split(/\s+/);
    if (headerTokens.length < 2) continue;
    const headers = headerTokens.map((token) => normalize(token));
    if (!isCanonicalStatementHeader(headers)) continue;

    const numericIdx: number[] = [];
    for (let j = 0; j < headers.length; j += 1) if (isNumericHeaderToken(headers[j])) numericIdx.push(j);
    if (numericIdx.length === 0) continue;
    const contiguous = numericIdx.every((idx, k) => k === 0 || idx === numericIdx[k - 1] + 1);
    const isSuffix = numericIdx[numericIdx.length - 1] === headers.length - 1;
    if (!contiguous || !isSuffix) continue;
    const hasAmountField = numericIdx.some((j) =>
      matchHeaderIndex([headers[j]], "debit") !== -1 || matchHeaderIndex([headers[j]], "credit") !== -1);
    if (!hasAmountField) continue;

    const dateIdx = matchHeaderIndex(headers, "date");
    const accountIdx = matchHeaderIndex(headers, "account");
    const numericCount = numericIdx.length;
    const rows: string[][] = [headerTokens.slice()];
    let j = i + 1;
    while (j < lines.length) {
      const tokens = lines[j].split(/\s+/);
      if (tokens.length < numericCount + 2) break;
      const tail = tokens.slice(tokens.length - numericCount);
      if (!tail.every((token) => parseStatementAmount(token) !== null)) break;

      let dateTokenIdx = -1;
      const searchLimit = Math.min(tokens.length - numericCount, 4);
      for (let k = 0; k < searchLimit; k += 1) {
        if (parseDate(tokens[k]) !== null) { dateTokenIdx = k; break; }
      }
      if (dateTokenIdx === -1) break;

      const aligned: string[] = new Array(headers.length).fill("");
      aligned[dateIdx] = tokens[dateTokenIdx];
      if (accountIdx !== -1) {
        aligned[accountIdx] = tokens.slice(dateTokenIdx + 1, tokens.length - numericCount).join(" ").trim();
      }
      for (let k = 0; k < numericCount; k += 1) aligned[numericIdx[k]] = tail[k];
      rows.push(aligned);
      j += 1;
    }

    if (rows.length >= 2) {
      candidates.push({
        offset: i,
        columnCount: headers.length,
        rows,
        headers,
        headerConfidence: scoreHeaders(headers),
      });
    }
    i = j - 1;
  }
  return candidates;
}

/**
 * Declared document-level currency (e.g. "Currency: IRR", "ارز: IRR"). Only an
 * explicit declaration is accepted; an arbitrary three-letter token elsewhere
 * in the document is never inferred as a currency.
 */
const CURRENCY_DECLARATION = /(?:(?:\b(?:currency|ccy|curr)\b)|(?:ارز|واحد\s*پول))\s*[:：=]?\s*([A-Za-z]{3})\b/i;


export function extractDeclaredCurrency(text: string): string | null {
  if (typeof text !== "string") return null;
  const match = text.match(CURRENCY_DECLARATION);
  if (!match) return null;
  const code = match[1].toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export interface StatementMappingOptions {
  /** Currency applied only when the table declares no currency column. */
  readonly defaultCurrency?: string;
}

function findUniqueHeaderIndex(headers: ReadonlyArray<string>, field: string): number {
  const aliases = HEADER_ALIASES[field];
  let found = -1;
  for (let i = 0; i < headers.length; i += 1) {
    if (!aliases.some((a) => a === headers[i])) continue;
    if (found !== -1) throw new Error(TABLE_ERROR_CODES.AMBIGUOUS);
    found = i;
  }
  return found;
}

function requireStatementAmount(cell: string | undefined, row: number, field: string): number {
  const value = parseStatementAmount(cell ?? "");
  if (value === null || value < 0) {
    throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:${field}:${row}`);
  }
  return value;
}

/**
 * Map a realistic statement table to canonical transactions. Requires a unique
 * date and account column, at least one amount column, and a currency from the
 * table or a declared document-level default. Extra non-canonical columns
 * (balance, reference, ...) are ignored. Any ambiguity or unsafe row fails
 * closed with `ingestion-ambiguous-table-mapping` or
 * `ingestion-table-schema-invalid`.
 */
export function mapStatementToCanonical(
  table: TableCandidate,
  options: StatementMappingOptions = {},
): MappedTransaction[] {
  const dateIdx = findUniqueHeaderIndex(table.headers, "date");
  const accountIdx = findUniqueHeaderIndex(table.headers, "account");
  const debitIdx = findUniqueHeaderIndex(table.headers, "debit");
  const creditIdx = findUniqueHeaderIndex(table.headers, "credit");
  const currencyIdx = findUniqueHeaderIndex(table.headers, "currency");

  if (dateIdx === -1 || accountIdx === -1) throw new Error(TABLE_ERROR_CODES.AMBIGUOUS);
  if (debitIdx === -1 && creditIdx === -1) throw new Error(TABLE_ERROR_CODES.AMBIGUOUS);

  const declaredCurrency = options.defaultCurrency?.trim() ?? "";
  if (currencyIdx === -1 && !declaredCurrency) throw new Error(TABLE_ERROR_CODES.AMBIGUOUS);

  const transactions: MappedTransaction[] = [];
  for (let r = 1; r < table.rows.length; r += 1) {
    const row = table.rows[r];
    const date = parseDate(row[dateIdx] ?? "");
    if (!date) throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:date:${r}`);

    const account = (row[accountIdx] ?? "").trim();
    if (!account) throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:account:${r}`);

    const currency = currencyIdx === -1
      ? declaredCurrency
      : ((row[currencyIdx] ?? "").trim() || declaredCurrency);
    if (!currency) throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:currency:${r}`);

    const debit = debitIdx === -1 ? 0 : requireStatementAmount(row[debitIdx], r, "debit");
    const credit = creditIdx === -1 ? 0 : requireStatementAmount(row[creditIdx], r, "credit");
    if (debit === 0 && credit === 0) throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:zero-row:${r}`);
    if (debit > 0 && credit > 0) throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:double-sided-row:${r}`);

    transactions.push({ date, account, debit, credit, currency });
  }

  if (transactions.length === 0) throw new Error(`${TABLE_ERROR_CODES.SCHEMA_INVALID}:no-rows`);
  return transactions;
}