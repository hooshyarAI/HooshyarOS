const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const port = 4174;
const db = path.join(root, 'data', 'web-acceptance.sqlite');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitHealth() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch {}
    await sleep(250);
  }
  throw new Error('WEB_ACCEPTANCE_HEALTH_TIMEOUT');
}

async function request(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { status: response.status, body, setCookie: response.headers.get('set-cookie') || '' };
}

async function main() {
  fs.mkdirSync(path.dirname(db), { recursive: true });
  const child = spawn(npm, ['run', 'start:commercial'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, HOOSHYAR_PORT: String(port), HOOSHYAR_DB_PATH: db }
  });

  const stop = async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await sleep(500);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    try { fs.rmSync(db, { force: true }); } catch {}
  };

  try {
    await waitHealth();
    const rootPage = await fetch(`http://127.0.0.1:${port}/`);
    if (!rootPage.ok || !(await rootPage.text()).includes('هوشیار.ai')) throw new Error('WEB_ACCEPTANCE_ROOT_FAILED');

    const session = await request('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'web-qa', organization: 'Hooshyar Web QA' })
    });
    if (session.status !== 201 || !session.body.tenantId || !session.setCookie) throw new Error(`WEB_ACCEPTANCE_SESSION_FAILED:${session.status}`);
    const cookie = session.setCookie.split(';')[0];

    const csv = [
      'date,account,debit,credit,currency',
      '2026-08-01,Cash,1000,0,IRR',
      '2026-08-02,Sales,0,1500,IRR',
      '2026-08-03,Expense,300,0,IRR',
      '2026-08-04,Receivable,0,800,IRR'
    ].join('\n');

    const analysis = await request('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ csv, sourceName: 'web-qa.csv', assets: 10000, liabilities: 4000 })
    });
    if (analysis.status !== 200 || analysis.body.status !== 'READY' || analysis.body.metrics.profit !== 1000) {
      throw new Error(`WEB_ACCEPTANCE_ANALYSIS_FAILED:${analysis.status}`);
    }

    const dashboard = await request('/api/dashboard', { headers: { cookie } });
    if (dashboard.status !== 200 || dashboard.body.analysisAvailable !== true || dashboard.body.metrics.profit !== 1000) {
      throw new Error(`WEB_ACCEPTANCE_DASHBOARD_FAILED:${JSON.stringify(dashboard.body)}`);
    }

    console.log(JSON.stringify({
      type: 'WEB_PRODUCT_ACCEPTANCE',
      status: 'PASS',
      tenantId: session.body.tenantId,
      profit: dashboard.body.metrics.profit,
      root: true,
      session: true,
      analysis: true,
      dashboard: true
    }, null, 2));
  } finally {
    await stop();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ type: 'WEB_PRODUCT_ACCEPTANCE', status: 'BLOCKED', error: error.message }, null, 2));
  process.exitCode = 1;
});
