/**
 * PDF ingestion acceptance (runs under the real Node/tsx runtime, not jest).
 *
 * The Jest VM cannot host pdf.js's worker, so this script qualifies the REAL
 * `pdf-parse` byte->text extraction end-to-end:
 *
 *   real text-native PDF bytes
 *     -> real HTTP POST /api/ingest (format PDF, contentBase64)
 *     -> canonical FinancialDataIngestionAdapter.ingestPdfBytes
 *     -> canonical financial model persisted under the ORIGINAL-byte SHA-256
 *     -> real HTTP POST /api/financial/analyze
 *     -> canonical Financial Intelligence Engine READY result;
 *
 * and the REAL scanned/image-only PDF path introduced by the admitted OCR
 * provider (tesseract.js + local language data):
 *
 *   real image-only PDF (no text layer)
 *     -> real HTTP POST /api/ingest
 *     -> canonical rasterizer (pdf-parse screenshots) per page
 *     -> canonical OcrAdapter (tesseract.js, fully offline) recognize
 *     -> OCR text normalized through the SAME canonical ledger pipeline
 *     -> canonical financial model persisted under the ORIGINAL-byte SHA-256
 *     -> real HTTP POST /api/financial/analyze -> READY;
 *   and an image-only PDF with no recognizable text fails closed precisely.
 *
 * No OCR is faked, no stub engine is used and no external network is used.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { createCommercialRuntimeServer } from "../Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer";

const nodeRequire = createRequire(join(resolve(__dirname, ".."), "package.json"));
const {
  buildLedgerScannedPdf,
  buildBlankScannedPdf,
} = nodeRequire("./scripts/lib/scanned-pdf-fixture.cjs") as {
  buildLedgerScannedPdf: (lines: string[]) => Buffer;
  buildBlankScannedPdf: () => Buffer;
};

function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(contentStream: string): Buffer {
  const contentBytes = Buffer.from(contentStream, "latin1");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contentBytes.length} >>\nstream\n${contentStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const chunks: Buffer[] = [];
  let offset = 0;
  const push = (value: string | Buffer) => {
    const buffer = typeof value === "string" ? Buffer.from(value, "latin1") : value;
    chunks.push(buffer);
    offset += buffer.length;
  };
  push("%PDF-1.4\n");
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(offset);
    push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

function buildTextPdf(lines: string[]): Buffer {
  const body = lines.map((line, index) => `${index === 0 ? "60 760 Td" : "0 -16 Td"} (${esc(line)}) Tj`).join("\n");
  return buildPdf(`BT\n/F1 11 Tf\n${body}\nET`);
}

function listen(server: Server): Promise<number> {
  return new Promise((resolvePort) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server-not-listening");
      resolvePort(address.port);
    });
  });
}

const close = (server: Server) => new Promise<void>((done) => server.close(() => done()));

async function main(): Promise<void> {
  const checks: string[] = [];
  const fail = (message: string): never => { throw new Error(message); };

  const server = createCommercialRuntimeServer({ databasePath: ":memory:", sessionSweepIntervalMs: 0 });
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;

  try {
    const register = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "pdf-e2e", organization: "PDF E2E", password: "Sup3rSecret!" }),
    });
    if (register.status !== 201) fail(`register failed: ${register.status}`);
    const cookie = (register.headers.get("set-cookie") ?? "").split(";")[0];
    if (!cookie) fail("session-cookie-missing");
    checks.push("register");

    const pdfCsv = [
      "date,account,debit,credit,currency",
      "2026-08-01,Cash,1000,0,IRR",
      "2026-08-01,Sales,0,1000,IRR",
      "2026-08-02,Receivable,250,0,IRR",
      "2026-08-02,Sales,0,250,IRR",
    ].join("\n");
    const pdfBytes = buildTextPdf(pdfCsv.split("\n"));
    const expectedSha = createHash("sha256").update(pdfBytes).digest("hex");

    const ingest = await fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "ledger.pdf", format: "PDF", contentBase64: pdfBytes.toString("base64") }),
    });
    const ingestBody = await ingest.json() as {
      evidence?: { sourceType?: string; sha256?: string };
      source?: { sha256?: string };
      totals?: { debit?: number; credit?: number };
      transactionCount?: number;
    };
    if (ingest.status !== 201) fail(`PDF ingest failed: ${ingest.status}:${JSON.stringify(ingestBody)}`);
    if (ingestBody.evidence?.sourceType !== "PDF") fail(`PDF sourceType not preserved: ${JSON.stringify(ingestBody.evidence)}`);
    if (ingestBody.evidence?.sha256 !== expectedSha) fail("PDF original-byte SHA-256 provenance mismatch");
    if (ingestBody.source?.sha256 !== expectedSha) fail("PDF raw-source SHA-256 mismatch");
    if (ingestBody.transactionCount !== 4) fail(`expected 4 transactions, got ${ingestBody.transactionCount}`);
    if (ingestBody.totals?.debit !== 1250 || ingestBody.totals?.credit !== 1250) fail(`unexpected totals: ${JSON.stringify(ingestBody.totals)}`);
    checks.push("pdf-ingest-201", "pdf-original-byte-provenance", "pdf-canonical-transactions");

    const analyze = await fetch(`${base}/api/financial/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: ingestBody.evidence.sha256, assets: 5000, liabilities: 1000 }),
    });
    const analyzeBody = await analyze.json() as {
      status?: string;
      targetEngine?: string;
      metrics?: { profit?: number; debtRatio?: number };
      ingestedSource?: { sourceType?: string; transactionCount?: number };
    };
    if (analyze.status !== 200 || analyzeBody.status !== "READY") fail(`PDF analysis failed: ${analyze.status}:${JSON.stringify(analyzeBody)}`);
    if (analyzeBody.targetEngine !== "Financial Intelligence Engine") fail(`unexpected engine: ${analyzeBody.targetEngine}`);
    if (analyzeBody.ingestedSource?.sourceType !== "PDF" || analyzeBody.ingestedSource?.transactionCount !== 4) fail("PDF ingested source not carried into analysis");
    if (analyzeBody.metrics?.profit !== 0 || analyzeBody.metrics?.debtRatio !== 0.2) fail(`unexpected metrics: ${JSON.stringify(analyzeBody.metrics)}`);
    checks.push("pdf-financial-analysis-ready");

    const scannedLines = pdfCsv.split("\n");
    const scanned = buildLedgerScannedPdf(scannedLines);
    const scannedSha = createHash("sha256").update(scanned).digest("hex");
    const scannedIngest = await fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "scan.pdf", format: "PDF", contentBase64: scanned.toString("base64") }),
    });
    const scannedBody = await scannedIngest.json() as {
      error?: string;
      evidence?: { sourceType?: string; sha256?: string; ocr?: { ocrEngine?: string; ocrLanguage?: string; ocrConfidence?: number | null } };
      source?: { sha256?: string };
      totals?: { debit?: number; credit?: number };
      transactionCount?: number;
    };
    if (scannedIngest.status !== 201) fail(`scanned PDF OCR ingest failed: ${scannedIngest.status}:${JSON.stringify(scannedBody)}`);
    if (scannedBody.evidence?.sourceType !== "PDF") fail(`scanned PDF sourceType not preserved: ${JSON.stringify(scannedBody.evidence)}`);
    if (scannedBody.evidence?.sha256 !== scannedSha) fail("scanned PDF original-byte SHA-256 provenance mismatch");
    if (scannedBody.transactionCount !== 4) fail(`expected 4 OCR transactions, got ${scannedBody.transactionCount}`);
    if (scannedBody.totals?.debit !== 1250 || scannedBody.totals?.credit !== 1250) fail(`unexpected OCR totals: ${JSON.stringify(scannedBody.totals)}`);
    const scannedOcr = scannedBody.evidence?.ocr;
    if (scannedOcr?.ocrEngine !== "tesseract.js") fail(`OCR engine not recorded: ${JSON.stringify(scannedOcr)}`);
    if (scannedOcr?.ocrLanguage !== "fas+eng") fail(`OCR language not recorded: ${JSON.stringify(scannedOcr)}`);
    if (!(typeof scannedOcr?.ocrConfidence === "number" && (scannedOcr.ocrConfidence ?? 0) > 0)) {
      fail(`OCR confidence not measured: ${JSON.stringify(scannedOcr)}`);
    }
    checks.push("scanned-pdf-ocr-201", "scanned-pdf-original-byte-provenance", "scanned-pdf-ocr-provenance", "scanned-pdf-canonical-transactions");

    const scannedAnalyze = await fetch(`${base}/api/financial/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceSha256: scannedBody.evidence.sha256, assets: 5000, liabilities: 1000 }),
    });
    const scannedAnalyzeBody = await scannedAnalyze.json() as {
      status?: string;
      targetEngine?: string;
      ingestedSource?: { sourceType?: string; transactionCount?: number };
      metrics?: { profit?: number; debtRatio?: number };
    };
    if (scannedAnalyze.status !== 200 || scannedAnalyzeBody.status !== "READY") fail(`scanned PDF analysis failed: ${scannedAnalyze.status}:${JSON.stringify(scannedAnalyzeBody)}`);
    if (scannedAnalyzeBody.ingestedSource?.transactionCount !== 4) fail("scanned PDF source not carried into analysis");
    if (scannedAnalyzeBody.metrics?.profit !== 0 || scannedAnalyzeBody.metrics?.debtRatio !== 0.2) fail(`unexpected scanned metrics: ${JSON.stringify(scannedAnalyzeBody.metrics)}`);
    checks.push("scanned-pdf-financial-analysis-ready");

    const blankScanned = buildBlankScannedPdf();
    const blankIngest = await fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ sourceName: "blank-scan.pdf", format: "PDF", contentBase64: blankScanned.toString("base64") }),
    });
    const blankBody = await blankIngest.json() as { error?: string };
    if (blankIngest.status !== 422 || blankBody.error !== "ingestion-ocr-empty") {
      fail(`blank scanned PDF did not fail closed precisely: ${blankIngest.status}:${JSON.stringify(blankBody)}`);
    }
    checks.push("blank-scanned-pdf-precise-fail-closed");

    const evidence = {
      type: "PDF_INGESTION_ACCEPTANCE",
      version: 2,
      status: "PASS",
      createdAt: new Date().toISOString(),
      runtime: "real-node-tsx",
      pdfTextSupported: true,
      scannedPdfOcrSupported: true,
      ocrClaimed: true,
      ocrEngine: scannedOcr?.ocrEngine,
      ocrLanguage: scannedOcr?.ocrLanguage,
      checks,
      originalSha256: expectedSha,
      transactionCount: ingestBody.transactionCount,
      analyzedEngine: analyzeBody.targetEngine,
      scannedSha256: scannedSha,
      scannedTransactionCount: scannedBody.transactionCount,
      scannedConfidence: scannedOcr?.ocrConfidence,
      blankScannedErrorCode: blankBody.error,
    };
    mkdirSync(resolve(process.cwd(), ".hooshyar"), { recursive: true });
    writeFileSync(resolve(process.cwd(), ".hooshyar", "pdf-ingestion-acceptance.json"), JSON.stringify(evidence, null, 2), "utf8");
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await close(server);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    type: "PDF_INGESTION_ACCEPTANCE",
    status: "BLOCKED",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
