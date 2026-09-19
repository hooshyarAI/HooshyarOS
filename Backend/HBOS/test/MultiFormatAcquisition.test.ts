/**
 * Canonical multi-format acquisition — DOCX / HTML / XML / TSV focused tests.
 *
 * Proves the new formats converge on the ONE canonical owner
 * (`FinancialDataIngestionAdapter`) and the ONE provider-admission mechanism
 * (`CapabilityProviderRegistry`): real extraction, canonical validation,
 * original-byte provenance, tenant isolation and fail-closed behaviour for
 * malformed/unsafe input. No format-specific intelligence engine is created.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

jest.mock("mammoth", () => ({ extractRawText: jest.fn(), convertToHtml: jest.fn() }));

import * as mammoth from "mammoth";

import {
  MARKUP_ERROR_CODES,
  assertMarkupWithinLimits,
  decodeEntities,
  extractMarkupTables,
  extractRepeatingXmlElements,
  htmlToText,
  xmlToText,
} from "../Product/MarkupTextExtraction";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { FinancialIngestionService } from "../Product/FinancialIngestionService";
import { CapabilityProviderRegistry } from "../Product/CapabilityProviderRegistry";

const mammothMock = mammoth as unknown as { extractRawText: jest.Mock; convertToHtml: jest.Mock };
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,100,0,IRR\n2026-08-02,Sales,0,50,IRR\n";
const TSV = CSV.replace(/,/g, "\t");

const LEDGER_TABLE_HTML = [
  "<table>",
  "<tr><th>Date</th><th>Account</th><th>Debit</th><th>Credit</th><th>Currency</th></tr>",
  "<tr><td>2026-08-01</td><td>Cash</td><td>100</td><td></td><td>IRR</td></tr>",
  "<tr><td>2026-08-02</td><td>Sales</td><td></td><td>50</td><td>IRR</td></tr>",
  "</table>",
].join("");

const LEDGER_XML = [
  "<ledger>",
  "<transaction><date>2026-08-01</date><account>Cash</account><debit>100</debit><credit>0</credit><currency>IRR</currency></transaction>",
  "<transaction><date>2026-08-02</date><account>Sales</account><debit>0</debit><credit>50</credit><currency>IRR</currency></transaction>",
  "</ledger>",
].join("");

describe("MarkupTextExtraction", () => {
  test("decodes named and numeric entities and preserves unknown references", () => {
    expect(decodeEntities("a&amp;b &lt;x&gt; &#65;&#x42; &unknown;")).toBe("a&b <x> AB &unknown;");
  });

  test("htmlToText drops script/style content and keeps visible rows", () => {
    const text = htmlToText(
      "<div><script>alert(1)</script><style>.a{}</style><p>Hello</p><p>World</p></div>",
    );
    expect(text).toBe("Hello\nWorld");
    expect(text).not.toContain("alert");
  });

  test("extractMarkupTables returns rectangular cell rows", () => {
    const tables = extractMarkupTables(LEDGER_TABLE_HTML);
    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].rows[0]).toEqual(["Date", "Account", "Debit", "Credit", "Currency"]);
    expect(tables[0].rows[1][4]).toBe("IRR");
  });

  test("xmlToText rejects DOCTYPE and ENTITY declarations (XXE defense)", () => {
    expect(() => xmlToText(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///c:/secret">]><a/>`))
      .toThrow(MARKUP_ERROR_CODES.UNSAFE_XML);
    expect(() => xmlToText(`<!ENTITY xxe SYSTEM "http://evil"><a/>`))
      .toThrow(MARKUP_ERROR_CODES.UNSAFE_XML);
  });

  test("extractRepeatingXmlElements reads direct child text", () => {
    const records = extractRepeatingXmlElements(LEDGER_XML, "transaction");
    expect(records).toHaveLength(2);
    expect(records[0].account).toBe("Cash");
    expect(records[1].credit).toBe("50");
  });

  test("payload size is bounded (fail closed)", () => {
    expect(() => assertMarkupWithinLimits("x".repeat(64), 16))
      .toThrow(MARKUP_ERROR_CODES.TOO_LARGE);
    expect(() => assertMarkupWithinLimits("   ", 16)).toThrow(MARKUP_ERROR_CODES.EMPTY);
  });
});

describe("FinancialDataIngestionAdapter — multi-format canonical routes", () => {
  let directory: string;
  let store: SQLitePersistenceStore;
  let adapter: FinancialDataIngestionAdapter;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "hooshyar-multiformat-"));
    store = new SQLitePersistenceStore({ databasePath: join(directory, "s.db") });
    adapter = new FinancialDataIngestionAdapter(store);
    mammothMock.extractRawText.mockReset();
    mammothMock.convertToHtml.mockReset();
  });

  afterEach(() => {
    try { store.close(); } catch { /* ignore */ }
    try { rmSync(directory, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test("ingests TSV through the canonical ledger pipeline", async () => {
    const result = await adapter.ingestTsv("t1", "ledger.tsv", TSV);
    expect(result.model.transactions).toHaveLength(2);
    expect(result.evidence.sourceType).toBe("TSV");
    expect(result.evidence.sha256).toBe(createHash("sha256").update(TSV, "utf8").digest("hex"));
  });

  test("TSV route rejects comma-delimited content (delimiter is real)", async () => {
    await expect(adapter.ingestTsv("t1", "ledger.tsv", CSV)).rejects.toThrow(/ingestion-schema-invalid/);
  });

  test("ingests an HTML ledger table via the canonical table contract", async () => {
    const html = `<html><body>${LEDGER_TABLE_HTML}</body></html>`;
    const result = await adapter.ingestHtml("t1", "ledger.html", html);
    expect(result.model.transactions).toHaveLength(2);
    expect(result.evidence.sourceType).toBe("HTML");
    expect(result.model.totals).toEqual({ debit: 100, credit: 50, balance: 50 });
  });

  test("HTML route falls back to bounded visible text", async () => {
    const html = `<html><body><pre>${CSV}</pre></body></html>`;
    const result = await adapter.ingestHtml("t1", "ledger.html", html);
    expect(result.model.transactions).toHaveLength(2);
  });

  test("ingests XML transactions via the canonical table contract", async () => {
    const result = await adapter.ingestXml("t1", "ledger.xml", LEDGER_XML);
    expect(result.model.transactions).toHaveLength(2);
    expect(result.evidence.sourceType).toBe("XML");
  });

  test("XML route falls back to bounded visible text", async () => {
    const xml = `<ledger>${CSV}</ledger>`;
    const result = await adapter.ingestXml("t1", "ledger.xml", xml);
    expect(result.model.transactions).toHaveLength(2);
  });

  test("XML route rejects unsafe XML before any model is persisted", async () => {
    const xml = `<!DOCTYPE ledger [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><ledger>&xxe;</ledger>`;
    await expect(adapter.ingestXml("t1", "ledger.xml", xml)).rejects.toThrow(MARKUP_ERROR_CODES.UNSAFE_XML);
  });

  test("DOCX route extracts real tables and anchors provenance to the original bytes", async () => {
    mammothMock.extractRawText.mockResolvedValue({ value: "ignored", messages: [] });
    mammothMock.convertToHtml.mockResolvedValue({ value: LEDGER_TABLE_HTML });

    const result = await adapter.ingestDocxBytes("t1", "ledger.docx", ZIP_HEADER);
    expect(result.model.transactions).toHaveLength(2);
    expect(result.evidence.sourceType).toBe("DOCX");
    expect(result.evidence.sha256).toBe(createHash("sha256").update(ZIP_HEADER).digest("hex"));
  });

  test("DOCX route fails closed when the provider cannot parse the document", async () => {
    mammothMock.extractRawText.mockRejectedValue(new Error("bad zip"));
    await expect(adapter.ingestDocxBytes("t1", "ledger.docx", ZIP_HEADER))
      .rejects.toThrow(/ingestion-docx-parse-error/);
  });

  test("multi-format ingestion stays tenant-scoped", async () => {
    const result = await adapter.ingestTsv("tenant-a", "ledger.tsv", TSV);
    await expect(store.read(
      { tenantId: "tenant-b" },
      `financial-ingestion:${result.evidence.sha256}`,
    )).resolves.toBeNull();
    await expect(store.read(
      { tenantId: "tenant-a" },
      `financial-ingestion:${result.evidence.sha256}`,
    )).resolves.toMatchObject({ tenantId: "tenant-a" });
  });
});

describe("FinancialIngestionService — multi-format runtime surface", () => {
  const stores: SQLitePersistenceStore[] = [];
  afterEach(() => {
    for (const store of stores.splice(0)) {
      try { store.close(); } catch { /* ignore */ }
    }
  });

  function makeService(providers?: CapabilityProviderRegistry) {
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    stores.push(persistence);
    return new FinancialIngestionService(persistence, undefined, providers);
  }

  test("exposes TSV / HTML / XML through the runtime without an external gate", async () => {
    const service = makeService(new CapabilityProviderRegistry([]));

    const tsv = await service.ingest("t1", { sourceName: "l.tsv", format: "TSV", content: TSV });
    expect(tsv.result.model.transactions).toHaveLength(2);

    const html = await service.ingest("t1", {
      sourceName: "l.html", format: "HTML", content: `<html>${LEDGER_TABLE_HTML}</html>`,
    });
    expect(html.result.evidence.sourceType).toBe("HTML");

    const xml = await service.ingest("t1", { sourceName: "l.xml", format: "XML", content: LEDGER_XML });
    expect(xml.result.evidence.sourceType).toBe("XML");
  });

  test("DOCX is gated by the admitted mammoth provider", async () => {
    mammothMock.extractRawText.mockResolvedValue({ value: "ignored", messages: [] });
    mammothMock.convertToHtml.mockResolvedValue({ value: LEDGER_TABLE_HTML });

    const service = makeService();
    const outcome = await service.ingest("t1", {
      sourceName: "l.docx",
      format: "DOCX",
      contentBase64: ZIP_HEADER.toString("base64"),
    });
    expect(outcome.result.evidence.sourceType).toBe("DOCX");
    expect(outcome.rawSourceRef.sha256).toBe(createHash("sha256").update(ZIP_HEADER).digest("hex"));
  });

  test("DOCX fails closed when no provider is admitted", async () => {
    const service = makeService(new CapabilityProviderRegistry([]));
    await expect(service.ingest("t1", {
      sourceName: "l.docx",
      format: "DOCX",
      contentBase64: ZIP_HEADER.toString("base64"),
    })).rejects.toThrow(/ingestion-provider-not-admitted/);
  });
});

describe("CapabilityProviderRegistry — multi-format provider admission", () => {
  const registry = new CapabilityProviderRegistry();

  test("selects admitted integrated providers for the activated formats", () => {
    expect(registry.selectProvider("document.docx.text").capabilityId).toBe("document-docx-mammoth");
    expect(registry.selectProvider("document.pdf.rasterize").capabilityId).toBe("pdf-rasterize-pdfparse");
    expect(registry.selectProvider("document.html.text").capabilityId).toBe("document-html-internal");
    expect(registry.selectProvider("document.xml.text").capabilityId).toBe("document-xml-internal");
    expect(registry.selectProvider("text.tsv.parse").capabilityId).toBe("text-tsv-internal");
  });

  test("OCR engine remains fail-closed (no admitted provider)", () => {
    expect(() => registry.selectProvider("document.pdf.ocr")).toThrow(/capability-provider-not-admitted/);
  });

  test("long-tail formats are recorded but never admitted", () => {
    for (const id of ["document-broad-tika", "office-libreoffice-convert", "image-tiff-decode", "document-xls-legacy"]) {
      expect(registry.assess(id).admitted).toBe(false);
      expect(registry.assess(id).reasons).toContain("status-not-approved:DEFERRED");
    }
  });
});
