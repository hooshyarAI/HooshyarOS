const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const port = 4174;
const db = path.join(root, 'data', 'web-acceptance.sqlite');
const evidenceDir = path.join(root, '.hooshyar');
const evidencePath = path.join(evidenceDir, 'web-acceptance-success.json');
const node = process.execPath;
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const runtimeEntrypoint = path.join(root, 'Backend', 'HBOS', 'Autonomous', 'Runtime', 'start-commercial-runtime.ts');
const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : undefined;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function gitCommit() { try { return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'UNKNOWN'; } }

async function waitHealth() { const deadline = Date.now() + 30000; while (Date.now() < deadline) { try { const response = await fetch(`http://127.0.0.1:${port}/health`); if (response.ok && (await response.json()).status === 'ok') return; } catch {} await sleep(250); } throw new Error('WEB_ACCEPTANCE_HEALTH_TIMEOUT'); }
async function request(pathname, options = {}) { const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options); const text = await response.text(); let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; } return { status: response.status, body, setCookie: response.headers.get('set-cookie') || '' }; }
function spawnRuntime() { return spawn(node, [tsxCli, runtimeEntrypoint], { cwd: root, stdio: 'inherit', shell: false, windowsHide: true, env: { ...process.env, HOOSHYAR_HOST: '127.0.0.1', HOOSHYAR_PORT: String(port), HOOSHYAR_DB_PATH: db } }); }

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  try { fs.rmSync(evidencePath, { force: true }); } catch {}
  if (!fs.existsSync(tsxCli)) throw new Error(`WEB_ACCEPTANCE_LAUNCHER_MISSING:${tsxCli}`);
  if (!fs.existsSync(runtimeEntrypoint)) throw new Error(`WEB_ACCEPTANCE_ENTRYPOINT_MISSING:${runtimeEntrypoint}`);
  fs.mkdirSync(path.dirname(db), { recursive: true });
  const child = spawnRuntime();
  const stop = async () => { if (child.exitCode === null) { if (process.platform === 'win32') { try { require('node:child_process').execFileSync(shell, ['/d', '/s', '/c', `taskkill /PID ${child.pid} /T /F`], { cwd: root, stdio: 'ignore' }); } catch {} } else child.kill('SIGTERM'); await sleep(500); } try { fs.rmSync(db, { force: true }); } catch {} };
  try {
    await waitHealth();
    const rootPage = await fetch(`http://127.0.0.1:${port}/`);
    if (!rootPage.ok || !(await rootPage.text()).includes('هوشیار.ai')) throw new Error('WEB_ACCEPTANCE_ROOT_FAILED');
    const session = await request('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'web-qa', organization: 'Hooshyar Web QA' }) });
    if (session.status !== 201 || !session.body.tenantId || !session.setCookie) throw new Error(`WEB_ACCEPTANCE_SESSION_FAILED:${session.status}`);
    const cookie = session.setCookie.split(';')[0];
    const csv = ['date,account,debit,credit,currency','2026-08-01,Cash,1000,0,IRR','2026-08-02,Sales,0,1500,IRR','2026-08-03,Expense,300,0,IRR','2026-08-04,Receivable,0,800,IRR'].join('\n');
    const analysis = await request('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ csv, sourceName: 'web-qa.csv', assets: 10000, liabilities: 4000 }) });
    if (analysis.status !== 200 || analysis.body.status !== 'READY' || analysis.body.metrics.profit !== 1000) throw new Error(`WEB_ACCEPTANCE_ANALYSIS_FAILED:${analysis.status}`);
    const dashboard = await request('/api/dashboard', { headers: { cookie } });
    if (dashboard.status !== 200 || dashboard.body.analysisAvailable !== true || dashboard.body.metrics.profit !== 1000) throw new Error(`WEB_ACCEPTANCE_DASHBOARD_FAILED:${JSON.stringify(dashboard.body)}`);
    const success = { type: 'WEB_PRODUCT_ACCEPTANCE_SUCCESS', version: 1, status: 'PASS', createdAt: new Date().toISOString(), repository: root, commit: gitCommit(), tenantId: session.body.tenantId, profit: dashboard.body.metrics.profit, acceptance: ['root', 'health', 'session', 'tenant', 'ingestion', 'analysis', 'dashboard'] };
    fs.writeFileSync(evidencePath, JSON.stringify(success, null, 2), 'utf8');
    console.log(JSON.stringify({ type: 'WEB_PRODUCT_ACCEPTANCE', status: 'PASS', tenantId: session.body.tenantId, profit: dashboard.body.metrics.profit, root: true, session: true, analysis: true, dashboard: true }, null, 2));
  } finally { await stop(); }
}
main().catch((error) => { try { fs.rmSync(evidencePath, { force: true }); } catch {} console.error(JSON.stringify({ type: 'WEB_PRODUCT_ACCEPTANCE', status: 'BLOCKED', error: error.message }, null, 2)); process.exitCode = 1; });
