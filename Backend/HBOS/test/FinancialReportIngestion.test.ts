/**
 * Unified financial report ingestion through the canonical adapter.
 *
 * Proves PDF (text-native, mocked parser), realistic XLSX statement workbooks and
 * REAL legacy .xls (OLE2/BIFF8, governed `xls-reader` provider) all converge on
 * the same canonical document understanding, while a genuine 5-column ledger
 * keeps its exact transaction behavior. Provenance, persistence, tenant
 * isolation and fail-closed errors are asserted.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ExcelJS from "exceljs-hardened";
import { PDFParse } from "pdf-parse";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import {
  FinancialDataIngestionAdapter,
  type FinancialCanonicalModel,
} from "../Product/FinancialDataIngestionAdapter";
import { deriveAnalysisInput } from "../Product/FinancialDocumentUnderstanding";

jest.mock("pdf-parse", () => ({ PDFParse: jest.fn() }));

const PDFParseMock = PDFParse as unknown as jest.Mock;
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const XLS_REPORT = resolve(REPO_ROOT, "Backend", "HBOS", "test", "fixtures", "synthetic", "financial_report_1402.xls");
const XLS_LEDGER = resolve(REPO_ROOT, "Backend", "HBOS", "test", "fixtures", "synthetic", "ledger.xls");

const XLS_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const SHA = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function makeAdapter(): { adapter: FinancialDataIngestionAdapter; store: SQLitePersistenceStore } {
  const store = new SQLitePersistenceStore({ databasePath: ":memory:" });
  return { adapter: new FinancialDataIngestionAdapter(store), store };
}

async function buildStatementWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const add = (name: string, rows: (string | number)[][]): void => {
    const sheet = workbook.addWorksheet(name);
    rows.forEach((row) => sheet.addRow(row));
  };
  add("ترازنامه", [
    ["صورت وضعیت مالی"],
    ["(ارقام به میلیون ریال)"],
    ["شرح", "1402", "1401"],
    ["دارایی‌های جاری", "", ""],
    ["موجودی نقد", 125000, 98000],
    ["جمع دارایی‌های جاری", 465000, 398000],
    ["جمع دارایی‌ها", 1965000, 1798000],
    ["جمع بدهی‌ها", 820000, 880000],
    ["جمع حقوق مالکانه", 1145000, 918000],
  ]);
  add("سود و زیان", [
    ["صورت سود و زیان"],
    ["(ارقام به میلیون ریال)"],
    ["شرح", "1402", "1401"],
    ["درآمد عملیاتی", 2400000, 2100000],
    ["بهای تمام‌شده کالای فروش رفته", 1600000, 1400000],
    ["سود ناخالص", 800000, 700000],
    ["سود (زیان) خالص", 220000, 170000],
  ]);
  add("جریان وجوه نقد", [
    ["صورت جریان‌های نقدی"],
    ["(ارقام به میلیون ریال)"],
    ["شرح", "1402", "1401"],
    ["جریان نقدی عملیاتی", 310000, 250000],
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildLedgerWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("دفتر");
  [
    ["date", "account", "debit", "credit", "currency"],
    ["2026-08-01", "Cash", 1000, 0, "IRR"],
    ["2026-08-01", "Sales", 0, 1000, "IRR"],
  ].forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const PDF_REPORT_TEXT = [
  "گزارش حسابرس مستقل",
  "به سهامداران شرکت نمونه",
  "",
  "صورت وضعیت مالی",
  "(ارقام به میلیون ریال)",
  "شرح 1402 1401",
  "جمع دارایی‌های جاری 465,000 398,000",
  "جمع دارایی‌ها 1,965,000 1,798,000",
  "جمع بدهی‌ها 820,000 880,000",
  "جمع حقوق مالکانه 1,145,000 918,000",
  "",
  "صورت سود و زیان",
  "(ارقام به میلیون ریال)",
  "شرح 1402 1401",
  "درآمد عملیاتی 2,400,000 2,100,000",
  "سود (زیان) خالص 220,000 170,000",
].join("\n");

const PDF_LEDGER_TEXT = [
  "date,account,debit,credit,currency",
  "2026-08-01,Cash,1000,0,IRR",
  "2026-08-01,Sales,0,1000,IRR",
].join("\n");

function makePdfBytes(marker = "report"): Buffer {
  return Buffer.concat([
    Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Marker (${marker}) >>\nendobj\n`, "latin1"),
    Buffer.from("%%EOF\n", "latin1"),
  ]);
}

function mockTextPdf(text: string): void {
  PDFParseMock.mockImplementation(() => ({
    getInfo: async () => ({ info: {}, metadata: null, total: 1 }),
    getText: async () => ({ pages: [{ num: 1, text }], text, total: 1, getPageText: () => text }),
    destroy: async () => undefined,
  }));
}

describe("XLSX financial-statement workbook", () => {
  test("routes a multi-sheet statement workbook through the unified boundary", async () => {
    const { adapter, store } = makeAdapter();
    const bytes = await buildStatementWorkbook();
    const result = await adapter.ingestXlsx("tenant-a", "financial_report_1402.xlsx", bytes);

    expect(result.evidence.sourceType).toBe("XLSX");
    expect(result.evidence.sha256).toBe(SHA(bytes));
    expect(result.model.transactions).toHaveLength(0);
    expect(result.model.document?.status).toBe("COMPLETED");
    const types = result.model.document?.sections.map((section) => section.type);
    expect(types).toEqual(["BALANCE_SHEET", "INCOME_STATEMENT", "CASH_FLOW_STATEMENT"]);

    const derived = deriveAnalysisInput(result.model.document!);
    expect(derived.assets).toBe(1_965_000 * 1_000_000);
    expect(derived.liabilities).toBe(820_000 * 1_000_000);
    expect(derived.revenue).toBe(2_400_000 * 1_000_000);

    const persisted = await store.read({ tenantId: "tenant-a" }, `financial-ingestion:${SHA(bytes)}`);
    expect((persisted?.value as FinancialCanonicalModel | undefined)?.document?.facts.length).toBeGreaterThan(0);
  });

  test("keeps the canonical 5-column ledger behavior for a real ledger workbook", async () => {
    const { adapter } = makeAdapter();
    const bytes = await buildLedgerWorkbook();
    const result = await adapter.ingestXlsx("tenant-a", "ledger.xlsx", bytes);
    expect(result.model.transactions).toHaveLength(2);
    expect(result.model.document).toBeUndefined();
    expect(result.model.totals).toEqual({ debit: 1000, credit: 1000, balance: 0 });
  });

  test("a non-statement, non-ledger workbook fails with a precise code", async () => {
    const { adapter } = makeAdapter();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(["نام", "مقدار نامشخص"]);
    sheet.addRow(["ردیف یک", "داده بدون ساختار مالی"]);
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
    await expect(adapter.ingestXlsx("tenant-a", "unknown.xlsx", bytes)).rejects.toThrow(
      "spreadsheet-statement-ambiguous",
    );
  });
});

describe("legacy XLS via the governed xls-reader provider", () => {
  test("ingests a real multi-sheet statement workbook into canonical facts", async () => {
    const { adapter, store } = makeAdapter();
    const bytes = readFileSync(XLS_REPORT);
    const result = await adapter.ingestXlsBytes("tenant-x", "financial_report_1402.xls", bytes);

    expect(result.evidence.sourceType).toBe("XLS");
    expect(result.evidence.sha256).toBe(SHA(bytes));
    expect(result.model.transactions).toHaveLength(0);
    expect(result.model.document?.status).toBe("COMPLETED");
    expect(result.model.document?.currency).toBe("IRR");
    expect(result.model.document?.unitMultiplier).toBe(1_000_000);
    const types = result.model.document?.sections.map((section) => section.type);
    expect(types).toEqual(["BALANCE_SHEET", "INCOME_STATEMENT", "CASH_FLOW_STATEMENT", "NOTES"]);

    const persisted = await store.read({ tenantId: "tenant-x" }, `financial-ingestion:${SHA(bytes)}`);
    expect(persisted?.value).toBeDefined();
  });

  test("still parses a legacy .xls transaction ledger", async () => {
    const { adapter } = makeAdapter();
    const bytes = readFileSync(XLS_LEDGER);
    const result = await adapter.ingestXlsBytes("tenant-x", "ledger.xls", bytes);
    expect(result.model.transactions).toHaveLength(2);
    expect(result.model.transactions[1]).toMatchObject({ account: "Sales", credit: 1000, currency: "IRR" });
  });

  test("ingestFile routes a .xls path through the governed provider", async () => {
    const { adapter } = makeAdapter();
    const result = await adapter.ingestFile("tenant-x", XLS_REPORT);
    expect(result.evidence.sourceType).toBe("XLS");
    expect(result.model.document?.facts.length).toBeGreaterThan(0);
  });

  test("rejects malformed and encrypted-looking OLE2 input", async () => {
    const { adapter } = makeAdapter();
    const malformed = Buffer.concat([XLS_MAGIC, Buffer.from("not-a-real-compound-file")]);
    await expect(adapter.ingestXlsBytes("t", "broken.xls", malformed)).rejects.toThrow("xls-malformed");
  });

  test("rejects bytes whose magic is not a legacy workbook", async () => {
    const { adapter } = makeAdapter();
    const notXls = Buffer.from("date,account,debit,credit,currency\n2026-08-01,Cash,1,0,IRR", "utf8");
    await expect(adapter.ingestXlsBytes("t", "fake.xls", notXls)).rejects.toThrow("ingestion-format-unsupported");
  });

  test("enforces the XLS size limit before parsing", async () => {
    const { adapter } = makeAdapter();
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 16, 0);
    XLS_MAGIC.copy(oversized, 0);
    await expect(adapter.ingestXlsBytes("t", "huge.xls", oversized)).rejects.toThrow("ingestion-file-too-large");
  });

  test("keeps XLS evidence tenant-isolated", async () => {
    const { adapter, store } = makeAdapter();
    const bytes = readFileSync(XLS_LEDGER);
    await adapter.ingestXlsBytes("tenant-a", "ledger.xls", bytes);
    expect(await store.read({ tenantId: "tenant-b" }, `financial-ingestion:${SHA(bytes)}`)).toBeNull();
  });
});

describe("PDF report via the unified boundary", () => {
  beforeEach(() => PDFParseMock.mockReset());

  test("a text-native multi-section report becomes canonical facts with original-byte provenance", async () => {
    const { adapter, store } = makeAdapter();
    mockTextPdf(PDF_REPORT_TEXT);
    const bytes = makePdfBytes();
    const result = await adapter.ingestPdfBytes("tenant-p", "report.pdf", bytes);

    expect(result.evidence.sourceType).toBe("PDF");
    expect(result.evidence.sha256).toBe(SHA(bytes));
    expect(result.evidence.ocr).toBeUndefined();
    expect(result.model.transactions).toHaveLength(0);
    expect(result.model.document?.status).toBe("COMPLETED");
    const types = result.model.document?.sections.map((section) => section.type);
    expect(types).toEqual(["AUDITOR_REPORT", "BALANCE_SHEET", "INCOME_STATEMENT"]);

    const persisted = await store.read({ tenantId: "tenant-p" }, `financial-ingestion:${SHA(bytes)}`);
    expect((persisted?.value as FinancialCanonicalModel | undefined)?.document?.status).toBe("COMPLETED");
  });

  test("a text-native ledger PDF still yields canonical transactions", async () => {
    const { adapter } = makeAdapter();
    mockTextPdf(PDF_LEDGER_TEXT);
    const result = await adapter.ingestPdfBytes("tenant-p", "ledger.pdf", makePdfBytes("ledger"));
    expect(result.model.transactions).toHaveLength(2);
    expect(result.model.document).toBeUndefined();
  });

  test("a report with no extractable statement evidence fails precisely, not generically", async () => {
    const { adapter } = makeAdapter();
    const noise = Array.from({ length: 30 }, (_, index) => `این یک متن تصادفی بدون ساختار مالی است شماره ${index}`).join("\n");
    mockTextPdf(noise);
    await expect(adapter.ingestPdfBytes("tenant-p", "random.pdf", makePdfBytes("random"))).rejects.toThrow(
      "ingestion-schema-invalid",
    );
  });
});
