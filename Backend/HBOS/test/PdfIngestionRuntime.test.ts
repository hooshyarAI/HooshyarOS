/**
 * PDF ingestion focused tests (text-native PDF -> canonical financial model).
 *
 * The Jest VM cannot host pdf.js's worker ("A dynamic import callback was
 * invoked without --experimental-vm-modules"), so — exactly like the existing
 * `PdfAcquisition.test.ts` — the `pdf-parse` module is mocked and the REAL
 * `acquirePdf` validation/threshold/SHA logic, the REAL canonical adapter, the
 * REAL composition service and the REAL HTTP runtime run unchanged.
 *
 * The real `pdf-parse` byte->text behaviour is qualified separately under tsx
 * by `scripts/pdf-ingestion-acceptance.ts`.
 */
import { createHash } from "node:crypto";
import { Server } from "node:http";
import { PDFParse } from "pdf-parse";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialIngestionService } from "../Product/FinancialIngestionService";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

jest.mock("pdf-parse", () => ({ PDFParse: jest.fn() }));

const PDFParseMock = PDFParse as unknown as jest.Mock;

const PDF_CSV = [
  "date,account,debit,credit,currency",
  "2026-08-01,Cash,1000,0,IRR",
  "2026-08-01,Sales,0,1000,IRR",
  "2026-08-02,Receivable,250,0,IRR",
  "2026-08-02,Sales,0,250,IRR",
].join("\n");

const SHA = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function makePdfBytes(marker = "ledger"): Buffer {
  return Buffer.concat([
    Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Marker (${marker}) >>\nendobj\n`, "latin1"),
    Buffer.from("%%EOF\n", "latin1"),
  ]);
}

function mockTextPdf(text: string): void {
  PDFParseMock.mockImplementation(() => ({
    getInfo: async () => ({ info: { Title: "Ledger" }, metadata: null, total: 1 }),
    getText: async () => ({ pages: [{ num: 1, text }], text, total: 1, getPageText: () => text }),
    destroy: async () => undefined,
  }));
}

function mockScannedPdf(): void {
  PDFParseMock.mockImplementation(() => ({
    getInfo: async () => ({ info: {}, metadata: null, total: 1 }),
    getText: async () => ({ pages: [{ num: 1, text: "" }], text: "", total: 1, getPageText: () => "" }),
    destroy: async () => undefined,
  }));
}

describe("PDF canonical ingestion — composition service", () => {
  beforeEach(() => PDFParseMock.mockReset());

  test("ingests a text-native PDF and extracted text reaches the canonical model", async () => {
    mockTextPdf(PDF_CSV);
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const service = new FinancialIngestionService(persistence);
    const bytes = makePdfBytes();

    const outcome = await service.ingest("tenant-a", {
      sourceName: "ledger.pdf",
      format: "PDF",
      contentBase64: bytes.toString("base64"),
    });

    expect(outcome.requestedFormat).toBe("PDF");
    expect(outcome.result.evidence.sourceType).toBe("PDF");
    expect(outcome.result.persisted).toBe(true);
    expect(outcome.result.model.transactions).toHaveLength(4);
    expect(outcome.result.model.transactions[0]).toEqual({
      date: "2026-08-01",
      account: "Cash",
      debit: 1000,
      credit: 0,
      currency: "IRR",
    });
    expect(outcome.result.model.totals).toEqual({ debit: 1250, credit: 1250, balance: 0 });

    persistence.close();
  });

  test("preserves original PDF byte SHA-256 provenance as tenant-scoped evidence", async () => {
    mockTextPdf(PDF_CSV);
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const service = new FinancialIngestionService(persistence);
    const bytes = makePdfBytes("provenance");
    const expectedSha = SHA(bytes);

    const outcome = await service.ingest("tenant-a", {
      sourceName: "ledger.pdf",
      format: "PDF",
      contentBase64: bytes.toString("base64"),
    });

    // Both the raw evidence pointer and the canonical model carry the
    // ORIGINAL-byte identity, not the extracted-text hash.
    expect(outcome.rawSourceRef.sha256).toBe(expectedSha);
    expect(outcome.result.evidence.sha256).toBe(expectedSha);

    const evidence = await service.readSource("tenant-a", expectedSha);
    expect(evidence).not.toBeNull();
    expect(evidence?.contentEncoding).toBe("base64");
    expect(Buffer.from(evidence?.content ?? "", "base64")).toEqual(bytes);

    const storedModel = await persistence.read({ tenantId: "tenant-a" }, `financial-ingestion:${expectedSha}`);
    expect(storedModel).not.toBeNull();

    // Tenant isolation: another tenant cannot list or read the PDF evidence.
    expect(await service.listSources("tenant-b")).toHaveLength(0);
    expect(await service.readSource("tenant-b", expectedSha)).toBeNull();

    persistence.close();
  });

  test("scanned/image-only PDF fails closed with the precise no-OCR error and persists nothing", async () => {
    mockScannedPdf();
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const service = new FinancialIngestionService(persistence);

    await expect(service.ingest("tenant-a", {
      sourceName: "scan.pdf",
      format: "PDF",
      contentBase64: makePdfBytes("scan").toString("base64"),
    })).rejects.toThrow("ingestion-pdf-scanned-no-ocr-yet");

    expect(await service.listSources("tenant-a")).toHaveLength(0);
    persistence.close();
  });

  test("non-PDF bytes and empty payload fail closed before any persistence", async () => {
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const service = new FinancialIngestionService(persistence);

    await expect(service.ingest("tenant-a", {
      sourceName: "fake.pdf",
      format: "PDF",
      contentBase64: Buffer.from("NOT A PDF").toString("base64"),
    })).rejects.toThrow("ingestion-pdf-unsupported");

    await expect(service.ingest("tenant-a", {
      sourceName: "empty.pdf",
      format: "PDF",
      contentBase64: "",
    })).rejects.toThrow("ingestion-source-empty");

    expect(await service.listSources("tenant-a")).toHaveLength(0);
    persistence.close();
  });

  test("browser transport represents PDF as a binary canonical format, never CSV", () => {
    const client = require("../../../web/offline-sync.js");
    expect(client.formatFromSourceName("statement.pdf")).toBe("PDF");
    expect(client.isBinaryFormat("PDF")).toBe(true);
    expect(client.formatFromSourceName("statement.pdf")).not.toBe("CSV");
  });
});

describe("PDF ingestion — real HTTP runtime endpoints", () => {
  let server: Server;

  beforeEach(async () => {
    PDFParseMock.mockReset();
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified" }) },
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const request = async (path: string, options: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return fetch(`http://127.0.0.1:${address.port}${path}`, options);
  };

  const register = async (username: string, organization: string): Promise<string> => {
    const response = await request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
    });
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("session-cookie-missing");
    return cookie.split(";")[0];
  };

  test("POST /api/ingest accepts a text-native PDF and /api/financial/analyze consumes it", async () => {
    mockTextPdf(PDF_CSV);
    const cookie = await register("pdf-owner", "PDF Org");
    const bytes = makePdfBytes("http-ledger");

    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "ledger.pdf", format: "PDF", contentBase64: bytes.toString("base64") }),
    });
    expect(ingested.status).toBe(201);
    const body = await ingested.json();
    expect(body.status).toBe("READY");
    expect(body.evidence.sourceType).toBe("PDF");
    expect(body.evidence.sha256).toBe(SHA(bytes));
    expect(body.source.persisted).toBe(true);
    expect(body.source.sha256).toBe(SHA(bytes));
    expect(body.transactionCount).toBe(4);
    expect(body.totals).toEqual({ debit: 1250, credit: 1250, balance: 0 });

    const analysis = await request("/api/financial/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: body.evidence.sha256, assets: 5000, liabilities: 1000 }),
    });
    expect(analysis.status).toBe(200);
    const analysisBody = await analysis.json();
    expect(analysisBody.status).toBe("READY");
    expect(analysisBody.targetEngine).toBe("Financial Intelligence Engine");
    expect(analysisBody.ingestedSource.sourceType).toBe("PDF");
    expect(analysisBody.ingestedSource.transactionCount).toBe(4);
    expect(analysisBody.metrics.debtRatio).toBe(0.2);

    const evidence = await request(`/api/sources/${body.source.sha256}`, { headers: { cookie } });
    expect(evidence.status).toBe(200);
    expect((await evidence.json()).source.contentEncoding).toBe("base64");
  });

  test("POST /api/ingest rejects a scanned-only PDF with the precise no-OCR error", async () => {
    mockScannedPdf();
    const cookie = await register("pdf-scan-owner", "PDF Scan Org");

    const ingested = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "scan.pdf", format: "PDF", contentBase64: makePdfBytes("scan").toString("base64") }),
    });
    expect(ingested.status).toBe(422);
    expect((await ingested.json()).error).toBe("ingestion-pdf-scanned-no-ocr-yet");
  });

  test("POST /api/ingest requires base64 content for PDF (never text content)", async () => {
    const cookie = await register("pdf-content-owner", "PDF Content Org");

    const missing = await request("/api/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "ledger.pdf", format: "PDF", content: "%PDF-1.7 fake" }),
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("CONTENT_BASE64_REQUIRED");
  });
});
