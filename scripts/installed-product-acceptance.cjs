/**
 * K8 — Real installed-product acceptance.
 *
 * Qualifies the actual Windows installed artifact (not the source tree):
 *   1. builds an isolated installer from the already-built payload with a
 *      unique AppId + dedicated install dir, so the pre-existing HooshyarOS
 *      installation is never touched;
 *   2. silently installs it to an isolated directory;
 *   3. verifies the installed runtime dependency closure and the repaired web
 *      client are present;
 *   4. launches the product through the real installed shortcut launcher and
 *      waits for a real health success (never a fixed delay, never "browser
 *      opened" as proof);
 *   5. drives the authenticated customer journey, the PDF capability boundary,
 *      the offline queue, tenant isolation and restart/recovery over HTTP.
 *
 * Usage: node scripts/installed-product-acceptance.cjs
 * Env: HOOSHYAR_ACCEPTANCE_PORT (default 4173, the installed launcher default)
 */
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const port = Number(process.env.HOOSHYAR_ACCEPTANCE_PORT ?? '4173');
const appRoot = path.join(root, 'dist', 'productization', 'windows');
const payload = path.join(appRoot, 'payload');
const workDir = path.join(root, '.hooshyar', 'installed-product-acceptance');
const installerOut = path.join(workDir, 'installer-out');
const isolatedIss = path.join(workDir, 'HooshyarOS-Acceptance.iss');
const installDir = path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || root, 'AppData', 'Local'), 'Programs', 'HooshyarOS-Acceptance');
const evidenceDir = path.join(root, '.hooshyar');
const evidencePath = path.join(evidenceDir, 'installed-product-acceptance.json');
const isccCandidates = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env.ProgramFiles || '', 'Inno Setup 6', 'ISCC.exe'),
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`${path.basename(command)} exited with ${result.status}`);
  return result;
}

function killPort(targetPort) {
  try {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-Command',
      `Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`
    ], { encoding: 'utf8' });
    for (const pid of output.split(/\s+/).filter(Boolean)) {
      try { execFileSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' }); } catch { /* already gone */ }
    }
  } catch { /* nothing listening */ }
}

async function waitHealth(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok && (await response.json()).status === 'ok') return true;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  return false;
}

/**
 * Launch the installed product exactly the way its installed shortcut does.
 *
 * `installer/HooshyarOS.iss` ([Icons]/[Run]) activates
 *   wscript.exe "<app>\launch-hooshyar.vbs"
 * with the install directory as the working directory, so that exact target is
 * what this acceptance must exercise.
 *
 * Do NOT build `cmd.exe /d /s /c "\"<path>\""` here: Node/libuv escapes the
 * embedded quotes to `\"`, so cmd.exe receives a literal `\"...\"` command and
 * exits 1 without ever starting the product. Invoking the shortcut target with
 * a single unquoted path argument has no such quoting ambiguity.
 */
function launchInstalledShortcut() {
  const target = path.join(installDir, 'launch-hooshyar.vbs');
  if (!fs.existsSync(target)) fail(`installed shortcut launcher missing: ${target}`);
  const child = spawn('wscript.exe', [target], {
    cwd: installDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const captured = { stdout: '', stderr: '' };
  child.on('error', () => undefined);
  child.stdout.on('data', (chunk) => { captured.stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { captured.stderr += chunk.toString(); });
  return { child, captured };
}

/** Bounded wait for the launcher process to exit, preserving its captured output. */
function waitLauncherExit(launcher, timeoutMs) {
  const { child, captured } = launcher;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ timedOut: true, ...captured }), timeoutMs);
    child.once('error', (error) => { clearTimeout(timer); resolve({ error, ...captured }); });
    child.once('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal, ...captured }); });
  });
}

/**
 * Launch through the real installed shortcut and require both a real health
 * success and a clean launcher exit. A launcher that exits non-zero, or that
 * never starts the product, is a genuine acceptance failure.
 */
async function launchInstalledProduct(label) {
  const launcher = launchInstalledShortcut();
  if (!(await waitHealth())) {
    const exit = await waitLauncherExit(launcher, 5000);
    fail(`${label}: installed runtime did not become healthy through its real shortcut launcher (${JSON.stringify(exit)})`);
  }
  const exit = await waitLauncherExit(launcher, 5000);
  if (exit.timedOut) fail(`${label}: shortcut launcher did not exit after reporting health success`);
  if (exit.error) throw exit.error;
  if (exit.code !== 0) fail(`${label}: shortcut launcher exited with ${exit.code} (stderr=${exit.stderr})`);
}

async function request(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { status: response.status, body, setCookie: response.headers.get('set-cookie') || '' };
}

function cookieHeader(setCookie) {
  return setCookie.split(';')[0];
}

function buildIsolatedInstaller() {
  const iscc = isccCandidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (!iscc) fail('Inno Setup 6 ISCC.exe was not found; cannot build the isolated installer');
  if (!fs.existsSync(path.join(payload, 'launch-hooshyar.vbs'))) fail('payload missing; run release_product_builder.py first');
  const existingSetup = path.join(installerOut, 'HooshyarOS-Acceptance-Setup.exe');
  if (process.env.HOOSHYAR_REUSE_INSTALLER === '1' && fs.existsSync(existingSetup)) return existingSetup;

  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(installerOut, { recursive: true });
  const appId = `{{${crypto.randomUUID().replace(/-/g, '').toUpperCase()}}}`;
  const template = fs.readFileSync(path.join(root, 'installer', 'HooshyarOS.iss'), 'utf8');
  const isolated = template
    .replace(/AppId=\{\{[0-9A-Fa-f-]+\}/, `AppId=${appId}`)
    .replace(/DefaultDirName=\{localappdata\}\\Programs\\HooshyarOS\r?\n/, `DefaultDirName={localappdata}\\Programs\\HooshyarOS-Acceptance\n`)
    .replace(/OutputDir=.*\r?\n/, `OutputDir=${installerOut}\n`)
    .replace(/OutputBaseFilename=.*\r?\n/, 'OutputBaseFilename=HooshyarOS-Acceptance-Setup\n')
    .replace(/SetupIconFile=.*\r?\n/, `SetupIconFile=${path.join(payload, 'hooshyaros.ico')}\n`)
    .replace(/Source: ".*payload\\\*"/, `Source: "${path.join(payload, '*')}"`);
  if (!isolated.includes('HooshyarOS-Acceptance') || !isolated.includes(appId)) fail('failed to generate the isolated installer definition');
  fs.writeFileSync(isolatedIss, isolated, 'utf8');

  run(iscc, [isolatedIss]);
  const setup = path.join(installerOut, 'HooshyarOS-Acceptance-Setup.exe');
  if (!fs.existsSync(setup)) fail(`isolated installer was not produced: ${setup}`);
  return setup;
}

function installIsolated(setup) {
  fs.rmSync(installDir, { recursive: true, force: true });
  const result = spawnSync(setup, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', `/DIR=${installDir}`], { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`isolated install failed with exit code ${result.status}`);
  if (!fs.existsSync(path.join(installDir, 'launch-hooshyar.cmd'))) fail('installed launcher missing after install');
}

function verifyInstalledPayload() {
  const requiredFiles = [
    'node-runtime/node.exe',
    'node_modules/tsx/dist/cli.mjs',
    'node_modules/better-sqlite3/package.json',
    'node_modules/exceljs-hardened/package.json',
    'node_modules/pdf-parse/package.json',
    'node_modules/mammoth/package.json',
    'Backend/HBOS/Autonomous/Runtime/start-commercial-runtime.ts',
    'web/app.js',
    'web/offline-sync.js',
    'launch-hooshyar.cmd',
    'launch-hooshyar.ps1',
    'launch-hooshyar.vbs',
  ];
  const missing = requiredFiles.filter((relative) => !fs.existsSync(path.join(installDir, ...relative.split('/'))));
  if (missing.length) fail(`installed payload incomplete: ${missing.join(', ')}`);

  const installedClient = fs.readFileSync(path.join(installDir, 'web', 'offline-sync.js'), 'utf8');
  if (!installedClient.includes('classifyFailure') || !installedClient.includes('STORAGE_QUOTA_FAILURE')) {
    fail('installed web client does not contain the repaired failure classification');
  }
  const installedApp = fs.readFileSync(path.join(installDir, 'web', 'app.js'), 'utf8');
  if (!installedApp.includes('resolveIngestRequest') || installedApp.includes("error instanceof TypeError")) {
    fail('installed web app does not contain the repaired representation/classification logic');
  }
}

async function runCustomerJourney() {
  const checks = [];

  const health = await request('/health');
  if (health.status !== 200 || health.body.status !== 'ok') fail(`installed health failed: ${health.status}`);
  checks.push('health');

  const ready = await request('/api/ready');
  if (ready.status !== 200 || ready.body.status !== 'READY' || !(ready.body.capabilities || []).includes('offline-sync')) fail('installed /api/ready failed');
  checks.push('ready');

  const rootPage = await fetch(`http://127.0.0.1:${port}/`);
  if (!rootPage.ok || !(await rootPage.text()).includes('هوشیار.ai')) fail('installed root page failed');
  checks.push('web-shell');

  const username = `installed-qa-${Date.now()}`;
  const organization = 'Installed QA Org';
  const password = 'installed-acceptance-horse';
  const registered = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, organization, password }),
  });
  if (registered.status !== 201 || !registered.setCookie) fail(`installed register failed: ${registered.status}`);
  const cookie = cookieHeader(registered.setCookie);
  checks.push('register');

  const session = await request('/api/session', { headers: { cookie } });
  if (session.status !== 200 || session.body.username !== username) fail('installed session continuity failed');
  checks.push('session');

  const pdfIngest = await request('/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ sourceName: 'installed.pdf', format: 'PDF', contentBase64: Buffer.from('%PDF-1.7\n%%EOF\n', 'latin1').toString('base64') }),
  });
  if (pdfIngest.status !== 400 || pdfIngest.body.error !== 'INGEST_FORMAT_UNSUPPORTED') fail(`installed PDF boundary failed: ${pdfIngest.status}`);
  checks.push('pdf-boundary');

  const csv = ['date,account,debit,credit,currency', '2026-08-01,Cash,1000,0,IRR', '2026-08-02,Sales,0,1500,IRR', '2026-08-03,Expense,300,0,IRR'].join('\n');
  await sleep(1100);
  const ingest = await request('/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ sourceName: 'installed-ledger.csv', format: 'CSV', content: csv }),
  });
  if (ingest.status !== 201 || !ingest.body.evidence?.sha256) fail(`installed ingest failed: ${ingest.status}`);
  checks.push('ingest');

  const analysis = await request('/api/financial/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ sourceSha256: ingest.body.evidence.sha256, assets: 10000, liabilities: 4000 }),
  });
  if (analysis.status !== 200 || analysis.body.status !== 'READY' || analysis.body.metrics.profit !== 200) fail(`installed analysis failed: ${analysis.status}:${JSON.stringify(analysis.body)}`);
  checks.push('analysis');

  const dashboard = await request('/api/dashboard', { headers: { cookie } });
  if (dashboard.status !== 200 || dashboard.body.analysisAvailable !== true) fail('installed dashboard failed');
  checks.push('dashboard');

  const sources = await request('/api/sources', { headers: { cookie } });
  if (sources.status !== 200 || !(sources.body.sources || []).some((source) => source.sha256 === ingest.body.evidence.sha256)) fail('installed sources failed');
  checks.push('sources');

  // Tenant isolation against the installed runtime.
  const other = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: `${username}-other`, organization: 'Installed Other Org', password }),
  });
  const otherCookie = cookieHeader(other.setCookie);
  const foreign = await request(`/api/sources/${ingest.body.evidence.sha256}`, { headers: { cookie: otherCookie } });
  if (foreign.status !== 404) fail(`installed tenant isolation failed: ${foreign.status}`);
  checks.push('tenant-isolation');

  // Real browser offline transport against the installed runtime.
  const offlineClient = require(path.join(root, 'web', 'offline-sync.js'));
  const runtimeFetch = (url, init = {}) => fetch(`http://127.0.0.1:${port}${url}`, { ...init, headers: { ...(init.headers || {}), cookie } });
  let browserOnline = false;
  const flakyFetch = (url, init) => (browserOnline ? runtimeFetch(url, init) : Promise.reject(new TypeError('Failed to fetch')));
  const storage = offlineClient.memoryStorage();
  const offlineSync = offlineClient.createOfflineSync({ storage, fetchImpl: flakyFetch });
  await offlineSync.enqueue({ sourceName: 'installed-offline.csv', format: 'CSV', content: csv });
  const offlineReport = await offlineSync.sync();
  if (offlineReport.status !== 'OFFLINE' || offlineReport.pending !== 1) fail('installed offline queue failed');
  if ((await offlineClient.createOfflineSync({ storage, fetchImpl: flakyFetch }).pending()).length !== 1) fail('installed offline reload failed');
  browserOnline = true;
  await sleep(1100);
  const onlineReport = await offlineSync.sync();
  if (onlineReport.status !== 'ONLINE' || onlineReport.pending !== 0 || onlineReport.synced.length !== 1) fail('installed offline reconnect failed');
  checks.push('offline-queue', 'offline-reload', 'offline-reconnect');

  return { checks, username, organization, password, sourceSha256: ingest.body.evidence.sha256, profit: analysis.body.metrics.profit };
}

async function verifyRestartRecovery(credentials) {
  killPort(port);
  await sleep(1500);
  await launchInstalledProduct('installed-product-restart');
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: credentials.username, organization: credentials.organization, password: credentials.password }),
  });
  if (login.status !== 200 || !login.setCookie) fail(`installed re-login failed after restart: ${login.status}`);
  const cookie = cookieHeader(login.setCookie);
  const dashboard = await request('/api/dashboard', { headers: { cookie } });
  if (dashboard.status !== 200 || dashboard.body.analysisAvailable !== true || dashboard.body.metrics?.profit !== credentials.profit) {
    fail('installed persistence/recovery failed: analysis did not survive restart');
  }
  return ['restart-recovery', 'persistence'];
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  try { fs.rmSync(evidencePath, { force: true }); } catch { /* ignore */ }
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`invalid port ${port}`);

  killPort(port);
  const setup = buildIsolatedInstaller();
  installIsolated(setup);
  verifyInstalledPayload();

  // The installer's [Run] section may already have launched the product; stop
  // it so the acceptance proves the real installed shortcut itself starts a
  // healthy runtime, then launch through that shortcut.
  killPort(port);
  await sleep(1500);
  await launchInstalledProduct('installed-product');
  const launcherHealthy = true;

  const journey = await runCustomerJourney();
  const recoveryChecks = await verifyRestartRecovery({
    username: journey.username,
    organization: journey.organization,
    password: journey.password,
    profit: journey.profit,
  });

  const installedClient = fs.readFileSync(path.join(installDir, 'web', 'offline-sync.js'), 'utf8');
  const evidence = {
    type: 'INSTALLED_PRODUCT_ACCEPTANCE',
    version: 1,
    status: 'PASS',
    createdAt: new Date().toISOString(),
    commit: (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { return 'UNKNOWN'; } })(),
    installDir,
    port,
    launcherHealthy,
    runtimeDependenciesVerified: true,
    repairedClientInstalled: installedClient.includes('STORAGE_QUOTA_FAILURE'),
    checks: [...journey.checks, ...recoveryChecks],
    sourceSha256: journey.sourceSha256,
    profit: journey.profit,
  };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
  console.log(JSON.stringify({ type: 'INSTALLED_PRODUCT_ACCEPTANCE', status: 'PASS', installDir, checks: evidence.checks }, null, 2));
}

main()
  .then(() => {
    killPort(port);
    process.exit(0);
  })
  .catch((error) => {
    try { fs.rmSync(evidencePath, { force: true }); } catch { /* ignore */ }
    console.error(JSON.stringify({ type: 'INSTALLED_PRODUCT_ACCEPTANCE', status: 'BLOCKED', error: error.message }, null, 2));
    killPort(port);
    process.exit(1);
  });
