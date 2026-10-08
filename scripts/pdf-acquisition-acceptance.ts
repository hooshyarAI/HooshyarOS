/**
 * K8 — Real PDF acquisition acceptance (runs under the real Node runtime, not jest).
 *
 * The jest environment cannot host pdf.js's worker ("A dynamic import callback
 * was invoked without --experimental-vm-modules"), so the real `pdf-parse`
 * behavior is qualified here against the canonical Stage 08-DOC.2 owner.
 *
 * Proves:
 *   - a real text-native PDF yields extracted text and canonical transactions
 *     (it is NOT misclassified as scanned);
 *   - an image-only page fails closed with the precise scanned limitation at
 *     the acquisition boundary (the runtime composition service routes scanned
 *     PDFs to the admitted OCR path, qualified separately);
 *   - no OCR is faked and no unsupported PDF claim is made here.
 *
 * This script qualifies the `PdfAcquisition` boundary only. Runtime PDF
 * ingestion and the real scanned-PDF OCR path are qualified end-to-end by
 * `scripts/pdf-ingestion-acceptance.ts`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { acquirePdf, detectPdfMagic, PDF_ERROR_CODES } from "../Backend/HBOS/Product/PdfAcquisition";
import { detectTables, mapTableToCanonical } from "../Backend/HBOS/Product/DocumentTableExtractor";

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

async function main() {
  const checks: string[] = [];
  const fail = (message: string): never => {
    throw new Error(message);
  };

  const lines = [
    "Financial Statement Ledger",
    "date | account | debit | credit | currency",
    "2026-08-01 | Cash | 1000 | 0 | IRR",
    "2026-08-01 | Sales | 0 | 1000 | IRR",
    "2026-08-02 | Receivable | 250 | 0 | IRR",
    "2026-08-02 | Sales | 0 | 250 | IRR",
  ];
  const textPdf = buildTextPdf(lines);
  if (!detectPdfMagic(textPdf)) fail("text PDF magic not detected");
  checks.push("text-pdf-magic");

  const document = await acquirePdf({ sourceName: "statement.pdf", rawBytes: textPdf });
  if (document.pageCount < 1) fail(`expected >=1 page, got ${document.pageCount}`);
  if (document.averageCharsPerPage < 50) fail(`text PDF misclassified as scanned (avg ${document.averageCharsPerPage})`);
  if (!document.text.includes("Financial Statement Ledger")) fail("extracted text missing ledger header");
  if (!/^[0-9a-f]{64}$/.test(document.sha256)) fail("sha256 not canonical");
  checks.push("text-pdf-extracted", "text-pdf-not-scanned", "text-pdf-provenance");

  const tables = detectTables(document.text);
  if (tables.length < 1) fail("no table detected in extracted text");
  const transactions = mapTableToCanonical(tables[0]);
  if (transactions.length !== 4) fail(`expected 4 canonical transactions, got ${transactions.length}`);
  checks.push("text-pdf-canonical-table");

  const imageOnlyPdf = buildPdf("0 0 200 200 re f");
  let scannedCode = "NONE";
  try {
    await acquirePdf({ sourceName: "scan.pdf", rawBytes: imageOnlyPdf });
  } catch (error) {
    scannedCode = error instanceof Error ? error.message : String(error);
  }
  if (scannedCode !== PDF_ERROR_CODES.SCANNED) fail(`image-only PDF did not fail closed precisely: ${scannedCode}`);
  checks.push("scanned-pdf-precise-limitation");

  const evidence = {
    type: "PDF_ACQUISITION_ACCEPTANCE",
    version: 2,
    status: "PASS",
    createdAt: new Date().toISOString(),
    scope: "PdfAcquisition text-native extraction boundary",
    runtimePdfSupportClaimed: true,
    runtimePdfQualifiedBy: "scripts/pdf-ingestion-acceptance.ts",
    ocrClaimed: false,
    ocrQualifiedBy: "scripts/pdf-ingestion-acceptance.ts",
    checks,
    pageCount: document.pageCount,
    averageCharsPerPage: document.averageCharsPerPage,
    transactionCount: transactions.length,
    scannedErrorCode: scannedCode,
  };
  mkdirSync(resolve(process.cwd(), ".hooshyar"), { recursive: true });
  writeFileSync(resolve(process.cwd(), ".hooshyar", "pdf-acquisition-acceptance.json"), JSON.stringify(evidence, null, 2), "utf8");
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ type: "PDF_ACQUISITION_ACCEPTANCE", status: "BLOCKED", error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
