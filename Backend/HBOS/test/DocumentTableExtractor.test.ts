/**
 * Stage 08-DOC.4 — Document table extraction / normalization tests.
 */
import {
  CANONICAL_FINANCIAL_SCHEMA,
  TABLE_ERROR_CODES,
  detectOcrStatementTables,
  detectStatementTables,
  detectTables,
  extractDeclaredCurrency,
  isCanonicalStatementHeader,
  mapStatementToCanonical,
  mapTableToCanonical,
  parseStatementAmount,
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

describe("DocumentTableExtractor — realistic financial statement normalization (Stage 15-DOC.5)", () => {
  const STATEMENT = [
    "Bank Statement - Account 1234567890 (Currency: IRR)",
    "Date        Description            Debit          Credit         Balance",
    "2024-01-15  Opening deposit        0.00           500,000.00     500,000.00",
    "2024-01-16  Cash withdrawal        120,000.00     0.00           380,000.00",
    "2024-01-17  Customer payment       0.00           250,000.00     630,000.00",
  ].join("\n");

  test("detects a statement header and maps it despite an extra balance column", () => {
    const tables = detectStatementTables(STATEMENT);
    expect(tables).toHaveLength(1);
    expect(isCanonicalStatementHeader(tables[0].headers)).toBe(true);

    const declared = extractDeclaredCurrency(STATEMENT);
    expect(declared).toBe("IRR");

    const transactions = mapStatementToCanonical(tables[0], { defaultCurrency: declared ?? undefined });
    expect(transactions).toHaveLength(3);
    expect(transactions[0]).toEqual({
      date: "2024-01-15",
      account: "Opening deposit",
      debit: 0,
      credit: 500000,
      currency: "IRR",
    });
    expect(transactions[1].debit).toBe(120000);
    expect(transactions[2].credit).toBe(250000);
  });

  test("does not misread a CSV line as a statement table", () => {
    expect(detectStatementTables("date,account,debit,credit,currency\n2024-01-15,Cash,1,0,IRR")).toEqual([]);
  });

  test("extractDeclaredCurrency only accepts an explicit declaration", () => {
    expect(extractDeclaredCurrency("current account 1234 has no currency")).toBeNull();
    expect(extractDeclaredCurrency("نمونه صورت‌حساب (واحد پول: USD)")).toBe("USD");
  });

  test("fails closed when no currency column and no declared currency exist", () => {
    const text = [
      "Date        Description            Debit          Credit",
      "2024-01-15  Opening deposit        0.00           500000.00",
    ].join("\n");
    const [table] = detectStatementTables(text);
    expect(isCanonicalStatementHeader(table.headers)).toBe(true);
    expect(() => mapStatementToCanonical(table)).toThrow(TABLE_ERROR_CODES.AMBIGUOUS);
  });

  test("fails closed precisely on a double-sided row and on an unparseable amount", () => {
    const doubleSided = [
      "Date        Description            Debit          Credit",
      "2024-01-15  Bad row                100.00         100.00",
    ].join("\n");
    const [a] = detectStatementTables(doubleSided);
    expect(() => mapStatementToCanonical(a, { defaultCurrency: "IRR" }))
      .toThrow(/double-sided-row/);

    const unparseable = [
      "Date        Description            Debit          Credit",
      "2024-01-15  Bad amount             abc            0.00",
    ].join("\n");
    const [b] = detectStatementTables(unparseable);
    expect(() => mapStatementToCanonical(b, { defaultCurrency: "IRR" }))
      .toThrow(/ingestion-table-schema-invalid:debit/);
  });

  test("parseStatementAmount handles separators, parentheses and Persian digits", () => {
    expect(parseStatementAmount("1,234,567.89")).toBe(1234567.89);
    expect(parseStatementAmount("(500)")).toBe(-500);
    expect(parseStatementAmount("-")).toBe(0);
    expect(parseStatementAmount("")).toBe(0);
    expect(parseStatementAmount("۱۲۳۴")).toBe(1234);
    expect(parseStatementAmount("not-a-number")).toBeNull();
  });

  test("detectOcrStatementTables rebuilds the grid from single-space OCR output", () => {
    // Exactly the shape real OCR produces (column gaps collapsed to one space).
    const ocrText = [
      "Bank Statement - Account 1234567890 (Currency: IRR)",
      "",
      "Date Description Debit Credit Balance",
      "",
      "2024-01-15 Opening deposit 0.00 500000.00 500000.00",
      "2024-01-16 Cash withdrawal 120000.00 0.00 380000.00",
      "2024-01-17 Customer payment 0.00 250000.00 630000.00",
    ].join("\n");

    const tables = detectOcrStatementTables(ocrText);
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(["date", "description", "debit", "credit", "balance"]);

    const transactions = mapStatementToCanonical(tables[0], { defaultCurrency: extractDeclaredCurrency(ocrText) ?? undefined });
    expect(transactions).toHaveLength(3);
    expect(transactions[0]).toEqual({
      date: "2024-01-15",
      account: "Opening deposit",
      debit: 0,
      credit: 500000,
      currency: "IRR",
    });
    expect(transactions[1]).toEqual({
      date: "2024-01-16",
      account: "Cash withdrawal",
      debit: 120000,
      credit: 0,
      currency: "IRR",
    });
    expect(transactions[2].credit).toBe(250000);
  });
});