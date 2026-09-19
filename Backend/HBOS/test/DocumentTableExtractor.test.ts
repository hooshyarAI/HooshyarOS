/**
 * Stage 08-DOC.4 — Document table extraction / normalization tests.
 */
import {
  CANONICAL_FINANCIAL_SCHEMA,
  TABLE_ERROR_CODES,
  detectTables,
  mapTableToCanonical,
} from "../Product/DocumentTableExtractor";

describe("DocumentTableExtractor (Stage 08-DOC.4)", () => {
  test("detectTables finds pipe-delimited table", () => {
    const text = [
      "Header text line",
      "date | account | debit | credit | currency",
      "2026-08-01 | Cash | 1000.00 | 0 | IRR",
      "2026-08-01 | Sales | 0 | 1000.00 | IRR",
      "Footer text line",
    ].join("\n");
    const tables = detectTables(text);
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(["date", "account", "debit", "credit", "currency"]);
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].headerConfidence).toBe(1.0);
  });

  test("detectTables finds space-aligned table (>=2 spaces)", () => {
    const text = [
      "Date          Account       Debit         Credit        Currency",
      "2026-08-01    Cash          1000.00       0             IRR",
      "2026-08-01    Sales         0             1000.00       IRR",
    ].join("\n");
    const tables = detectTables(text);
    expect(tables.length).toBeGreaterThanOrEqual(1);
    expect(tables[0].rows).toHaveLength(3);
  });

  test("detectTables returns empty for prose-only text", () => {
    const text = "This is a paragraph of text without any tabular structure.";
    expect(detectTables(text)).toEqual([]);
  });

  test("mapTableToCanonical maps exact 5-col schema in canonical order", () => {
    const text = [
      "date | account | debit | credit | currency",
      "2026-08-01 | Cash | 1000.00 | 0 | IRR",
      "2026-08-01 | Sales | 0 | 1000.00 | IRR",
    ].join("\n");
    const [table] = detectTables(text);
    const txns = mapTableToCanonical(table);
    expect(txns).toHaveLength(2);
    expect(txns[0].debit).toBe(1000);
    expect(txns[1].credit).toBe(1000);
  });

  test("mapTableToCanonical accepts alternative column order", () => {
    const text = [
      "currency | credit | debit | account | date",
      "IRR | 0 | 1000.00 | Cash | 2026-08-01",
    ].join("\n");
    const [table] = detectTables(text);
    const txns = mapTableToCanonical(table);
    expect(txns[0].account).toBe("Cash");
    expect(txns[0].debit).toBe(1000);
  });

  test("mapTableToCanonical throws AMBIGUOUS when header missing", () => {
    const text = [
      "date | account | debit | credit | memo",
      "2026-08-01 | Cash | 1000.00 | 0 | note",
    ].join("\n");
    const [table] = detectTables(text);
    expect(() => mapTableToCanonical(table)).toThrow(TABLE_ERROR_CODES.AMBIGUOUS);
  });

  test("mapTableToCanonical throws AMBIGUOUS for wrong column count", () => {
    const text = [
      "date | account | debit",
      "2026-08-01 | Cash | 1000.00",
    ].join("\n");
    const [table] = detectTables(text);
    expect(() => mapTableToCanonical(table)).toThrow(TABLE_ERROR_CODES.AMBIGUOUS);
  });

  test("mapTableToCanonical throws SCHEMA_INVALID on zero-row", () => {
    const text = [
      "date | account | debit | credit | currency",
      "2026-08-01 | Cash | 0 | 0 | IRR",
    ].join("\n");
    const [table] = detectTables(text);
    expect(() => mapTableToCanonical(table)).toThrow(/zero-row/);
  });

  test("mapTableToCanonical throws SCHEMA_INVALID on double-sided row", () => {
    const text = [
      "date | account | debit | credit | currency",
      "2026-08-01 | Cash | 100 | 100 | IRR",
    ].join("\n");
    const [table] = detectTables(text);
    expect(() => mapTableToCanonical(table)).toThrow(/double-sided-row/);
  });

  test("CANONICAL_FINANCIAL_SCHEMA exposes the 5 expected columns", () => {
    expect(CANONICAL_FINANCIAL_SCHEMA.headers).toEqual([
      "date", "account", "debit", "credit", "currency",
    ]);
  });
});