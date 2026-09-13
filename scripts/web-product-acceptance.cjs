const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

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
async function request(pathname, options = {}) { const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options); const text = await response.text(); let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; } return { status: response.status, body, setCookie: response.headers.get('set-cookie') || '' }; }
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

    const sources = await request('/api/sources', { headers: { cookie } });
    if (sources.status !== 200 || !Array.isArray(sources.body.sources) || sources.body.sources.length < 3) throw new Error(`WEB_ACCEPTANCE_SOURCES_FAILED:${sources.status}`);

    // Layer 5: financial analytics composition over the canonical ingested source.
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

    const success = { type: 'WEB_PRODUCT_ACCEPTANCE_SUCCESS', version: 7, status: 'PASS', createdAt: new Date().toISOString(), repository: root, commit: gitCommit(), tenantId: session.body.tenantId, profit: dashboard.body.metrics.profit, acceptance: ['root','health','session','tenant','ingestion','analysis','executive-workbench','report','assistant','dashboard','multi-format-ingestion','structured-analysis','xlsx-analysis','raw-source-evidence','financial-analytics','financial-analytics-persistence','financial-analytics-report-integration','decision-workbench','expert-choice','decision-persistence','organizational-execution','governed-approval','work-item-lifecycle','kpi-outcome','execution-evidence','execution-feedback','reports-export','report-artifact-persistence','report-artifact-download','report-provenance'] };
    fs.writeFileSync(evidencePath, JSON.stringify(success, null, 2), 'utf8');
    console.log(JSON.stringify({ type: 'WEB_PRODUCT_ACCEPTANCE', status: 'PASS', tenantId: session.body.tenantId, profit: dashboard.body.metrics.profit, root: true, session: true, analysis: true, executive: true, report: true, assistant: true, dashboard: true, multiFormat: true, financialAnalytics: true, decisionWorkbench: true, organizationalExecution: true, reportsExport: true }, null, 2));
  } finally { await stop(); }
}
main().catch((error) => { try { fs.rmSync(evidencePath, { force: true }); } catch {} console.error(JSON.stringify({ type: 'WEB_PRODUCT_ACCEPTANCE', status: 'BLOCKED', error: error.message, platform: process.platform, node: process.version }, null, 2)); process.exitCode = 1; });
