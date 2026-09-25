const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { createHash } = require('node:crypto');
const { isSessionRateLimitedPost, createSessionRateLimitPacer } = require('./session-rate-limit-pacer.cjs');

const root = process.cwd();
const port = Number(process.env.HOOSHYAR_WEB_ACCEPTANCE_PORT ?? '4174');
const db = path.join(root, 'data', 'web-acceptance.sqlite');
const evidenceDir = path.join(root, '.hooshyar');
const evidencePath = path.join(evidenceDir, 'web-acceptance-success.json');
const node = process.execPath;
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const runtimeEntrypoint = path.join(root, 'Backend', 'HBOS', 'Autonomous', 'Runtime', 'start-commercial-runtime.ts');
const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : undefined;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Mirrors the canonical runtime's per-session token bucket (capacity 5,
// refill 1/s) so this QA client never exceeds the documented contract
// regardless of machine speed. See scripts/session-rate-limit-pacer.cjs.
const sessionPacer = createSessionRateLimitPacer();
function gitCommit() { try { return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'UNKNOWN'; } }

async function createXlsxBase64() {
  const ExcelJS = require('exceljs-hardened');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Transactions');
  worksheet.addRow(['date', 'account', 'debit', 'credit', 'currency']);
  worksheet.addRow(['2026-08-05', 'Cash', 500, 0, 'IRR']);
  worksheet.addRow(['2026-08-05', 'Sales', 0, 1000, 'IRR']);
  worksheet.addRow(['2026-08-06', 'Receivable', 0, 500, 'IRR']);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

// Deterministic, dependency-free text-native PDF builder for the real PDF
// ingestion acceptance. No external fixture/network is required.
function escPdf(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function buildPdf(contentStream) {
  const contentBytes = Buffer.from(contentStream, 'latin1');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contentBytes.length} >>\nstream\n${contentStream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const chunks = [];
  let offset = 0;
  const push = (value) => { const buffer = typeof value === 'string' ? Buffer.from(value, 'latin1') : value; chunks.push(buffer); offset += buffer.length; };
  push('%PDF-1.4\n');
  const offsets = [];
  objects.forEach((object, index) => { offsets.push(offset); push(`${index + 1} 0 obj\n${object}\nendobj\n`); });
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.concat(chunks);
}
function buildTextPdf(lines) {
  const body = lines.map((line, index) => `${index === 0 ? '60 760 Td' : '0 -16 Td'} (${escPdf(line)}) Tj`).join('\n');
  return buildPdf(`BT\n/F1 11 Tf\n${body}\nET`);
}

// Real scanned/image-only PDF fixtures (shared with the PDF ingestion
// acceptance): the page is an image XObject with no text layer, so the runtime
// must rasterize and OCR it through the admitted tesseract.js provider.
const { buildLedgerScannedPdf, buildBlankScannedPdf } = require(path.join(root, 'scripts', 'lib', 'scanned-pdf-fixture.cjs'));

async function waitHealth(child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.spawnError) throw new Error(`WEB_ACCEPTANCE_RUNTIME_SPAWN_ERROR:${child.spawnError.message}`);
    if (child.exitCode !== null) throw new Error(`WEB_ACCEPTANCE_RUNTIME_EXITED_BEFORE_HEALTH:code=${child.exitCode}`);
    if (child.signalCode) throw new Error(`WEB_ACCEPTANCE_RUNTIME_SIGNALED_BEFORE_HEALTH:${child.signalCode}`);
    try { const response = await fetch(`http://127.0.0.1:${port}/health`); if (response.ok && (await response.json()).status === 'ok') return; } catch {}
    await sleep(250);
  }
  throw new Error(`WEB_ACCEPTANCE_HEALTH_TIMEOUT:port=${port}`);
}
async function request(pathname, options = {}) { if (isSessionRateLimitedPost(pathname, options.method)) await sessionPacer.acquire(); const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options); const text = await response.text(); let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; } return { status: response.status, body, setCookie: response.headers.get('set-cookie') || '' }; }
function spawnRuntime() {
  const child = spawn(node, [tsxCli, runtimeEntrypoint], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], shell: false, windowsHide: true, env: { ...process.env, HOOSHYAR_HOST: '127.0.0.1', HOOSHYAR_PORT: String(port), HOOSHYAR_DB_PATH: db } });
  child.spawnError = null;
  child.on('error', (error) => { child.spawnError = error; });
  return child;
}
async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  try { fs.rmSync(evidencePath, { force: true }); } catch {}
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`WEB_ACCEPTANCE_INVALID_PORT:${port}`);
  if (!fs.existsSync(tsxCli)) throw new Error(`WEB_ACCEPTANCE_LAUNCHER_MISSING:${tsxCli}`);
  if (!fs.existsSync(runtimeEntrypoint)) throw new Error(`WEB_ACCEPTANCE_ENTRYPOINT_MISSING:${runtimeEntrypoint}`);
  fs.mkdirSync(path.dirname(db), { recursive: true });
  const child = spawnRuntime();
  const stop = async () => { if (child.exitCode === null && !child.signalCode) { if (process.platform === 'win32') { try { cp.execFileSync(shell, ['/d','/s','/c',`taskkill /PID ${child.pid} /T /F`], { cwd: root, stdio: 'ignore' }); } catch {} } else child.kill('SIGTERM'); await sleep(500); } try { fs.rmSync(db, { force: true }); } catch {} };
  try {
    await waitHealth(child);
    const rootPage = await fetch(`http://127.0.0.1:${port}/`);
    if (!rootPage.ok || !(await rootPage.text()).includes('هوشیار.ai')) throw new Error('WEB_ACCEPTANCE_ROOT_FAILED');
    const session = await request('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'web-qa', organization: 'Hooshyar Web QA' }) });
    if (session.status !== 201 || !session.body.tenantId || !session.setCookie) throw new Error(`WEB_ACCEPTANCE_SESSION_FAILED:${session.status}`);
    const cookie = session.setCookie.split(';')[0];
    const csv = ['date,account,debit,credit,currency','2026-08-01,Cash,1000,0,IRR','2026-08-02,Sales,0,1500,IRR','2026-08-03,Expense,300,0,IRR','2026-08-04,Receivable,0,800,IRR'].join('\n');
    const analysis = await request('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ csv, sourceName: 'web-qa.csv', assets: 10000, liabilities: 4000 }) });
    if (analysis.status !== 200 || analysis.body.status !== 'READY' || analysis.body.metrics.profit !== 1000) throw new Error(`WEB_ACCEPTANCE_ANALYSIS_FAILED:${analysis.status}`);
    const executive = await request('/api/executive/workbench', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ targets: { revenue: 2000, profit: 1200, profitMargin: 0.3, debtRatio: 0.25 } }) });
    if (executive.status !== 200 || executive.body.status !== 'READY' || !Array.isArray(executive.body.recommendations) || executive.body.recommendations.length !== 4) throw new Error(`WEB_ACCEPTANCE_EXECUTIVE_FAILED:${executive.status}`);
    const report = await request('/api/report', { headers: { cookie } });
    if (report.status !== 200 || report.body.status !== 'READY' || !Array.isArray(report.body.sections) || report.body.sections.length < 7) throw new Error(`WEB_ACCEPTANCE_REPORT_FAILED:${report.status}`);
    const assistant = await request('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ question: 'وضعیت سود و درآمد من چیست؟' }) });
    if (assistant.status !== 200 || assistant.body.status !== 'READY' || typeof assistant.body.answer !== 'string' || !assistant.body.answer.includes('1000')) throw new Error(`WEB_ACCEPTANCE_ASSISTANT_FAILED:${assistant.status}`);
    const dashboard = await request('/api/dashboard', { headers: { cookie } });
    if (dashboard.status !== 200 || dashboard.body.analysisAvailable !== true || dashboard.body.metrics.profit !== 1000 || dashboard.body.executiveIntelligence?.status !== 'READY') throw new Error(`WEB_ACCEPTANCE_DASHBOARD_FAILED:${JSON.stringify(dashboard.body)}`);

    // Phase 14: governed multi-format ingestion through the canonical runtime path.
    const structured = JSON.stringify({ transactions: [
      { date: '2026-08-05', account: 'Cash', debit: 700, credit: 0, currency: 'IRR' },
      { date: '2026-08-05', account: 'Sales', debit: 0, credit: 700, currency: 'IRR' }
    ]});
    const structuredIngest = await request('/api/ingest', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceName: 'web-qa.json', format: 'STRUCTURED', content: structured }) });
    if (structuredIngest.status !== 201 || structuredIngest.body.evidence?.sourceType !== 'STRUCTURED' || structuredIngest.body.source?.persisted !== true) throw new Error(`WEB_ACCEPTANCE_STRUCTURED_INGEST_FAILED:${structuredIngest.status}`);
    const structuredAnalysis = await request('/api/financial/analyze', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceSha256: structuredIngest.body.evidence.sha256, assets: 10000, liabilities: 4000 }) });
    if (structuredAnalysis.status !== 200 || structuredAnalysis.body.status !== 'READY' || structuredAnalysis.body.targetEngine !== 'Financial Intelligence Engine') throw new Error(`WEB_ACCEPTANCE_STRUCTURED_ANALYSIS_FAILED:${structuredAnalysis.status}`);

    const xlsxIngest = await request('/api/ingest', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceName: 'web-qa.xlsx', format: 'XLSX', contentBase64: await createXlsxBase64() }) });
    if (xlsxIngest.status !== 201 || xlsxIngest.body.evidence?.sourceType !== 'XLSX' || xlsxIngest.body.totals?.debit !== 500 || xlsxIngest.body.totals?.credit !== 1500) throw new Error(`WEB_ACCEPTANCE_XLSX_INGEST_FAILED:${xlsxIngest.status}`);
    const xlsxAnalysis = await request('/api/financial/analyze', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceSha256: xlsxIngest.body.evidence.sha256, assets: 10000, liabilities: 4000 }) });
    if (xlsxAnalysis.status !== 200 || xlsxAnalysis.body.ingestedSource?.sourceType !== 'XLSX' || xlsxAnalysis.body.metrics?.profit !== 1000) throw new Error(`WEB_ACCEPTANCE_XLSX_ANALYSIS_FAILED:${xlsxAnalysis.status}`);

    // PDF capability: a real text-native PDF must ingest through the canonical
    // runtime and reach canonical financial analysis; a real scanned/image-only
    // PDF must be rasterized and OCR'd (offline tesseract.js) into the same
    // canonical model, and an image-only PDF with no recognizable text must
    // fail closed precisely (never as CSV, never offline).
    const pdfCsv = ['date,account,debit,credit,currency', '2026-08-07,Cash,400,0,IRR', '2026-08-07,Sales,0,400,IRR'].join('\n');
    const pdfBytes = buildTextPdf(pdfCsv.split('\n'));
    const pdfSha = createHash('sha256').update(pdfBytes).digest('hex');
    await sleep(1100);
    const pdfIngest = await request('/api/ingest', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceName: 'web-qa.pdf', format: 'PDF', contentBase64: pdfBytes.toString('base64') }) });
    if (pdfIngest.status !== 201 || pdfIngest.body.evidence?.sourceType !== 'PDF' || pdfIngest.body.source?.sha256 !== pdfSha) throw new Error(`WEB_ACCEPTANCE_PDF_INGEST_FAILED:${pdfIngest.status}:${JSON.stringify(pdfIngest.body)}`);
    await sleep(1100);
    const pdfAnalysis = await request('/api/financial/analyze', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceSha256: pdfIngest.body.evidence.sha256, assets: 10000, liabilities: 4000 }) });
    if (pdfAnalysis.status !== 200 || pdfAnalysis.body.status !== 'READY' || pdfAnalysis.body.ingestedSource?.sourceType !== 'PDF') throw new Error(`WEB_ACCEPTANCE_PDF_ANALYSIS_FAILED:${pdfAnalysis.status}:${JSON.stringify(pdfAnalysis.body)}`);

    const scannedBytes = buildLedgerScannedPdf(pdfCsv.split('\n'));
    const scannedSha = createHash('sha256').update(scannedBytes).digest('hex');
    await sleep(1100);
    const scannedPdfIngest = await request('/api/ingest', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceName: 'web-qa-scan.pdf', format: 'PDF', contentBase64: scannedBytes.toString('base64') }) });
    if (scannedPdfIngest.status !== 201 || scannedPdfIngest.body.evidence?.sha256 !== scannedSha || scannedPdfIngest.body.transactionCount !== 2) throw new Error(`WEB_ACCEPTANCE_SCANNED_PDF_OCR_FAILED:${scannedPdfIngest.status}:${JSON.stringify(scannedPdfIngest.body)}`);
    if (scannedPdfIngest.body.evidence?.ocr?.ocrEngine !== 'tesseract.js') throw new Error(`WEB_ACCEPTANCE_SCANNED_PDF_OCR_PROVENANCE_FAILED:${JSON.stringify(scannedPdfIngest.body.evidence?.ocr)}`);
    await sleep(1100);
    const blankScannedIngest = await request('/api/ingest', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceName: 'web-qa-blank-scan.pdf', format: 'PDF', contentBase64: buildBlankScannedPdf().toString('base64') }) });
    if (blankScannedIngest.status !== 422 || blankScannedIngest.body.error !== 'ingestion-ocr-empty') throw new Error(`WEB_ACCEPTANCE_SCANNED_PDF_BOUNDARY_FAILED:${blankScannedIngest.status}:${JSON.stringify(blankScannedIngest.body)}`);

    // K8: real browser offline transport against the real runtime — network loss
    // queues work durably, reload preserves it, reconnect synchronizes it, and a
    // storage-quota failure can never masquerade as offline.
    const offlineClient = require(path.join(root, 'web', 'offline-sync.js'));
    const runtimeFetch = async (url, init = {}) => { if (isSessionRateLimitedPost(url, init.method)) await sessionPacer.acquire(); return fetch(`http://127.0.0.1:${port}${url}`, { ...init, headers: { ...(init.headers || {}), cookie } }); };
    let browserOnline = false;
    const flakyFetch = (url, init) => (browserOnline ? runtimeFetch(url, init) : Promise.reject(new TypeError('Failed to fetch')));
    const offlineStorage = offlineClient.memoryStorage();
    const offlineSync = offlineClient.createOfflineSync({ storage: offlineStorage, fetchImpl: flakyFetch });
    await offlineSync.enqueue({ sourceName: 'web-qa-offline.csv', format: 'CSV', content: csv });
    const offlineReport = await offlineSync.sync();
    if (offlineReport.status !== 'OFFLINE' || offlineReport.pending !== 1) throw new Error(`WEB_ACCEPTANCE_OFFLINE_QUEUE_FAILED:${JSON.stringify(offlineReport)}`);
    const offlineReload = offlineClient.createOfflineSync({ storage: offlineStorage, fetchImpl: flakyFetch });
    if ((await offlineReload.pending()).length !== 1) throw new Error('WEB_ACCEPTANCE_OFFLINE_RELOAD_FAILED');
    browserOnline = true;
    await sleep(1100);
    const onlineReport = await offlineSync.sync();
    if (onlineReport.status !== 'ONLINE' || onlineReport.pending !== 0 || onlineReport.synced.length !== 1) throw new Error(`WEB_ACCEPTANCE_OFFLINE_RECONNECT_FAILED:${JSON.stringify(onlineReport)}`);
    if ((await offlineClient.createOfflineSync({ storage: offlineStorage, fetchImpl: flakyFetch }).pending()).length !== 0) throw new Error('WEB_ACCEPTANCE_OFFLINE_DRAIN_FAILED');

    const quotaBase = offlineClient.memoryStorage();
    let quotaBlocked = false;
    const quotaStorage = {
      getItem: key => quotaBase.getItem(key),
      removeItem: key => quotaBase.removeItem(key),
      setItem: (key, value) => {
        if (quotaBlocked) {
          const error = new Error(`Setting the value of '${key}' exceeded the quota.`);
          error.name = 'QuotaExceededError';
          throw error;
        }
        quotaBase.setItem(key, value);
      }
    };
    const quotaSync = offlineClient.createOfflineSync({ storage: quotaStorage, fetchImpl: runtimeFetch });
    await quotaSync.enqueue({ sourceName: 'quota-kept.csv', format: 'CSV', content: csv });
    quotaBlocked = true;
    let quotaKind = 'NONE';
    try {
      await quotaSync.enqueue({ sourceName: 'quota-blocked.csv', format: 'CSV', content: csv });
    } catch (error) {
      quotaKind = offlineClient.classifyFailure(error);
    }
    if (quotaKind !== 'STORAGE_QUOTA_FAILURE' || offlineClient.isConnectivityFailure(quotaKind)) throw new Error(`WEB_ACCEPTANCE_QUOTA_MASQUERADE_FAILED:${quotaKind}`);
    quotaBlocked = false;
    if ((await quotaSync.pending()).length !== 1) throw new Error('WEB_ACCEPTANCE_QUOTA_LOSS_FAILED');

    const sources = await request('/api/sources', { headers: { cookie } });
    if (sources.status !== 200 || !Array.isArray(sources.body.sources) || sources.body.sources.length < 3) throw new Error(`WEB_ACCEPTANCE_SOURCES_FAILED:${sources.status}`);

    // Layer 5: financial analytics composition over the canonical ingested source.
    // The runtime intentionally correlates report/assistant context to the same
    // analyzed source SHA-256. Re-select structuredIngest as the active analysis
    // source before exercising analytics/report composition; otherwise later PDF
    // acceptance fixtures would make a correct source-isolation guard look broken.
    await sleep(1100);
    const structuredSourceAnalysis = await request('/api/financial/analyze', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceSha256: structuredIngest.body.evidence.sha256, assets: 10000, liabilities: 4000 }) });
    if (structuredSourceAnalysis.status !== 200 || structuredSourceAnalysis.body.status !== 'READY' || structuredSourceAnalysis.body.source?.sha256 !== structuredIngest.body.evidence.sha256) throw new Error(`WEB_ACCEPTANCE_ANALYTICS_SOURCE_RESELECT_FAILED:${structuredSourceAnalysis.status}:${JSON.stringify(structuredSourceAnalysis.body)}`);
    await sleep(1100);
    const analytics = await request('/api/financial/insights', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ sourceSha256: structuredIngest.body.evidence.sha256, breakEven: { fixedCosts: 1000, variableCostPerUnit: 5, pricePerUnit: 10, unitsSold: 300 } }) });
    if (analytics.status !== 200 || analytics.body.status !== 'READY' || analytics.body.capabilityId !== 'product.financial-analytics' || analytics.body.targetEngine !== 'Financial Intelligence Engine' || analytics.body.breakEven?.breakEvenUnits !== 200 || !Array.isArray(analytics.body.anomalies?.zscore?.points) || analytics.body.source?.sha256 !== structuredIngest.body.evidence.sha256) throw new Error(`WEB_ACCEPTANCE_ANALYTICS_FAILED:${analytics.status}:${JSON.stringify(analytics.body)}`);
    const analyticsLatest = await request('/api/financial/insights/latest', { headers: { cookie } });
    if (analyticsLatest.status !== 200 || analyticsLatest.body.capabilityId !== 'product.financial-analytics' || analyticsLatest.body.tenantId !== session.body.tenantId) throw new Error(`WEB_ACCEPTANCE_ANALYTICS_LATEST_FAILED:${analyticsLatest.status}`);
    const enrichedReport = await request('/api/report', { headers: { cookie } });
    if (enrichedReport.status !== 200 || !enrichedReport.body.sections.some(section => section.includes('Financial analytics:'))) throw new Error(`WEB_ACCEPTANCE_ANALYTICS_REPORT_FAILED:${enrichedReport.status}`);

    // Layer 9: real report file export, persistence and secure download.
    const reportExport = await request('/api/report/export', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ format: 'XLSX' }) });
    if (reportExport.status !== 201 || reportExport.body.status !== 'READY' || reportExport.body.capabilityId !== 'product.reports-export' || reportExport.body.targetEngine !== 'Reports Engine' || reportExport.body.artifact?.format !== 'XLSX' || reportExport.body.artifact?.contentType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || typeof reportExport.body.artifact?.sha256 !== 'string' || reportExport.body.artifact.sha256.length !== 64 || !(reportExport.body.artifact.byteLength > 1000) || reportExport.body.artifact?.provenance?.verificationStatus !== 'VERIFIED') throw new Error(`WEB_ACCEPTANCE_REPORT_EXPORT_FAILED:${reportExport.status}:${JSON.stringify(reportExport.body)}`);
    const reportDownload = await fetch(`http://127.0.0.1:${port}${reportExport.body.downloadUrl}`, { headers: { cookie } });
    if (!reportDownload.ok || reportDownload.headers.get('content-type') !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || !String(reportDownload.headers.get('content-disposition') || '').startsWith('attachment;') || reportDownload.headers.get('x-artifact-sha256') !== reportExport.body.artifact.sha256) throw new Error(`WEB_ACCEPTANCE_REPORT_DOWNLOAD_FAILED:${reportDownload.status}`);
    const reportBytes = Buffer.from(await reportDownload.arrayBuffer());
    if (reportBytes.length !== reportExport.body.artifact.byteLength || reportBytes[0] !== 0x50 || reportBytes[1] !== 0x4b) throw new Error(`WEB_ACCEPTANCE_REPORT_ARTIFACT_INVALID:${reportBytes.length}`);
    const artifactList = await request('/api/report/artifacts', { headers: { cookie } });
    if (artifactList.status !== 200 || !Array.isArray(artifactList.body.artifacts) || !artifactList.body.artifacts.some(entry => entry.artifactId === reportExport.body.artifact.artifactId)) throw new Error(`WEB_ACCEPTANCE_REPORT_ARTIFACT_LIST_FAILED:${artifactList.status}`);

    // Decision / Expert Choice: explainable multi-criteria evaluation through the real runtime.
    const decision = await request('/api/decision/workbench', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({
      problem: 'انتخاب طرح توسعه',
      alternatives: ['طرح الف', 'طرح ب'],
      criteria: [
        { name: 'profit', weight: 0.6, direction: 'benefit' },
        { name: 'risk', weight: 0.4, direction: 'cost' }
      ],
      scores: [[8, 4], [6, 3]],
      pairwiseMatrix: [[1, 3], [1 / 3, 1]]
    }) });
    if (decision.status !== 200 || decision.body.status !== 'READY' || decision.body.recommendation?.alternative !== 'طرح الف' || decision.body.weightsSource !== 'AHP' || decision.body.consistency?.consistent !== true) throw new Error(`WEB_ACCEPTANCE_DECISION_FAILED:${decision.status}:${JSON.stringify(decision.body)}`);
    const decisionLatest = await request('/api/decision/latest', { headers: { cookie } });
    if (decisionLatest.status !== 200 || decisionLatest.body.recommendation?.alternative !== 'طرح الف') throw new Error(`WEB_ACCEPTANCE_DECISION_LATEST_FAILED:${decisionLatest.status}`);

    // Layer 8: governed organizational execution through the real runtime.
    // Spacing mutations lets the production token bucket refill naturally.
    const executionMutation = async (pathname, body) => { await sleep(1100); return request(pathname, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) }); };
    const proposed = await executionMutation('/api/execution/work-items', { title: 'اجرای طرح توسعه', description: 'work from approved decision', priority: 'HIGH' });
    if (proposed.status !== 200 || proposed.body.status !== 'AWAITING_APPROVAL' || proposed.body.decision?.recommendation !== 'طرح الف' || proposed.body.approval !== null) throw new Error(`WEB_ACCEPTANCE_EXECUTION_PROPOSE_FAILED:${proposed.status}:${JSON.stringify(proposed.body)}`);
    const workItemId = proposed.body.workItemId;
    const approveUrl = `/api/execution/work-items/${encodeURIComponent(workItemId)}/approve`;
    const approved = await executionMutation(approveUrl, { comments: 'تأیید انسانی برای اجرا' });
    if (approved.status !== 200 || approved.body.status !== 'APPROVED' || approved.body.approval?.authority !== 'APPROVE' || approved.body.approval?.tenantId !== session.body.tenantId || approved.body.approval?.decisionArtifactKey !== 'decision-workbench:latest' || approved.body.workflow?.status !== 'READY') throw new Error(`WEB_ACCEPTANCE_EXECUTION_APPROVE_FAILED:${approved.status}:${JSON.stringify(approved.body)}`);
    const assigned = await executionMutation(`/api/execution/work-items/${encodeURIComponent(workItemId)}/assign`, { assigneeId: 'qa-ops-lead', dueDate: '2026-12-01T00:00:00.000Z' });
    if (assigned.status !== 200 || assigned.body.status !== 'ASSIGNED' || assigned.body.assignment?.assigneeId !== 'qa-ops-lead' || assigned.body.dueDate !== '2026-12-01T00:00:00.000Z') throw new Error(`WEB_ACCEPTANCE_EXECUTION_ASSIGN_FAILED:${assigned.status}`);
    const started = await executionMutation(`/api/execution/work-items/${encodeURIComponent(workItemId)}/start`, {});
    if (started.status !== 200 || started.body.status !== 'IN_PROGRESS') throw new Error(`WEB_ACCEPTANCE_EXECUTION_START_FAILED:${started.status}`);
    const completed = await executionMutation(`/api/execution/work-items/${encodeURIComponent(workItemId)}/complete`, {
      kpi: { metric: 'revenue', target: 1000, actual: 1150, unit: 'IRR', series: [800, 950, 1150] },
      evidence: [{ id: 'EV-ACCEPT', type: 'EXECUTION_MEMO', description: 'acceptance evidence', sha256: 'c'.repeat(64) }],
      feedback: {
        result: 'DELIVERED',
        notes: 'acceptance feedback',
        metrics: {
          before: { cycleTime: 10, throughput: 50, errorRate: 0.1, capacity: 100, cost: 500 },
          after: { cycleTime: 8, throughput: 62, errorRate: 0.05, capacity: 120, cost: 450 }
        }
      }
    });
    if (completed.status !== 200 || completed.body.status !== 'COMPLETED' || completed.body.kpi?.status !== 'ABOVE_TARGET' || completed.body.evidence?.length !== 1 || completed.body.feedback?.learning?.provenance?.verificationStatus !== 'VERIFIED' || completed.body.history?.length !== 5) throw new Error(`WEB_ACCEPTANCE_EXECUTION_COMPLETE_FAILED:${completed.status}:${JSON.stringify(completed.body)}`);
    const executionList = await request('/api/execution/work-items', { headers: { cookie } });
    if (executionList.status !== 200 || !Array.isArray(executionList.body.workItems) || !executionList.body.workItems.some(item => item.workItemId === workItemId)) throw new Error(`WEB_ACCEPTANCE_EXECUTION_LIST_FAILED:${executionList.status}`);

    const success = { type: 'WEB_PRODUCT_ACCEPTANCE_SUCCESS', version: 8, status: 'PASS', createdAt: new Date().toISOString(), repository: root, commit: gitCommit(), tenantId: session.body.tenantId, profit: dashboard.body.metrics.profit, acceptance: ['root','health','session','tenant','ingestion','analysis','executive-workbench','report','assistant','dashboard','multi-format-ingestion','structured-analysis','xlsx-analysis','raw-source-evidence','financial-analytics','financial-analytics-persistence','financial-analytics-report-integration','decision-workbench','expert-choice','decision-persistence','organizational-execution','governed-approval','work-item-lifecycle','kpi-outcome','execution-evidence','execution-feedback','reports-export','report-artifact-persistence','report-artifact-download','report-provenance','pdf-capability-boundary','offline-queue-binary-transport','offline-reload-durability','offline-reconnect-reconciliation','storage-quota-not-offline'] };
    fs.writeFileSync(evidencePath, JSON.stringify(success, null, 2), 'utf8');
    console.log(JSON.stringify({ type: 'WEB_PRODUCT_ACCEPTANCE', status: 'PASS', tenantId: session.body.tenantId, profit: dashboard.body.metrics.profit, root: true, session: true, analysis: true, executive: true, report: true, assistant: true, dashboard: true, multiFormat: true, financialAnalytics: true, decisionWorkbench: true, organizationalExecution: true, reportsExport: true, pdfBoundary: true, offlineQueue: true, offlineReload: true, offlineReconnect: true, storageQuota: true }, null, 2));
  } finally { await stop(); }
}
main().catch((error) => { try { fs.rmSync(evidencePath, { force: true }); } catch {} console.error(JSON.stringify({ type: 'WEB_PRODUCT_ACCEPTANCE', status: 'BLOCKED', error: error.message, platform: process.platform, node: process.version }, null, 2)); process.exitCode = 1; });
