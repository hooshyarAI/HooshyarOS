/**
 * Stage 15-DOC.5 — Real document normalization regression.
 *
 * Reproduces the real defect: OCR-extracted scanned financial-statement text
 * was forced through the synthetic 5-column ledger CSV parser and failed with
 * `ingestion-schema-invalid`. This suite proves the canonical normalization
 * boundary now maps a realistic statement layout to canonical transactions
 * while still failing closed with a precise typed error on unsafe input, and
 * that the strict CSV contract remains available as a fallback.
 */
import { createHash } from "node:crypto";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import type { OcrAdapter, OcrResult } from "../Product/OcrAdapter";
import type { IngestionProgressEvent } from "../Product/IngestionProgress";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 0xab),
]);

const STATEMENT_TEXT = [
  "Bank Statement - Account 1234567890 (Currency: IRR)",
  "Date        Description            Debit          Credit         Balance",
  "2024-01-15  Opening deposit        0.00           500,000.00     500,000.00",
  "2024-01-16  Cash withdrawal        120,000.00     0.00           380,000.00",
  "2024-01-17  Customer payment       0.00           250,000.00     630,000.00",
].join("\n");

function ocrReturning(text: string, sourceName = "statement.png"): OcrAdapter {
  return {
    engine: "stub-ocr",
    async recognize(): Promise<OcrResult> {
      return {
        sourceName,
        sha256: "a".repeat(64),
        byteLength: PNG.length,
        receivedAt: "2026-09-19T00:00:00.000Z",
        text,
        meanConfidence: 90,
        words: [{ text: "x", confidence: 90 }],
        engine: "stub-ocr",
        engineVersion: "1.0.0",
        language: "eng",
      };
    },
  };
}

describe("real document normalization — OCR text -> canonical transactions", () => {
  let store: SQLitePersistenceStore;
  let adapter: FinancialDataIngestionAdapter;

  beforeEach(() => {
    store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    adapter = new FinancialDataIngestionAdapter(store);
  });

  afterEach(() => {
    try { store.close(); } catch { /* ignore */ }
  });

  test("maps a realistic scanned statement (balance column, declared currency) to canonical transactions", async () => {
    const result = await adapter.ingestImageBytes("t1", "statement.png", PNG, ocrReturning(STATEMENT_TEXT));

    expect(result.persisted).toBe(true);
    expect(result.model.transactions).toHaveLength(3);
    expect(result.model.transactions[0]).toEqual({
      date: "2024-01-15",
      account: "Opening deposit",
      debit: 0,
      credit: 500000,
      currency: "IRR",
    });
    expect(result.model.totals).toEqual({ debit: 120000, credit: 750000, balance: -630000 });

    // Provenance stays anchored to the ORIGINAL image bytes, not the OCR text.
    expect(result.evidence.sha256).toBe(createHash("sha256").update(PNG).digest("hex"));
    expect(result.evidence.ocr?.ocrEngine).toBe("stub-ocr");
  });

  test("fails closed with a precise typed error for an unsafe statement (no currency)", async () => {
    const unsafe = [
      "Date        Description            Debit          Credit",
      "2024-01-15  Opening deposit        0.00           500000.00",
    ].join("\n");
    await expect(adapter.ingestImageBytes("t1", "statement.png", PNG, ocrReturning(unsafe)))
      .rejects.toThrow("ingestion-ambiguous-table-mapping");

    // Nothing was persisted for the rejected document.
    expect(await store.read({ tenantId: "t1" }, `financial-ingestion:${createHash("sha256").update(PNG).digest("hex")}`)).toBeNull();
  });

  test("keeps the strict canonical CSV contract as a fallback for CSV-shaped OCR text", async () => {
    const csv = [
      "date,account,debit,credit,currency",
      "2024-01-15,Cash,100,0,IRR",
      "2024-01-16,Sales,0,100,IRR",
    ].join("\n");
    const result = await adapter.ingestImageBytes("t1", "ledger.png", PNG, ocrReturning(csv));
    expect(result.model.transactions).toHaveLength(2);
    expect(result.model.totals).toEqual({ debit: 100, credit: 100, balance: 0 });
  });

  test("emits truthful normalization stages without fake progress", async () => {
    const events: IngestionProgressEvent[] = [];
    await adapter.ingestImageBytes("t1", "statement.png", PNG, ocrReturning(STATEMENT_TEXT), undefined, (event) => events.push(event));

    const stages = events.map((event) => event.stage);
    expect(stages).toContain("OCR");
    expect(stages).toContain("NORMALIZING");
    expect(stages).toContain("CANONICAL_VALIDATION");
    // No percent is claimed where the work cannot derive one.
    expect(events.filter((event) => event.percent !== undefined)).toHaveLength(0);
  });
});
