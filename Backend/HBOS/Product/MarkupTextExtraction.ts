/**
 * Stage 08-DOC.5 — Safe Markup Text / Table Extraction (supporting service).
 *
 * Pure, no-I/O helper that turns untrusted HTML / XML text into either:
 *   - bounded visible text (tags removed, entities decoded), or
 *   - a list of candidate tables (rows of cells) so structure survives
 *     instead of being flattened into a single blob.
 *
 * This module is NOT a new Engine and NOT a new ingestion architecture. It is
 * the internal capability behind the canonical `FinancialDataIngestionAdapter`
 * HTML/XML routes (governed by
 * `Docs/HOOSHYAROS_CAPABILITY_PROVIDER_LEVERAGE_LAW.md`), and it deliberately
 * introduces NO external dependency: markup parsing here is a
 * bounded, deterministic tokenizer, not a general-purpose browser or XML engine.
 *
 * Security posture (untrusted input):
 *   - `<script>` / `<style>` content is discarded, never executed.
 *   - XML `<!DOCTYPE>` / `<!ENTITY>` declarations are REJECTED, which prevents
 *     XXE / entity-expansion (billion laughs) attacks.
 *   - Output is bounded by `maxBytes`; oversized payloads fail closed.
 *   - No entity is resolved from an external source.
 */

export const MARKUP_ERROR_CODES = {
  EMPTY: "ingestion-markup-empty",
  TOO_LARGE: "ingestion-markup-too-large",
  UNSAFE_XML: "ingestion-xml-unsafe",
} as const;

export type MarkupErrorCode = (typeof MARKUP_ERROR_CODES)[keyof typeof MARKUP_ERROR_CODES];

/** Default maximum markup payload accepted for extraction (10 MB). */
export const DEFAULT_MARKUP_MAX_BYTES = 10 * 1024 * 1024;

export interface MarkupTable {
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
}

export function assertMarkupWithinLimits(content: string, maxBytes: number = DEFAULT_MARKUP_MAX_BYTES): void {
  if (typeof content !== "string" || !content.trim()) throw new Error(MARKUP_ERROR_CODES.EMPTY);
  if (Buffer.byteLength(content, "utf8") > maxBytes) throw new Error(MARKUP_ERROR_CODES.TOO_LARGE);
}

/**
 * Decode a bounded set of HTML/XML character references. Unknown references are
 * preserved verbatim (never resolved externally).
 */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    switch (body) {
      case "amp": return "&";
      case "lt": return "<";
      case "gt": return ">";
      case "quot": return '"';
      case "apos": return "'";
      case "nbsp": return " ";
      default: break;
    }
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const digits = hex ? body.slice(2) : body.slice(1);
      const code = Number.parseInt(digits, hex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
    }
    return match;
  });
}

function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ");
}

function cellText(segment: string): string {
  const withoutNestedTables = segment.replace(/<table\b[\s\S]*?<\/table>/gi, " ");
  const stripped = withoutNestedTables.replace(/<[^>]*>/g, " ");
  return stripControlChars(decodeEntities(stripped)).replace(/\s+/g, " ").trim();
}

/**
 * Extract candidate tables from HTML/XML-ish markup. Only `<table>` blocks with
 * `<tr>` rows and `<td>`/`<th>` cells are recognized; anything else is ignored.
 * Nested tables are not descended into (their cell text is flattened).
 */
export function extractMarkupTables(markup: string): MarkupTable[] {
  const tables: MarkupTable[] = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(markup)) !== null) {
    const rows: string[][] = [];
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(tableMatch[1])) !== null) {
      const cells: string[] = [];
      const cellRe = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
        cells.push(cellText(cellMatch[2]));
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) tables.push({ rows });
  }
  return tables;
}

/**
 * Convert HTML to bounded visible text. Active content (`<script>`/`<style>`)
 * is dropped; block-level boundaries become newlines so table/list rows remain
 * separable.
 */
export function htmlToText(html: string): string {
  const withoutActive = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  const headed = withoutActive.replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = headed
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|header|footer|ul|ol)\s*>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]*>/g, " ");
  return stripControlChars(decodeEntities(stripped))
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Reject XML constructs that enable external-entity / expansion attacks. This
 * must run before any other XML processing.
 */
export function assertSafeXml(xml: string): void {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    throw new Error(MARKUP_ERROR_CODES.UNSAFE_XML);
  }
}

/**
 * Convert XML to bounded visible text. Processing instructions, comments and
 * CDATA wrappers are removed; CDATA content is preserved as text.
 */
export function xmlToText(xml: string): string {
  assertSafeXml(xml);
  const cleaned = xml
    .replace(/<\?[\s\S]*?\?>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const withBreaks = cleaned.replace(/<\//g, "\n<");
  const stripped = withBreaks.replace(/<[^>]*>/g, " ");
  return stripControlChars(decodeEntities(stripped))
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Extract repeated XML elements (for example `<transaction>`) and their direct
 * child element text. Used only when the caller explicitly opts into a named
 * element contract; no schema is inferred.
 */
export function extractRepeatingXmlElements(
  xml: string,
  elementName: string,
): Array<Record<string, string>> {
  assertSafeXml(xml);
  if (!/^[A-Za-z_][\w.-]*$/.test(elementName)) {
    throw new Error(MARKUP_ERROR_CODES.UNSAFE_XML);
  }
  const records: Array<Record<string, string>> = [];
  const elementRe = new RegExp(`<${elementName}\\b[^>]*>([\\s\\S]*?)<\\/${elementName}>`, "gi");
  let elementMatch: RegExpExecArray | null;
  while ((elementMatch = elementRe.exec(xml)) !== null) {
    const fields: Record<string, string> = {};
    const childRe = /<([A-Za-z_][\w.-]*)\b[^>]*>([\s\S]*?)<\/\1>/g;
    let childMatch: RegExpExecArray | null;
    while ((childMatch = childRe.exec(elementMatch[1])) !== null) {
      const key = childMatch[1];
      if (!(key in fields)) fields[key] = cellText(childMatch[2]);
    }
    records.push(fields);
  }
  return records;
}
