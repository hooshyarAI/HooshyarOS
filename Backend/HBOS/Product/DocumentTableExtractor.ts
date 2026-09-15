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
  date: ["date", "transaction date", "posting date", "tx date"],
  account: ["account", "account name", "description", "gl account", "ledger account"],
  debit: ["debit", "dr", "withdrawal", "amount debit"],
  credit: ["credit", "cr", "deposit", "amount credit"],
  currency: ["currency", "ccy", "curr"],
};

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