'use strict';

/**
 * Shared acceptance-test fixture builder: a REAL image-only ("scanned") PDF.
 *
 * The lossless RGB pixels of a rendered ledger are embedded as a FlateDecode
 * image XObject. `pdf-parse.getText()` therefore extracts no text (the document
 * is genuinely image-only), while the canonical rasterizer renders genuine,
 * recognizable pixels for the admitted OCR provider. This is a test utility, not
 * product code, and it performs no network access.
 */
const { createRequire } = require('node:module');
const { join } = require('node:path');
const { deflateSync } = require('node:zlib');

const ROOT = join(__dirname, '..', '..');
const nodeRequire = createRequire(join(ROOT, 'package.json'));

function buildScannedPdf(rgbZlib, width, height) {
  const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  const contentBytes = Buffer.from(content, 'latin1');
  const contentsObject = Buffer.concat([
    Buffer.from(`<< /Length ${contentBytes.length} >>\nstream\n`, 'latin1'),
    contentBytes,
    Buffer.from('\nendstream', 'latin1'),
  ]);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
    contentsObject,
    Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${rgbZlib.length} >>\nstream\n`),
      rgbZlib,
      Buffer.from('\nendstream'),
    ]),
  ];
  const chunks = [];
  let offset = 0;
  const push = (value) => {
    const buffer = typeof value === 'string' ? Buffer.from(value, 'latin1') : value;
    chunks.push(buffer);
    offset += buffer.length;
  };
  push('%PDF-1.4\n');
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(offset);
    push(`${index + 1} 0 obj\n`);
    push(object);
    push('\nendobj\n');
  });
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

/** Render ledger lines into lossless RGB FlateDecode bytes. */
function renderLedgerRgb(lines, options) {
  const opts = options || {};
  const width = opts.width || 1000;
  const fontSize = opts.fontSize || 32;
  const lineHeight = opts.lineHeight || 45;
  const topMargin = opts.topMargin || 70;
  const height = topMargin + lines.length * (opts.rowHeight || 50);
  const canvas = nodeRequire('@napi-rs/canvas').createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.font = `${fontSize}px sans-serif`;
  lines.forEach((line, index) => ctx.fillText(line, 15, topMargin - 15 + index * lineHeight));
  const { data } = ctx.getImageData(0, 0, width, height);
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }
  return { rgbZlib: deflateSync(rgb), width, height };
}

/** A scanned PDF whose page renders the given ledger lines. */
function buildLedgerScannedPdf(lines) {
  const { rgbZlib, width, height } = renderLedgerRgb(lines);
  return buildScannedPdf(rgbZlib, width, height);
}

/**
 * A realistic scanned financial-statement page: a title line declaring the
 * document currency, a canonical statement header (date/description/debit/
 * credit plus a non-canonical running-balance column) and aligned
 * multi-thousand amount rows. This is deliberately NOT the synthetic
 * 5-column ledger CSV rendered as an image: it exercises the real
 * OCR -> structural/table normalization path.
 */
function financialStatementLines() {
  const pad = (value, width) => String(value).padEnd(width, ' ');
  return [
    'Bank Statement - Account 1234567890 (Currency: IRR)',
    pad('Date', 14) + pad('Description', 30) + pad('Debit', 20) + pad('Credit', 20) + 'Balance',
    pad('2024-01-15', 14) + pad('Opening deposit', 30) + pad('0.00', 20) + pad('500000.00', 20) + '500000.00',
    pad('2024-01-16', 14) + pad('Cash withdrawal', 30) + pad('120000.00', 20) + pad('0.00', 20) + '380000.00',
    pad('2024-01-17', 14) + pad('Customer payment', 30) + pad('0.00', 20) + pad('250000.00', 20) + '630000.00',
  ];
}

/** A scanned PDF whose page renders a realistic financial statement. */
function buildFinancialStatementScannedPdf() {
  const { rgbZlib, width, height } = renderLedgerRgb(financialStatementLines(), {
    width: 1600,
    fontSize: 30,
    lineHeight: 48,
    topMargin: 70,
    rowHeight: 52,
  });
  return buildScannedPdf(rgbZlib, width, height);
}

/** An image-only PDF with no recognizable text (solid black page). */
function buildBlankScannedPdf() {
  const width = 120;
  const height = 120;
  return buildScannedPdf(deflateSync(Buffer.alloc(width * height * 3, 0)), width, height);
}

/**
 * A realistic scanned MULTI-SECTION annual financial report: independent auditor
 * report, board report, statement of financial position, statement of profit or
 * loss, statement of cash flows and notes. It is rendered in English because the
 * admitted offline OCR engine reads the Latin script reliably at this size; the
 * Persian label/digit/unit handling is covered by the focused Jest fixtures and
 * the real Persian .xls/.xlsx statement workbooks.
 */
function financialReportLines() {
  return [
    "Independent Auditor's Report",
    "To the shareholders of Sample Company",
    "We have audited the financial statements for the year ended 1402.",
    "",
    "Board of Directors Report",
    "The Board presents the activities of the Company for the financial year.",
    "",
    "Statement of Financial Position",
    "(Figures in million IRR)",
    "Description 1402 1401",
    "Total current assets 465000 398000",
    "Total assets 1965000 1798000",
    "Total liabilities 820000 880000",
    "Total equity 1145000 918000",
    "",
    "Statement of Profit or Loss",
    "(Figures in million IRR)",
    "Description 1402 1401",
    "Revenue 2400000 2100000",
    "Cost of goods sold 1600000 1400000",
    "Gross profit 800000 700000",
    "Operating expenses 430000 400000",
    "Operating profit 370000 300000",
    "Net profit 220000 170000",
    "",
    "Statement of Cash Flows",
    "(Figures in million IRR)",
    "Description 1402 1401",
    "Net cash from operating activities 310000 250000",
    "Net cash from investing activities 180000 150000",
    "Net cash from financing activities 95000 40000",
    "",
    "Notes to the Financial Statements",
    "The reporting currency is IRR and amounts are stated in millions.",
  ];
}

/** A scanned PDF whose page renders the multi-section annual financial report. */
function buildFinancialReportScannedPdf() {
  const { rgbZlib, width, height } = renderLedgerRgb(financialReportLines(), {
    width: 1800,
    fontSize: 26,
    lineHeight: 40,
    topMargin: 60,
    rowHeight: 42,
  });
  return buildScannedPdf(rgbZlib, width, height);
}

module.exports = {
  buildScannedPdf,
  renderLedgerRgb,
  buildLedgerScannedPdf,
  buildFinancialStatementScannedPdf,
  financialStatementLines,
  buildBlankScannedPdf,
  financialReportLines,
  buildFinancialReportScannedPdf,
};
