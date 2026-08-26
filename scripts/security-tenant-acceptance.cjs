#!/usr/bin/env node
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const port = 4175;
const db = path.join(root, 'data', 'security-acceptance.sqlite');
const evidenceDir = path.join(root, '.hooshyar');
const evidencePath = path.join(evidenceDir, 'security-acceptance-success.json');
const node = process.execPath;
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const runtimeEntrypoint = path.join(root, 'Backend', 'HBOS', 'Autonomous', 'Runtime', 'start-commercial-runtime.ts');
const git = process.platform === 'win32' ? 'git.exe' : 'git';
const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : undefined;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function gitCommit() {
  return execFileSync(git, ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

async function waitHealth() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch {}
    await sleep(250);
  }
  throw new Error('SECURITY_ACCEPTANCE_HEALTH_TIMEOUT');
}

async function request(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { status: response.status, body, cookie: response.headers.get('set-cookie') || '' };
}

function startRuntime() {
  return spawn(node, [tsxCli, runtimeEntrypoint], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
    env: { ...process.env, HOOSHYAR_HOST: '127.0.0.1', HOOSHYAR_PORT: String(port), HOOSHYAR_DB_PATH: db }
  });
}

async function stopRuntime(child) {
  if (child.exitCode === null) {
    if (process.platform === 'win32') {
      try { execFileSync(shell, ['/d', '/s', '/c', `taskkill /PID ${child.pid} /T /F`], { cwd: root, stdio: 'ignore' }); } catch {}
    } else child.kill('SIGTERM');
    await sleep(500);
  }
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  try { fs.rmSync(evidencePath, { force: true }); } catch {}
  fs.mkdirSync(path.dirname(db), { recursive: true });
  const child = startRuntime();
  try {
    await waitHealth();

    const unauthDashboard = await request('/api/dashboard');
    const unauthAnalyze = await request('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv: 'x', sourceName: 'unauth.csv', assets: 1, liabilities: 0 })
    });
    if (unauthDashboard.status !== 401 || unauthAnalyze.status !== 401) {
      throw new Error(`SECURITY_UNAUTHENTICATED_ACCESS_NOT_DENIED:${unauthDashboard.status}/${unauthAnalyze.status}`);
    }

    const createTenant = async (username, organization, sourceName, debit, credit) => {
      const session = await request('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, organization })
      });
      if (session.status !== 201 || !session.cookie || !session.body.tenantId) throw new Error(`SECURITY_SESSION_FAILED:${organization}`);
      const cookie = session.cookie.split(';')[0];
      const csv = [
        'date,account,debit,credit,currency',
        `2026-08-01,Cash,${debit},0,IRR`,
        `2026-08-02,Sales,0,${credit},IRR`
      ].join('\n');
      const analysis = await request('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ csv, sourceName, assets: 10000, liabilities: 2500 })
      });
      if (analysis.status !== 200 || analysis.body.status !== 'READY') throw new Error(`SECURITY_ANALYSIS_FAILED:${organization}`);
      return { tenantId: session.body.tenantId, cookie, expectedProfit: credit - debit };
    };

    const tenantA = await createTenant('security-a', 'Org A', 'tenant-a.csv', 100, 500);
    const tenantB = await createTenant('security-b', 'Org B', 'tenant-b.csv', 50, 900);

    if (tenantA.tenantId === tenantB.tenantId) throw new Error('TENANT_IDS_NOT_UNIQUE');

    const dashboardA = await request('/api/dashboard', { headers: { cookie: tenantA.cookie } });
    const dashboardB = await request('/api/dashboard', { headers: { cookie: tenantB.cookie } });
    if (dashboardA.status !== 200 || dashboardA.body.metrics?.profit !== 400 || dashboardA.body.tenantId !== tenantA.tenantId) throw new Error('TENANT_A_DATA_INVALID');
    if (dashboardB.status !== 200 || dashboardB.body.metrics?.profit !== 850 || dashboardB.body.tenantId !== tenantB.tenantId) throw new Error('TENANT_B_DATA_INVALID');

    const evidence = {
      type: 'SECURITY_TENANT_ACCEPTANCE_SUCCESS',
      version: 1,
      status: 'PASS',
      createdAt: new Date().toISOString(),
      repository: root,
      commit: gitCommit(),
      unauthenticatedApiDenied: true,
      tenantIsolation: true,
      tenants: [
        { tenantId: tenantA.tenantId, expectedProfit: tenantA.expectedProfit },
        { tenantId: tenantB.tenantId, expectedProfit: tenantB.expectedProfit }
      ],
      acceptance: ['unauthenticated-dashboard-denied', 'unauthenticated-analyze-denied', 'distinct-tenant-identities', 'tenant-a-data-isolated', 'tenant-b-data-isolated']
    };
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await stopRuntime(child);
    try { fs.rmSync(db, { force: true }); } catch {}
  }
}

main().catch((error) => {
  try { fs.rmSync(evidencePath, { force: true }); } catch {}
  console.error(JSON.stringify({ type: 'SECURITY_TENANT_ACCEPTANCE', status: 'BLOCKED', error: error.message }, null, 2));
  process.exitCode = 1;
});
