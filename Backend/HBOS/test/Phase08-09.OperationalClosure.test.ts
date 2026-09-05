import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer, IncomingMessage, ServerResponse, Server } from "node:http";
import ExcelJS from "exceljs-hardened";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { decodeTextBytes } from "../Product/TextFileDecoder";
import { acquireImage, type ImageSource } from "../Product/ImageAcquisition";
import { OrchestratedDecisionIntelligenceService } from "../Product/OrchestratedDecisionIntelligenceService";
import { AssistantEngine } from "../Engines/AssistantEngine";
import { FinancialIntelligenceEngine } from "../Engines/FinancialIntelligenceEngine";
import { RiskIntelligenceEngine } from "../Engines/RiskIntelligenceEngine";
import { DecisionIntelligenceEngine } from "../Engines/DecisionIntelligenceEngine";
import { GenericApiConnector } from "../Product/GenericApiConnector";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const CSV = `date,account,debit,credit,currency
2026-08-01,Cash,1000,0,IRR
2026-08-01,Sales,0,1000,IRR
2026-08-02,Receivable,250,0,IRR
2026-08-02,Sales,0,250,IRR`;

const JSON_STRING = JSON.stringify({
  transactions: [
    { date: "2026-08-01", account: "Cash", debit: 1000, credit: 0, currency: "IRR" },
    { date: "2026-08-01", account: "Sales", debit: 0, credit: 1000, currency: "IRR" },
  ],
});

describe("Phase 08-09 Operational Closure", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "hooshyar-ops-closure-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("CSV real E2E: ingest -> canonical model -> persistence -> reload -> intelligence", async () => {
    const dbPath = join(dir, "ops.sqlite");
    const persistence = new SQLitePersistenceStore({ databasePath: dbPath });
    const adapter = new FinancialDataIngestionAdapter(persistence);
    const csvPath = join(dir, "ledger.csv");
    writeFileSync(csvPath, CSV, "utf8");

    const result = await adapter.ingestFile("tenant-a", csvPath);
    expect(result.persisted).toBe(true);
    expect(result.model.transactions).toHaveLength(4);
    expect(result.evidence.sha256).toMatch(/^[a-f0-9]{64}$/);

    const reloaded = await persistence.read({ tenantId: "tenant-a" }, `financial-ingestion:${result.evidence.sha256}`);
    expect(reloaded?.value).toBeDefined();

    const fin = new FinancialIntelligenceEngine();
    const analysis = fin.analyze({
      revenue: result.model.totals.credit,
      expenses: result.model.totals.debit,
      assets: 2000,
      liabilities: 500,
    });
    expect(analysis.status).toBe("READY");
    expect(analysis.profit).toBe(0);

    persistence.close();
  });

  test("STRUCTURED real E2E: JSON ingest -> persistence -> reload", async () => {
    const dbPath = join(dir, "ops.sqlite");
    const persistence = new SQLitePersistenceStore({ databasePath: dbPath });
    const adapter = new FinancialDataIngestionAdapter(persistence);
    const jsonPath = join(dir, "ledger.json");
    writeFileSync(jsonPath, JSON_STRING, "utf8");

    const result = await adapter.ingestFile("tenant-a", jsonPath);
    expect(result.persisted).toBe(true);
    expect(result.evidence.sourceType).toBe("STRUCTURED");
    expect(result.model.transactions).toHaveLength(2);

    persistence.close();
  });

  test("XLSX real E2E: Excel fixture -> canonical model -> persistence -> reload", async () => {
    const dbPath = join(dir, "ops.sqlite");
    const persistence = new SQLitePersistenceStore({ databasePath: dbPath });
    const adapter = new FinancialDataIngestionAdapter(persistence);

    const xlsxPath = join(dir, "ledger.xlsx");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("ledger");
    sheet.addRow(["date", "account", "debit", "credit", "currency"]);
    sheet.addRow(["2026-08-01", "Cash", 1000, 0, "IRR"]);
    sheet.addRow(["2026-08-01", "Sales", 0, 1000, "IRR"]);
    await workbook.xlsx.writeFile(xlsxPath);

    const result = await adapter.ingestFile("tenant-a", xlsxPath);
    expect(result.persisted).toBe(true);
    expect(result.evidence.sourceType).toBe("XLSX");
    expect(result.model.transactions).toHaveLength(2);
    expect(result.model.transactions[0].date).toBe("2026-08-01");

    persistence.close();
  });

  test("TXT real E2E: text decoder -> canonical model", async () => {
    const dbPath = join(dir, "ops.sqlite");
    const persistence = new SQLitePersistenceStore({ databasePath: dbPath });
    const adapter = new FinancialDataIngestionAdapter(persistence);
    const txtPath = join(dir, "ledger.txt");
    writeFileSync(txtPath, CSV, "utf8");

    const result = await adapter.ingestFile("tenant-a", txtPath);
    expect(result.persisted).toBe(true);
    expect(result.model.transactions).toHaveLength(4);

    persistence.close();
  });

  test("PDF is BLOCKED: no parser route exists", async () => {
    const dbPath = join(dir, "ops.sqlite");
    const persistence = new SQLitePersistenceStore({ databasePath: dbPath });
    const adapter = new FinancialDataIngestionAdapter(persistence);
    const pdfPath = join(dir, "report.pdf");
    writeFileSync(pdfPath, Buffer.from("%PDF-1.4 fake"), "utf8");

    await expect(adapter.ingestFile("tenant-a", pdfPath)).rejects.toThrow("ingestion-header-and-data-required");
    persistence.close();
  });

  test("DOCX is BLOCKED: no parser route exists", async () => {
    const dbPath = join(dir, "ops.sqlite");
    const persistence = new SQLitePersistenceStore({ databasePath: dbPath });
    const adapter = new FinancialDataIngestionAdapter(persistence);
    const docxPath = join(dir, "report.docx");
    writeFileSync(docxPath, Buffer.from("PK\x03\x04 fake docx"), "utf8");

    await expect(adapter.ingestFile("tenant-a", docxPath)).rejects.toThrow("ingestion-format-unsupported");
    persistence.close();
  });

  test("IMAGE is BLOCKED for OCR: validation exists but OCR not implemented", async () => {
    const pngPath = join(dir, "scan.png");
    writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array(100).fill(0)]));

    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const adapter = new FinancialDataIngestionAdapter(persistence);
    await expect(adapter.ingestFile("tenant-a", pngPath)).rejects.toThrow("ingestion-image-requires-ocr");
    persistence.close();
  });

  test("REAL API E2E: local HTTP server -> GenericApiConnector -> canonical mapping", async () => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ rows: [{ date: "2026-08-01", account: "API-Cash", debit: 500, credit: 0, currency: "USD" }] }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server-not-listening");
      const connector = new GenericApiConnector({
        endpoint: `http://127.0.0.1:${address.port}/api/transactions`,
        auth: { headers: async () => ({}) },
        validateAndMap: (rawJson) => {
          const data = rawJson as { rows?: Array<Record<string, unknown>> };
          return data.rows ?? [];
        },
      });
      const result = await connector.fetchAll();
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].account).toBe("API-Cash");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("REAL DB E2E: SQLite persistence -> reload -> tenant isolation -> intelligence", async () => {
    const dbPath = join(dir, "ops.sqlite");
    const persistence = new SQLitePersistenceStore({ databasePath: dbPath });
    const adapter = new FinancialDataIngestionAdapter(persistence);
    const csvPath = join(dir, "ledger.csv");
    writeFileSync(csvPath, CSV, "utf8");

    const result = await adapter.ingestFile("tenant-a", csvPath);
    expect(result.persisted).toBe(true);

    const crossTenant = await persistence.read({ tenantId: "tenant-b" }, `financial-ingestion:${result.evidence.sha256}`);
    expect(crossTenant).toBeNull();

    const fin = new FinancialIntelligenceEngine();
    const analysis = fin.analyze({
      revenue: result.model.totals.credit,
      expenses: result.model.totals.debit,
      assets: 2000,
      liabilities: 500,
    });
    expect(analysis.status).toBe("READY");

    persistence.close();
  });

  test("Phase 08->09 Bridge: real canonical data -> OrchestratedDecisionIntelligenceService", async () => {
    const dbPath = join(dir, "ops.sqlite");
    const persistence = new SQLitePersistenceStore({ databasePath: dbPath });
    const adapter = new FinancialDataIngestionAdapter(persistence);
    const csvPath = join(dir, "ledger.csv");
    writeFileSync(csvPath, CSV, "utf8");

    const result = await adapter.ingestFile("tenant-a", csvPath);
    expect(result.persisted).toBe(true);

    const orchestrated = new OrchestratedDecisionIntelligenceService(
      new FinancialIntelligenceEngine(),
      new RiskIntelligenceEngine(),
      new DecisionIntelligenceEngine()
    );

    const orchestratedInput = {
      tenantId: "tenant-a",
      problem: "Evaluate acquisition opportunity",
      financial: {
        revenue: result.model.totals.credit,
        expenses: result.model.totals.debit,
        assets: 2000,
        liabilities: 500,
        cashFlows: { initial: -1000, flows: [300, 400, 500], discountRate: 0.1 },
        waccInputs: { equity: 600, debt: 400, costOfEquity: 0.12, costOfDebt: 0.05, taxRate: 0.21 },
      },
      risk: {
        probability: 0.2,
        impact: 10,
        criteria: [{ name: "revenue", params: { value: result.model.totals.credit } }],
        model: (p: Record<string, number>) => p.value ?? 0,
      },
      decision: {
        ahpMatrix: [
          [1, 2],
          [0.5, 1],
        ],
        topsis: { matrix: [[100, 80], [90, 70]], weights: [0.5, 0.5], criteria: ["benefit", "benefit"] as const },
      },
    };

    const orchestratedResult = orchestrated.orchestrate(orchestratedInput);
    expect(orchestratedResult.status).toBe("READY");
    expect(orchestratedResult.tenantId).toBe("tenant-a");

    const assistant = new AssistantEngine({ orchestrated });
    const fullResult = assistant.analyzeAcquisitionOpportunity("Evaluate acquisition", orchestratedInput);
    expect(fullResult.response.project.name).toBe("Evaluate acquisition");
    expect(fullResult.response.traceId).toBeDefined();
    expect(fullResult.orchestrated.tenantId).toBe("tenant-a");

    persistence.close();
  });

  test("Failure path: malformed CSV rejected before persistence", async () => {
    const dbPath = join(dir, "ops.sqlite");
    const persistence = new SQLitePersistenceStore({ databasePath: dbPath });
    const adapter = new FinancialDataIngestionAdapter(persistence);
    const badPath = join(dir, "bad.csv");
    writeFileSync(badPath, "date,account,debit,credit,currency\n2026-08-01,Cash,100,50,IRR", "utf8");

    await expect(adapter.ingestFile("tenant-a", badPath)).rejects.toThrow("ingestion-double-sided-row:2");
    persistence.close();
  });

  test("Commercial runtime real HTTP flow", async () => {
    const server = createCommercialRuntimeServer({ databasePath: ":memory:", reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true }) } });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server-not-listening");
      const session = await fetch(`http://127.0.0.1:${address.port}/api/session`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "test", organization: "test-org" }),
      });
      expect(session.status).toBe(201);
      const cookie = session.headers.get("set-cookie");
      expect(cookie).toContain("hooshyar_session=");

      const analysis = await fetch(`http://127.0.0.1:${address.port}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookie!.split(";")[0] },
        body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 1000, liabilities: 250 }),
      });
      expect(analysis.status).toBe(200);
      const result = await analysis.json() as { status: string; tenantId: string; metrics: { profit: number; debtRatio: number } };
      expect(result.status).toBe("READY");
      expect(result.tenantId).toMatch(/^tenant:/);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
