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
function renderLedgerRgb(lines) {
  const width = 1000;
  const height = 70 + lines.length * 50;
  const canvas = nodeRequire('@napi-rs/canvas').createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.font = '32px sans-serif';
  lines.forEach((line, index) => ctx.fillText(line, 15, 55 + index * 45));
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

/** An image-only PDF with no recognizable text (solid black page). */
function buildBlankScannedPdf() {
  const width = 120;
  const height = 120;
  return buildScannedPdf(deflateSync(Buffer.alloc(width * height * 3, 0)), width, height);
}

module.exports = { buildScannedPdf, renderLedgerRgb, buildLedgerScannedPdf, buildBlankScannedPdf };
