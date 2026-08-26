const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const port = 4273;
const base = `http://127.0.0.1:${port}`;
const dataDir = path.join(root, '.hooshyar', 'web-acceptance');
const dbPath = path.join(dataDir, 'web-acceptance.sqlite');

fs.mkdirSync(dataDir, { recursive: true });
try { fs.rmSync(dbPath, { force: true }); } catch {}

let child;

function fail(message, details) {
  console.error(JSON.stringify({
    type: 'WEB_PRODUCT_ACCEPTANCE',
    status: 'FAIL',
    error: message,
    details: details ?? null,
  }, null, 2));
  process.exitCode = 1;
}

async function waitForHealth(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('WEB_RUNTIME_HEALTH_TIMEOUT');
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  let payload;
  try { payload = body ? JSON.parse(body) : null; } catch { payload = body; }
  if (!response.ok) throw new Error(`HTTP_${response.status}:${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  return { response, payload };
}

(async () => {
  child = spawn(process.execPath, [
    path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(root, 'Backend', 'HBOS', 'Autonomous', 'Runtime', 'start-commercial-runtime.ts'),
  ], {
    cwd: root,
    env: { ...process.env, HOOSHYAR_PORT: String(port), HOOSHYAR_DB_PATH: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });

  await waitForHealth();

  const ready = await jsonRequest(`${base}/api/ready`);
  if (ready.payload.status !== 'READY') throw new Error('WEB_RUNTIME_NOT_READY');

  const session = await jsonRequest(`${base}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'web-qa-user', organization: 'Hooshyar Web QA' }),
  });

  const cookie = session.response.headers.get('set-cookie');
  if (!cookie) throw new Error('SESSION_COOKIE_MISSING');

  const csv = [
    'date,account,debit,credit,currency',
    '2026-08-01,Cash,1000,0,IRR',
    '2026-08-02,Sales,0,1500,IRR',
    '2026-08-03,Expense,300,0,IRR',
    '2026-08-04,Receivable,0,800,IRR',
  ].join('\n');

  const analysis = await jsonRequest(`${base}/api/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookie.split(';')[0] },
    body: JSON.stringify({ csv, sourceName: 'web-qa-ledger.csv', assets: 10000, liabilities: 4000 }),
  });

  if (analysis.payload.metrics?.revenue !== 2300) throw new Error('WEB_ANALYSIS_REVENUE_MISMATCH');
  if (analysis.payload.metrics?.profit !== 1000) throw new Error('WEB_ANALYSIS_PROFIT_MISMATCH');
  if (analysis.payload.status !== 'READY') throw new Error('WEB_ANALYSIS_NOT_READY');

  const dashboard = await jsonRequest(`${base}/api/dashboard`, {
    headers: { cookie: cookie.split(';')[0] },
  });

  if (!dashboard.payload.analysisAvailable) throw new Error('WEB_DASHBOARD_ANALYSIS_MISSING');
  if (dashboard.payload.metrics?.revenue !== 2300) throw new Error('WEB_DASHBOARD_REVENUE_MISMATCH');
  if (dashboard.payload.metrics?.profit !== 1000) throw new Error('WEB_DASHBOARD_PROFIT_MISMATCH');
  if (dashboard.payload.metrics?.risk !== 40) throw new Error('WEB_DASHBOARD_RISK_MISMATCH');

  console.log(JSON.stringify({
    type: 'WEB_PRODUCT_ACCEPTANCE',
    status: 'PASS',
    runtime: `${base}`,
    journey: ['health', 'ready', 'session', 'tenant', 'ingestion', 'analysis', 'dashboard'],
    metrics: dashboard.payload.metrics,
    tenantId: session.payload.tenantId,
  }, null, 2));
} catch (error) {
  fail(error instanceof Error ? error.message : 'WEB_ACCEPTANCE_ERROR', stderr.trim() || null);
} finally {
  if (child && !child.killed) {
    child.kill();
    setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 1000).unref();
  }
}
