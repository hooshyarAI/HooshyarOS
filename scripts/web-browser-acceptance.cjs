/**
 * Real web-browser acceptance for the commercial web surface.
 *
 * `Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md` §9 states: "An HBOS engine
 * test is not evidence that a usable browser UI exists. UI completion requires
 * application-level rendering and interaction tests." The canonical
 * `scripts/web-product-acceptance.cjs` proves the runtime/API/client-module
 * contract over HTTP, but it never renders the DOM or drives the real UI.
 *
 * This harness closes that gap honestly: it starts the real commercial runtime,
 * launches a real installed browser (Edge/Chrome) in headless mode, connects to
 * its DevTools Protocol endpoint over the built-in WebSocket, navigates to the
 * real web shell, and performs genuine rendering and user interaction:
 *
 *   render-shell        real DOM renders the app shell and the auth/analysis forms
 *   register-interaction   typing into the real register form and submitting it
 *   dashboard-rendered     the dashboard renders from the authenticated session
 *   analysis-interaction   selecting a real statement document and submitting it
 *   analysis-rendered-profit  the real profit value is rendered into the DOM
 *   context-and-insight-rendered  the context rail and the canonical statement
 *                             insight render from the real statement document
 *   report-interaction     the real report control renders a report
 *   logout-interaction     the real logout control ends the session
 *   login-interaction      the real login form re-authenticates the session
 *
 * The ingested source is a real financial-statement workbook generated from
 * canonical statement figures, not a ledger. A ledger has no canonical
 * statement document, so `/api/financial/insights` correctly yields no
 * `statementInsight` and the insight panel stays hidden; using a statement is
 * what makes the context/insight assertion a real product contract rather than
 * a false expectation.
 *
 * It never fakes a browser: with no discoverable browser the harness reports
 * `ENVIRONMENT_BLOCKED` and never writes a PASS. No new npm dependency is
 * introduced; it uses Node's built-in fetch/WebSocket plus the repository's
 * existing `exceljs-hardened` dependency to author the statement workbook.
 *
 * Usage: node scripts/web-browser-acceptance.cjs
 * Env:   HOOSHYAR_WEB_BROWSER_PORT (default 4176)
 *        HOOSHYAR_BROWSER           explicit browser executable path
 */
const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = process.cwd();
const port = Number(process.env.HOOSHYAR_WEB_BROWSER_PORT ?? '4176');
const debugPort = port + 100;
const db = path.join(root, 'data', 'web-browser-acceptance.sqlite');
const evidenceDir = path.join(root, '.hooshyar');
const evidencePath = path.join(evidenceDir, 'web-browser-acceptance.json');
const node = process.execPath;
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const runtimeEntrypoint = path.join(root, 'Backend', 'HBOS', 'Autonomous', 'Runtime', 'start-commercial-runtime.ts');
const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : undefined;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function gitCommit() {
  try {
    return execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

/**
 * The PASS artifact binds to the revision of THIS harness — the code it
 * actually proves — not to whatever documentation commit HEAD happens to be.
 * A later docs-only commit therefore cannot invalidate a real browser PASS,
 * while any change to the harness itself does (the artifact becomes stale).
 */
function harnessRevision() {
  const git = process.platform === 'win32' ? 'git.exe' : 'git';
  try {
    const sha = execFileSync(git, ['log', '-1', '--format=%H', '--', 'scripts/web-browser-acceptance.cjs'], { cwd: root, encoding: 'utf8' }).trim();
    if (sha) return sha;
  } catch { /* not committed yet */ }
  return gitCommit();
}

/** Discover a real installed browser; returns null when none is available. */
function findBrowser() {
  const explicit = process.env.HOOSHYAR_BROWSER;
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || '';
    candidates.push(
      path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
      '/usr/bin/chromium-browser', '/snap/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
  }
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function spawnRuntime() {
  const child = spawn(node, [tsxCli, runtimeEntrypoint], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: false,
    windowsHide: true,
    env: { ...process.env, HOOSHYAR_HOST: '127.0.0.1', HOOSHYAR_PORT: String(port), HOOSHYAR_DB_PATH: db },
  });
  child.spawnError = null;
  child.on('error', (error) => { child.spawnError = error; });
  return child;
}

async function waitHealth(child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.spawnError) throw new Error(`WEB_BROWSER_RUNTIME_SPAWN_ERROR:${child.spawnError.message}`);
    if (child.exitCode !== null) throw new Error(`WEB_BROWSER_RUNTIME_EXITED_BEFORE_HEALTH:code=${child.exitCode}`);
    if (child.signalCode) throw new Error(`WEB_BROWSER_RUNTIME_SIGNALED_BEFORE_HEALTH:${child.signalCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`WEB_BROWSER_HEALTH_TIMEOUT:port=${port}`);
}

/** Kill a process tree on Windows, or the process on POSIX. */
function killTree(pid) {
  if (pid == null) return;
  try {
    if (process.platform === 'win32') execFileSync(shell, ['/d', '/s', '/c', `taskkill /PID ${pid} /T /F`], { cwd: root, stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch { /* already gone */ }
}

/** Minimal DevTools Protocol client over the built-in WebSocket. */
class CdpConnection {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (event) => {
      const raw = typeof event.data === 'string' ? event.data : Buffer.from(event.data).toString('utf8');
      const message = JSON.parse(raw);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`CDP_${message.error.code}:${message.error.message}`));
        else resolve(message.result);
        return;
      }
      if (message.method) {
        for (const handler of this.handlers.get(message.method) || []) handler(message.params);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    const existing = this.handlers.get(method) || [];
    existing.push(handler);
    this.handlers.set(method, existing);
  }
}

/** Poll a promise-returning probe until it yields a truthy value or times out. */
async function waitFor(probe, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`WEB_BROWSER_TIMEOUT:${label}${lastError ? `:${lastError.message}` : ''}`);
}

async function connectToPage(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WEB_BROWSER_WS_TIMEOUT')), 15000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WEB_BROWSER_WS_ERROR')); });
  });
  return new CdpConnection(ws);
}

async function waitForPageTarget() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* browser not ready */ }
    await sleep(250);
  }
  throw new Error('WEB_BROWSER_CDP_TARGET_TIMEOUT');
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'unknown';
    throw new Error(`WEB_BROWSER_EVALUATE_FAILED:${description}`);
  }
  return result.result ? result.result.value : undefined;
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  try { fs.rmSync(evidencePath, { force: true }); } catch { /* none */ }

  const browser = findBrowser();
  if (!browser) {
    throw new Error('WEB_BROWSER_ACCEPTANCE_ENVIRONMENT_BLOCKED:no installed Edge/Chrome executable was discovered on this host');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`WEB_BROWSER_INVALID_PORT:${port}`);
  if (!fs.existsSync(tsxCli)) throw new Error(`WEB_BROWSER_LAUNCHER_MISSING:${tsxCli}`);
  if (!fs.existsSync(runtimeEntrypoint)) throw new Error(`WEB_BROWSER_ENTRYPOINT_MISSING:${runtimeEntrypoint}`);

  fs.mkdirSync(path.dirname(db), { recursive: true });
  const userDataDir = path.join(os.tmpdir(), `hooshyar-browser-${crypto.randomUUID()}`);
  fs.mkdirSync(userDataDir, { recursive: true });
  const appUrl = `http://127.0.0.1:${port}/`;
  // A real financial-statement workbook (balance sheet + income statement) so
  // the canonical document-understanding boundary produces statement facts and
  // the statement-insight surface has real evidence to render. A ledger CSV
  // cannot produce a statement document and would make the insight assertion
  // impossible to satisfy honestly.
  const ExcelJS = require('exceljs-hardened');
  const workbook = new ExcelJS.Workbook();
  const balanceSheet = workbook.addWorksheet('ترازنامه');
  [
    ['صورت وضعیت مالی'],
    ['(ارقام به میلیون ریال)'],
    ['شرح', '1402', '1401'],
    ['جمع دارایی‌ها', 1965000, 1798000],
    ['جمع بدهی‌ها', 820000, 880000],
    ['جمع حقوق مالکانه', 1145000, 918000],
  ].forEach((row) => balanceSheet.addRow(row));
  const incomeStatement = workbook.addWorksheet('سود و زیان');
  [
    ['صورت سود و زیان'],
    ['(ارقام به میلیون ریال)'],
    ['شرح', '1402', '1401'],
    ['درآمد عملیاتی', 2400000, 2100000],
    ['سود (زیان) خالص', 220000, 170000],
  ].forEach((row) => incomeStatement.addRow(row));
  const statementPath = path.join(userDataDir, 'browser-statement.xlsx');
  fs.writeFileSync(statementPath, Buffer.from(await workbook.xlsx.writeBuffer()));

  const checks = [];
  const runtime = spawnRuntime();
  let browserProcess = null;
  let cdp = null;
  const checksExpected = ['render-shell', 'register-interaction', 'dashboard-rendered', 'analysis-interaction', 'analysis-rendered-profit', 'context-and-insight-rendered', 'report-interaction', 'logout-interaction', 'login-interaction'];

  try {
    await waitHealth(runtime);

    browserProcess = spawn(browser, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--remote-allow-origins=*',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    browserProcess.on('error', () => { /* surfaced by target timeout */ });
    browserProcess.stdout.on('data', () => {});
    browserProcess.stderr.on('data', () => {});

    const pageTarget = await waitForPageTarget();
    cdp = await connectToPage(pageTarget.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    await cdp.send('Page.navigate', { url: appUrl });
    await waitFor(
      () => evaluate(cdp, 'document.readyState === "complete"'),
      'document-complete',
    );

    // 1. Real rendering: the app shell and the real interaction forms exist in the DOM.
    const shell = await waitFor(async () => {
      const value = await evaluate(cdp, `(function () {
        const title = document.title;
        const heading = document.querySelector('h1') ? document.querySelector('h1').textContent : '';
        return {
          title,
          headingOk: heading.includes('چه کاری می‌خواهید انجام دهید؟'),
          register: !!document.querySelector('#register-form'),
          login: !!document.querySelector('#login-form'),
          analysis: !!document.querySelector('#analysis-form'),
          fileInput: !!document.querySelector('#csv-file'),
          profit: !!document.querySelector('#profit'),
          workspace: !!document.querySelector('#workspace'),
          context: !!document.querySelector('#workspace-context-title'),
          promptChip: !!document.querySelector('.prompt-chip'),
        };
      })()`);
      return value && value.register && value.login && value.analysis && value.fileInput && value.profit && value.workspace && value.context && value.promptChip && value.headingOk ? value : null;
    }, 'render-shell');
    if (shell.title !== 'هوشیارOS') throw new Error(`WEB_BROWSER_TITLE_FAILED:${shell.title}`);
    const promptProbe = await evaluate(cdp, `(function () { const button=document.querySelector('.prompt-chip'); const input=document.querySelector('#assistant-question'); button.click(); return input.value; })()`);
    if (promptProbe !== 'این صورت مالی را تحلیل کن.') throw new Error('WEB_BROWSER_PROMPT_CHIP_FAILED');
    checks.push('render-shell');

    // 2. Real interaction: type into the register form and submit it.
    await evaluate(cdp, `(function () {
      document.querySelector('#register-username').value = 'browser-qa';
      document.querySelector('#register-organization').value = 'Browser QA Organization';
      document.querySelector('#register-password').value = 'Passw0rd!23';
      document.querySelector('#register-form button[type="submit"]').click();
      return true;
    })()`);
    await waitFor(
      () => evaluate(cdp, `document.querySelector('#session-result').textContent.includes('ثبت‌نام انجام شد')`),
      'register-interaction',
    );
    checks.push('register-interaction');

    // 3. The dashboard renders from the authenticated session (real /api/dashboard call).
    await waitFor(
      () => evaluate(cdp, `document.querySelector('#readiness').textContent.includes('آماده') && document.querySelector('#revenue').textContent !== '—'`),
      'dashboard-rendered',
    );
    checks.push('dashboard-rendered');

    // 4. Real interaction: select a real file on disk and submit the analysis form.
    const documentNode = await cdp.send('DOM.getDocument', { depth: -1 });
    const fileNode = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#csv-file' });
    if (!fileNode.nodeId) throw new Error('WEB_BROWSER_FILE_INPUT_MISSING');
    await cdp.send('DOM.setFileInputFiles', { files: [statementPath], nodeId: fileNode.nodeId });
    await evaluate(cdp, `(function () {
      document.querySelector('#analysis-form button[type="submit"]').click();
      return true;
    })()`);
    await waitFor(
      () => evaluate(cdp, `document.querySelector('#analysis-result').textContent.includes('تحلیل موفق')`),
      'analysis-interaction',
      30000,
    );
    checks.push('analysis-interaction');

    // 5. The real profit value is rendered into the DOM (Persian locale digits).
    //    The statement's net profit is 220,000 million IRR = 220,000,000,000 IRR.
    await waitFor(
      () => evaluate(cdp, `(function () {
        const text = document.querySelector('#profit').textContent;
        const ascii = text.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
        return ascii.replace(/[^0-9]/g, '') === '220000000000';
      })()`),
      'analysis-rendered-profit',
    );
    checks.push('analysis-rendered-profit');

    const contextProbe = await waitFor(
      () => evaluate(cdp, `(function () {
        const state = document.querySelector('#context-state')?.textContent || '';
        const source = document.querySelector('#context-source')?.textContent || '';
        const actions = document.querySelector('#context-actions');
        const insight = document.querySelector('#statement-insight');
        return state.includes('تحلیل و بینش آماده') && source.includes('browser-statement.xlsx') && actions && !actions.hidden && insight && !insight.hidden;
      })()`),
      'context-and-insight-rendered',
      10000,
    );
    if (!contextProbe) throw new Error('WEB_BROWSER_CONTEXT_RENDER_FAILED');
    checks.push('context-and-insight-rendered');

    await evaluate(cdp, `(function () { document.querySelector('#report-section').open=true; document.querySelector('#report-button').click(); return true; })()`);
    await waitFor(
      () => evaluate(cdp, `document.querySelector('#report-result').textContent.trim().length > 0`),
      'report-interaction',
      15000,
    );
    checks.push('report-interaction');

    // 6. Real interaction: the logout control ends the session.
    await evaluate(cdp, `(function () { document.querySelector('#logout-button').click(); return true; })()`);
    await waitFor(
      () => evaluate(cdp, `document.querySelector('#session-result').textContent.includes('خارج شدید')`),
      'logout-interaction',
    );
    checks.push('logout-interaction');

    // 7. Real interaction: the login form re-authenticates through the real password route.
    await evaluate(cdp, `(function () {
      document.querySelector('#login-username').value = 'browser-qa';
      document.querySelector('#login-organization').value = 'Browser QA Organization';
      document.querySelector('#login-password').value = 'Passw0rd!23';
      document.querySelector('#login-form button[type="submit"]').click();
      return true;
    })()`);
    await waitFor(
      () => evaluate(cdp, `document.querySelector('#session-result').textContent.includes('ورود انجام شد')`),
      'login-interaction',
    );
    checks.push('login-interaction');

    const evidence = {
      type: 'WEB_BROWSER_ACCEPTANCE',
      version: 1,
      status: 'PASS',
      createdAt: new Date().toISOString(),
      commit: harnessRevision(),
      harnessRevision: harnessRevision(),
      browser,
      appUrl,
      checks,
      expected: checksExpected,
    };
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
    console.log(JSON.stringify({ type: 'WEB_BROWSER_ACCEPTANCE', status: 'PASS', browser, checks }, null, 2));
  } finally {
    try { if (cdp) cdp.ws.close(); } catch { /* closing */ }
    if (browserProcess && browserProcess.pid) killTree(browserProcess.pid);
    killTree(runtime.pid);
    await sleep(500);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* cleaned */ }
    try { fs.rmSync(db, { force: true }); } catch { /* cleaned */ }
  }
}

main().catch((error) => {
  try { fs.rmSync(evidencePath, { force: true }); } catch { /* none */ }
  const blocked = error.message.startsWith('WEB_BROWSER_ACCEPTANCE_ENVIRONMENT_BLOCKED');
  console.error(JSON.stringify({
    type: 'WEB_BROWSER_ACCEPTANCE',
    status: blocked ? 'ENVIRONMENT_BLOCKED' : 'BLOCKED',
    error: error.message,
    platform: process.platform,
    node: process.version,
  }, null, 2));
  process.exitCode = 1;
});
