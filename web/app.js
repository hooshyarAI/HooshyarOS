const syncApi = typeof window !== 'undefined' && window.HooshyarOfflineSync ? window.HooshyarOfflineSync : null;

function classifiedError(message, kind, extra) {
  if (syncApi) return syncApi.typedError(message, kind, extra);
  const error = new Error(message);
  error.kind = kind;
  if (extra) Object.assign(error, extra);
  return error;
}

async function getJson(path, options) {
  let response;
  try {
    response = await fetch(path, options);
  } catch (error) {
    throw syncApi ? syncApi.networkError(error) : classifiedError(`offline-network-failure:${error && error.message ? error.message : 'unknown'}`, 'NETWORK_FAILURE', { cause: error });
  }
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const kind = syncApi ? syncApi.classifyHttpStatus(response.status) : 'HTTP_4XX';
    throw classifiedError(payload.error || `HTTP_${response.status}`, kind, { status: response.status });
  }
  return payload;
}

const idempotencyKeys = new Map();

function idempotencyKey(scope) {
  if (!idempotencyKeys.has(scope)) {
    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    idempotencyKeys.set(scope, generated);
  }
  return idempotencyKeys.get(scope);
}

function rotateIdempotencyKey(scope) {
  idempotencyKeys.delete(scope);
}

const offlineSync = typeof window !== 'undefined' && window.HooshyarOfflineSync
  ? window.HooshyarOfflineSync.createOfflineSync({})
  : null;

const lastSyncCursors = new Map();

function classifyErrorKind(error) {
  return syncApi
    ? syncApi.classifyFailure(error, typeof navigator !== 'undefined' ? navigator : undefined)
    : ((error && error.kind) || 'APPLICATION_FAILURE');
}

function isConnectivityError(error) {
  return syncApi ? syncApi.isConnectivityFailure(classifyErrorKind(error)) : false;
}

function describeFailure(error) {
  const kind = classifyErrorKind(error);
  const message = error && error.message ? error.message : String(error);
  switch (kind) {
    case 'STORAGE_QUOTA_FAILURE':
      return 'فضای ذخیره‌سازی مرورگر برای صف آفلاین کافی نیست؛ فایل ذخیره نشد. اتصال را برقرار کنید و دوباره تلاش کنید.';
    case 'STORAGE_FAILURE':
      return 'ذخیره‌سازی صف آفلاین ناموفق بود؛ فایل در صف ذخیره نشد.';
    case 'FILE_REPRESENTATION_FAILURE':
      return `خواندن یا شناسایی فایل ناموفق بود: ${message}`;
    case 'AUTHENTICATION_FAILURE':
      return 'نشست معتبر نیست؛ دوباره وارد شوید.';
    case 'AUTHORIZATION_FAILURE':
      return 'برای این عملیات مجوز ندارید.';
    case 'HTTP_5XX':
      return `خطای موقت سرویس: ${message}`;
    case 'VALIDATION_FAILURE':
      if (message === 'request-body-too-large') {
        return 'حجم فایل برای ارسال بیشتر از سقف مجاز است؛ فایل کوچک‌تر یا نسخه فشرده‌تر انتخاب کنید.';
      }
      if (message === 'INGEST_FORMAT_UNSUPPORTED') {
        return 'این فرمت فایل در حال حاضر پشتیبانی نمی‌شود (DOCX/XLS/تصویر)؛ فایل CSV، JSON، TXT، XLSX یا PDF متن‌محور انتخاب کنید.';
      }
      if (message === 'ingestion-pdf-scanned-no-ocr-yet') {
        return 'این PDF متن‌محور نیست و OCR در این نصب در دسترس نیست؛ یک PDF متن‌محور یا فایل CSV، JSON، TXT یا XLSX انتخاب کنید.';
      }
      if (message === 'ingestion-ocr-empty') {
        return 'این PDF اسکن‌شده/تصویری است اما متن قابل خواندن با OCR پیدا نشد؛ کیفیت تصویر را بررسی کنید یا یک PDF متن‌محور یا فایل CSV، JSON، TXT یا XLSX انتخاب کنید.';
      }
      if (message === 'ingestion-ocr-unsupported') {
        return 'موتور OCR یا داده زبانی محلی آن در این نصب در دسترس نیست؛ یک PDF متن‌محور یا فایل CSV، JSON، TXT یا XLSX انتخاب کنید.';
      }
      return `ورودی نامعتبر است: ${message}`;
    default:
      return message;
  }
}

async function refreshSyncState() {
  if (!offlineSync) return;
  try {
    const state = await offlineSync.serverState();
    lastSyncCursors.clear();
    for (const entry of state.cursors || []) lastSyncCursors.set(entry.sourceKey, entry.cursor.lastWatermark);
  } catch {
    /* server state is a reconciliation aid, not a hard requirement */
  }
}

async function flushOfflineQueue() {
  if (!offlineSync) return;
  try {
    const report = await offlineSync.sync();
    if (report.attempted > 0) {
      const target = document.querySelector('#analysis-result');
      if (report.pending === 0 && report.rejected.length === 0) {
        const conflicts = report.conflicts.length ? ` (${report.conflicts.length} تعارض با مرجع سرور حل شد)` : '';
        target.textContent = `همگام‌سازی آفلاین: ${report.synced.length} مورد ارسال شد${conflicts}.`;
      } else if (report.status === 'OFFLINE' || report.status === 'NETWORK_FAILURE') {
        target.textContent = `اتصال هنوز برقرار نیست؛ ${report.pending} مورد در صف آفلاین باقی ماند.`;
      } else if (report.status === 'AUTHENTICATION_FAILURE' || report.status === 'AUTHORIZATION_FAILURE') {
        target.textContent = `همگام‌سازی انجام نشد؛ ابتدا دوباره وارد شوید (${report.pending} مورد در صف باقی ماند).`;
      } else if (report.status === 'STORAGE_QUOTA_FAILURE' || report.status === 'STORAGE_FAILURE') {
        target.textContent = `ذخیره‌سازی صف آفلاین ناموفق بود؛ کارهای همگام‌سازی‌نشده حفظ شدند (${report.pending} مورد).`;
      } else if (report.rejected.length) {
        target.textContent = `همگام‌سازی: ${report.synced.length} موفق، ${report.rejected.length} رد شد.`;
      }
      await refreshDashboard();
    }
  } finally {
    await refreshSyncState();
  }
}

function text(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

async function refreshDashboard() {
  try {
    const ready = await getJson('/api/ready');
    document.querySelector('#readiness').textContent = `سامانه ${ready.status === 'READY' ? 'آماده' : 'نیازمند بررسی'} است.`;
    const dashboard = await getJson('/api/dashboard');
    document.querySelector('#revenue').textContent = Number(dashboard.metrics?.revenue ?? 0).toLocaleString('fa-IR');
    document.querySelector('#profit').textContent = Number(dashboard.metrics?.profit ?? 0).toLocaleString('fa-IR');
    document.querySelector('#risk').textContent = `${Number(dashboard.metrics?.risk ?? 0).toLocaleString('fa-IR')}٪`;
    syncWorkspaceSnapshot();
    await refreshAnalyticsSources();
    await refreshReportArtifacts();
  } catch (error) {
    document.querySelector('#readiness').textContent = `برای ادامه ابتدا نشست ایجاد کنید: ${error.message}`;
  }
}

async function refreshSessionState() {
  const result = document.querySelector('#session-result');
  try {
    const session = await getJson('/api/session');
    result.textContent = `نشست فعال: ${session.username} — سازمان ${session.organization.name} (نقش ${session.role}).`;
    const contextSession=document.querySelector('#context-session'); if(contextSession)contextSession.textContent=session.organization.name;
    return session;
  } catch {
    result.textContent = 'نشست فعالی وجود ندارد. ثبت‌نام کنید یا با گذرواژه وارد شوید.';
    const contextSession=document.querySelector('#context-session'); if(contextSession)contextSession.textContent='بدون ورود';
    return null;
  }
}

function wireAuthForm({ formSelector, path, usernameSelector, organizationSelector, passwordSelector, successLabel }) {
  document.querySelector(formSelector).addEventListener('submit', async event => {
    event.preventDefault();
    const result = document.querySelector('#session-result');
    try {
      const payload = await getJson(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: document.querySelector(usernameSelector).value,
          organization: document.querySelector(organizationSelector).value,
          password: document.querySelector(passwordSelector).value
        })
      });
      document.querySelector(passwordSelector).value = '';
      result.textContent = `${successLabel} ${payload.username} — سازمان ${payload.organization.name} (نقش ${payload.role}).`;
      await refreshDashboard();
    } catch (error) {
      result.textContent = `ناموفق بود: ${error.message}`;
    }
  });
}

wireAuthForm({ formSelector: '#register-form', path: '/api/auth/register', usernameSelector: '#register-username', organizationSelector: '#register-organization', passwordSelector: '#register-password', successLabel: 'ثبت‌نام انجام شد:' });
wireAuthForm({ formSelector: '#login-form', path: '/api/auth/login', usernameSelector: '#login-username', organizationSelector: '#login-organization', passwordSelector: '#login-password', successLabel: 'ورود انجام شد:' });

document.querySelector('#logout-button').addEventListener('click', async () => {
  const result = document.querySelector('#session-result');
  try {
    await getJson('/api/auth/logout', { method: 'POST' });
    result.textContent = 'از نشست خارج شدید.';
    await refreshDashboard();
  } catch (error) {
    result.textContent = `خروج ناموفق بود: ${error.message}`;
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(classifiedError('file-read-failed', 'FILE_REPRESENTATION_FAILURE'));
    reader.readAsDataURL(file);
  });
}

async function readFileText(file) {
  try {
    return await file.text();
  } catch (error) {
    throw classifiedError(
      `file-text-failed:${error && error.message ? error.message : 'unknown'}`,
      'FILE_REPRESENTATION_FAILURE',
      { cause: error }
    );
  }
}

/**
 * Resolve the canonical ingest representation for a selected file using the
 * shared format table. Binary formats (XLSX / PDF / ...) are sent as
 * `contentBase64`; text formats as `content`. Text-native PDF is supported by
 * the canonical runtime, and scanned/image-only PDF is read through the
 * admitted OCR route; a scan with no recognizable text fails closed there
 * (never as CSV, never as an offline event).
 */
function resolveIngestRequest(file) {
  const format = syncApi ? syncApi.formatFromSourceName(file.name) : null;
  if (!format) {
    throw classifiedError(`unknown-file-format:${file.name}`, 'FILE_REPRESENTATION_FAILURE');
  }
  const binary = syncApi ? syncApi.isBinaryFormat(format) : format === 'XLSX';
  return { format, binary };
}

/**
 * Long-running ingestion is observed through the canonical durable job API
 * (`POST/GET /api/ingest/jobs`). The UI renders the REAL server-side stage,
 * page progress and elapsed time — never a timer-based fake percentage. A
 * duplicate submission resolves to the same job and is shown as "in progress",
 * not as a failure.
 */
const INGEST_JOB_STORAGE_KEY = 'hooshyar.ingest.job.v1';
const INGEST_STAGE_LABELS_FA = {
  RECEIVED: 'دریافت شد',
  VALIDATING: 'در حال اعتبارسنجی ورودی',
  READING_PDF: 'در حال خواندن فایل PDF',
  SCANNED_DETECTED: 'فایل اسکن‌شده شناسایی شد؛ آماده‌سازی تشخیص متن',
  OCR: 'در حال تشخیص متن تصویر (OCR)',
  NORMALIZING: 'در حال نرمال‌سازی ساختار سند',
  CANONICAL_VALIDATION: 'در حال اعتبارسنجی مدل مالی کانونی',
  PERSISTING: 'در حال ذخیره‌سازی نتیجه',
  COMPLETED: 'تکمیل شد',
  FAILED: 'پردازش ناموفق بود'
};
let lastIngestJob = null;

function formatElapsedSeconds(fromIso, toIso) {
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return '';
  const parsedTo = toIso ? Date.parse(toIso) : Date.now();
  const to = Number.isFinite(parsedTo) ? parsedTo : Date.now();
  const seconds = Math.max(0, Math.round((to - from) / 1000));
  return `زمان سپری‌شده: ${seconds.toLocaleString('fa-IR')} ثانیه`;
}

function describeJob(job) {
  if (syncApi && syncApi.describeIngestProgress) return syncApi.describeIngestProgress(job, Date.now());
  const stage = job.stage || 'RECEIVED';
  return {
    stage,
    stageLabel: INGEST_STAGE_LABELS_FA[stage] || stage,
    message: job.message || INGEST_STAGE_LABELS_FA[stage] || '',
    percent: null,
    page: null,
    pages: null,
    elapsedSeconds: null,
    terminal: stage === 'COMPLETED' || stage === 'FAILED'
  };
}

function renderIngestJob(job) {
  if (!job) return;
  lastIngestJob = job;
  const container = document.querySelector('#analysis-progress');
  if (!container) return;
  container.hidden = false;
  const described = describeJob(job);
  document.querySelector('#analysis-progress-stage').textContent = described.stageLabel;
  document.querySelector('#analysis-progress-elapsed').textContent = described.elapsedSeconds === null
    ? formatElapsedSeconds(job.receivedAt, job.completedAt)
    : `زمان سپری‌شده: ${described.elapsedSeconds.toLocaleString('fa-IR')} ثانیه`;

  const bar = document.querySelector('#analysis-progress-bar');
  // A percentage is shown ONLY for real OCR page progress.
  if (described.stage === 'OCR' && described.percent !== null) {
    bar.hidden = false;
    bar.value = described.percent;
  } else {
    bar.hidden = true;
  }

  document.querySelector('#analysis-progress-message').textContent = described.message;
  document.querySelector('#analysis-progress-code').textContent = job.code ? `کد تشخیص: ${job.code}` : '';
}

function persistIngestJob(entry) {
  try { localStorage.setItem(INGEST_JOB_STORAGE_KEY, JSON.stringify(entry)); } catch { /* storage is optional */ }
}

function readPersistedIngestJob() {
  try {
    const raw = localStorage.getItem(INGEST_JOB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPersistedIngestJob() {
  try { localStorage.removeItem(INGEST_JOB_STORAGE_KEY); } catch { /* storage is optional */ }
}

async function pollIngestJob(jobId) {
  const elapsedTimer = setInterval(() => renderIngestJob(lastIngestJob), 1000);
  try {
    for (;;) {
      const payload = await getJson(`/api/ingest/jobs/${encodeURIComponent(jobId)}`);
      renderIngestJob(payload.job);
      if (payload.job && (payload.job.status === 'COMPLETED' || payload.job.status === 'FAILED')) return payload.job;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  } finally {
    clearInterval(elapsedTimer);
  }
}


function syncWorkspaceSnapshot() {
  const pairs=[['#revenue-inline','#revenue'],['#profit-inline','#profit'],['#risk-inline','#risk']];
  for (const [target,source] of pairs) {
    const a=document.querySelector(target), b=document.querySelector(source);
    if(a&&b)a.textContent=b.textContent;
  }
}
function setWorkspaceContext({title,description,source,state,revealActions=false}={}) {
  for (const [selector,value] of [['#workspace-context-title',title],['#workspace-context-description',description],['#context-source',source],['#context-state',state]]) {
    const el=document.querySelector(selector); if(el&&value!==undefined)el.textContent=value;
  }
  const actions=document.querySelector('#context-actions'); if(actions&&revealActions)actions.hidden=false;
}
function wireWorkspaceInteractions() {
  document.querySelectorAll('[data-scroll-target]').forEach(button=>button.addEventListener('click',()=>{
    const target=document.querySelector(button.dataset.scrollTarget);
    if(target){target.scrollIntoView({behavior:'smooth',block:'start'});const details=target.closest('details');if(details)details.open=true;}
  }));
  document.querySelectorAll('[data-focus-target]').forEach(button=>button.addEventListener('click',()=>{
    const target=document.querySelector(button.dataset.focusTarget);
    if(target){target.focus({preventScroll:true});target.scrollIntoView({behavior:'smooth',block:'center'});}
  }));
  document.querySelectorAll('.prompt-chip').forEach(button=>button.addEventListener('click',()=>{
    const input=document.querySelector('#assistant-question'); if(!input)return; input.value=button.dataset.prompt||''; input.focus();
  }));
  const file=document.querySelector('#csv-file');
  if(file)file.addEventListener('change',()=>{
    const selected=file.files&&file.files[0]; if(!selected)return;
    setWorkspaceContext({title:'منبع انتخاب شد',description:'منبع دریافت شد؛ اکنون آن را به context معتبر تبدیل و سپس تحلیل می‌کنیم.',source:selected.name,state:'آماده دریافت و اعتبارسنجی'});
  });
}

async function finishIngestJob(job, entry) {
  const result = document.querySelector('#analysis-result');
  if (!job || job.status !== 'COMPLETED' || !job.result) {
    const code = job && job.code ? ` (کد تشخیص: ${job.code})` : '';
    result.textContent = `${job && job.message ? job.message : 'پردازش ناموفق بود.'}${code}`;
    clearPersistedIngestJob();
    return;
  }
  // Manual balance-sheet values are an explicit fallback only; when the
  // document carries facts the server ignores them. They are sent only when the
  // user actually entered a value.
  const analyzeBody = { sourceSha256: job.result.sha256 };
  const assetsInput = document.querySelector('#assets').value.trim();
  const liabilitiesInput = document.querySelector('#liabilities').value.trim();
  if (assetsInput !== '') analyzeBody.assets = Number(assetsInput);
  if (liabilitiesInput !== '') analyzeBody.liabilities = Number(liabilitiesInput);
  const analysis = await getJson('/api/financial/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(analyzeBody)
  });
  const provenance = analysis.inputProvenance || {};
  const originLabel = value => value === 'DOCUMENT' ? 'از سند' : value === 'LEDGER' ? 'از دفتر معاملات' : 'ورودی دستی';
  result.textContent = `تحلیل موفق (${job.result.sourceType}): ${Number(job.result.transactionCount).toLocaleString('fa-IR')} تراکنش، سود ${Number(analysis.metrics.profit).toLocaleString('fa-IR')}، نسبت بدهی ${Number(analysis.metrics.debtRatio * 100).toLocaleString('fa-IR')}٪ (دارایی‌ها: ${originLabel(provenance.assets)}، بدهی‌ها: ${originLabel(provenance.liabilities)}). وضعیت: ${analysis.status}`;
  clearPersistedIngestJob();
  renderStatementInsight(null);
  syncWorkspaceSnapshot();
  await refreshDashboard();
  try {
    const insights = await getJson('/api/financial/insights', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceSha256: job.result.sha256 })
    });
    renderStatementInsight(insights.statementInsight || null);
    syncWorkspaceSnapshot();
    setWorkspaceContext({title:'نتیجه آماده است',description:'یافته‌ها، شواهد و محدودیت‌ها از همان منبع معتبر نمایش داده شده‌اند.',source:entry.sourceName,state:'تحلیل و بینش آماده',revealActions:true});
  } catch (error) {
    renderStatementInsight({ error: describeFailure(error) });
    syncWorkspaceSnapshot();
    setWorkspaceContext({title:'بخشی از تحلیل در دسترس نیست',description:'محدودیت دقیق در بخش نتیجه نمایش داده شده؛ دادهٔ قابل اتکا پنهان نشده است.',source:entry.sourceName,state:'نیازمند بررسی محدودیت',revealActions:true});
  }
}

let latestStatementInsight = null;

const FINANCIAL_METRIC_LABELS_FA = {
  revenue: 'درآمد',
  cogs: 'بهای تمام‌شده',
  grossProfit: 'سود ناخالص',
  operatingExpenses: 'هزینه‌های عملیاتی',
  operatingProfit: 'سود عملیاتی',
  netProfit: 'سود خالص',
  currentAssets: 'دارایی‌های جاری',
  totalAssets: 'کل دارایی‌ها',
  currentLiabilities: 'بدهی‌های جاری',
  totalLiabilities: 'کل بدهی‌ها',
  equity: 'حقوق مالکانه',
  operatingCashFlow: 'جریان نقد عملیاتی',
  investingCashFlow: 'جریان نقد سرمایه‌گذاری',
  financingCashFlow: 'جریان نقد تأمین مالی',
  netCashFlow: 'تغییر خالص وجه نقد'
};

const FINANCIAL_RATIO_LABELS_FA = {
  grossMargin: 'حاشیه سود ناخالص',
  operatingMargin: 'حاشیه سود عملیاتی',
  netMargin: 'حاشیه سود خالص',
  roa: 'بازده دارایی',
  roe: 'بازده حقوق مالکانه',
  currentRatio: 'نسبت جاری',
  quickRatio: 'نسبت آنی',
  cashRatio: 'نسبت نقد',
  debtToEquity: 'بدهی به حقوق مالکانه',
  debtToAssets: 'بدهی به دارایی',
  equityRatio: 'نسبت حقوق مالکانه'
};

const FINANCIAL_RATIO_PERCENT_KEYS = new Set([
  'grossMargin', 'operatingMargin', 'netMargin', 'roa', 'roe', 'debtToAssets', 'equityRatio'
]);

const FINANCIAL_COMPARATIVE_LABELS_FA = {
  revenue: 'درآمد',
  cogs: 'بهای تمام‌شده',
  grossProfit: 'سود ناخالص',
  operatingExpenses: 'هزینه‌های عملیاتی',
  operatingIncome: 'سود عملیاتی',
  netIncome: 'سود خالص',
  totalAssets: 'کل دارایی‌ها',
  totalLiabilities: 'کل بدهی‌ها',
  equity: 'حقوق مالکانه'
};

const FINANCIAL_INTEGRITY_LABELS_FA = {
  'balance-sheet-identity': 'ترازنامه',
  'gross-profit-identity': 'سود ناخالص',
  'operating-profit-identity': 'سود عملیاتی',
  'pre-tax-identity': 'سود قبل از مالیات',
  'net-profit-identity': 'سود خالص',
  'cash-flow-identity': 'جریان نقد'
};

function formatFaNumber(value, maximumFractionDigits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return n.toLocaleString('fa-IR', { maximumFractionDigits, minimumFractionDigits: 0 });
}

function formatFaAmount(value, currency = 'IRR') {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'نامشخص';
  const unit = currency === 'IRR' ? 'ریال' : (currency || 'واحد پول');
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${formatFaNumber(n / 1e12, 2)} تریلیون ${unit}`;
  if (abs >= 1e9) return `${formatFaNumber(n / 1e9, 2)} میلیارد ${unit}`;
  if (abs >= 1e6) return `${formatFaNumber(n / 1e6, 2)} میلیون ${unit}`;
  return `${formatFaNumber(n, 0)} ${unit}`;
}

function formatFaPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'نامشخص';
  return `${formatFaNumber(n * 100, 2)}٪`;
}

function formatFaRatio(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${formatFaNumber(n, 2)} برابر` : 'نامشخص';
}

function localizeFinancialText(value) {
  let text = String(value ?? '');
  const replacements = [
    ['Extracted net profit', 'سود خالص ثبت‌شده'],
    ['net profit', 'سود خالص'],
    ['Net margin', 'حاشیه سود خالص'],
    ['Gross margin', 'حاشیه سود ناخالص'],
    ['Operating margin', 'حاشیه سود عملیاتی'],
    ['Revenue increased', 'درآمد افزایش یافته است'],
    ['Revenue grew relative to the prior period.', 'درآمد نسبت به دوره قبل افزایش یافته است.'],
    ['Revenue declined relative to the prior period.', 'درآمد نسبت به دوره قبل کاهش یافته است.'],
    ['Current assets cover current liabilities in the reported period.', 'دارایی‌های جاری بدهی‌های جاری را پوشش می‌دهند.'],
    ['Operations generated positive net cash flow.', 'فعالیت‌های عملیاتی جریان نقد مثبت ایجاد کرده‌اند.'],
    ['earnings are cash-backed.', 'سود از جریان نقد پشتیبانی می‌شود.'],
    ['the capital structure is debt-heavy.', 'ساختار تأمین مالی بدهی‌محور است.'],
    ['unavailable', 'نامشخص'],
    ['not applicable', 'قابل اتکا نیست'],
    ['NOT_TESTABLE', 'قابل آزمون نیست'],
    ['RECONCILED', 'سازگار'],
    ['MISMATCH', 'دارای اختلاف'],
    ['EXTRACTED_FACT', 'واقعیت تأییدشده'],
    ['DERIVED_METRIC', 'شاخص مشتق‌شده'],
    ['INTERPRETATION', 'تفسیر'],
    ['MANAGEMENT_RECOMMENDATION', 'اقدام مدیریتی']
  ];
  for (const [from, to] of replacements) text = text.split(from).join(to);
  return text.replace(/[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?/gi, token => {
    const n = Number(token);
    return Number.isFinite(n) ? formatFaNumber(n, 6) : token;
  }).replace(/%/g, '٪');
}

function humanizeStatementStatus(status) {
  if (status === 'COMPLETED') return 'کامل';
  if (status === 'PARTIAL') return 'ناقص؛ بخشی از اطلاعات ممکن است در دسترس نباشد';
  if (status === 'READY') return 'آماده';
  return localizeFinancialText(status || 'نامشخص');
}

function evidenceBadge(level) {
  const labels={EXTRACTED_FACT:['واقعیت تأییدشده','evidence-fact'],DERIVED_METRIC:['شاخص مشتق‌شده','evidence-derived'],INTERPRETATION:['تفسیر','evidence-interpretation'],MANAGEMENT_RECOMMENDATION:['اقدام مدیریتی','evidence-recommendation']};
  const [label,className]=labels[level]||['نتیجه','evidence-derived'];
  const badge=document.createElement('span'); badge.className=`evidence-badge ${className}`; badge.textContent=label; return badge;
}

function findingMessage(finding) {
  return localizeFinancialText(typeof finding === 'string' ? finding : finding?.message ?? '');
}

function insightList(title, findings) {
  if (!Array.isArray(findings) || findings.length === 0) return null;
  const section=document.createElement('section'); section.className='result-block';
  const details=document.createElement('details'); details.open=title==='خلاصه مدیریتی (تفسیر)';
  const summary=document.createElement('summary'); summary.textContent=title; details.appendChild(summary);
  const list=document.createElement('ul');
  for(const finding of findings){
    const item=document.createElement('li'); item.className='evidence-item';
    const level=typeof finding==='string'?null:finding?.evidenceLevel;
    if(level)item.appendChild(evidenceBadge(level));
    const body=document.createElement('span'); body.textContent=findingMessage(finding); item.appendChild(body); list.appendChild(item);
  }
  details.appendChild(list); section.appendChild(details); return section;
}

function ratioLine(key, value, insight) {
  const label = FINANCIAL_RATIO_LABELS_FA[key] || key;
  if (value === null || value === undefined) return `${label}: نامشخص (شواهد کافی وجود ندارد)`;
  return FINANCIAL_RATIO_PERCENT_KEYS.has(key)
    ? `${label}: ${formatFaPercent(value)}`
    : `${label}: ${formatFaRatio(value)}`;
}

function comparativeLine(entry, currency) {
  const label = FINANCIAL_COMPARATIVE_LABELS_FA[entry.line] || localizeFinancialText(entry.line);
  const change = entry.absoluteChange;
  const direction = change > 0 ? 'افزایش' : change < 0 ? 'کاهش' : 'بدون تغییر';
  let percent = entry.pctChange === null || entry.pctChange === undefined
    ? (entry.pctChangeUnavailableReason === 'sign-reversal'
      ? 'درصد تغییر به دلیل تغییر علامت قابل اتکا نیست'
      : 'درصد تغییر قابل محاسبه نیست')
    : formatFaPercent(entry.pctChange);
  return `${label}: از ${formatFaAmount(entry.prior, currency)} به ${formatFaAmount(entry.current, currency)}؛ ${direction} ${formatFaAmount(Math.abs(change), currency)}؛ ${percent}`;
}

function integrityLine(check, currency) {
  const label = FINANCIAL_INTEGRITY_LABELS_FA[check.id] || check.id;
  if (check.status === 'RECONCILED') return `${label}: اعداد سند با کنترل حسابداری سازگارند.`;
  if (check.status === 'NOT_TESTABLE') {
    const missing = (check.missing || []).map(localizeFinancialText).join('، ');
    return `${label}: بررسی کامل ممکن نیست؛ اطلاعات لازم ${missing || 'در دسترس نیست'}.`;
  }
  return `${label}: بین اعداد این بخش ${formatFaAmount(Math.abs(check.difference), currency)} اختلاف وجود دارد.`;
}

function buildFinancialSummary(insight) {
  const c = insight.comparative || [];
  const current = key => insight.metrics?.[key];
  const find = key => c.find(item => item.line === key);
  const lines = [];
  const rev = find('revenue');
  const profit = find('netIncome');
  const gp = find('grossProfit');
  const opx = find('operatingExpenses');
  if (rev && profit) {
    const direction = profit.absoluteChange > 0 ? 'افزایش یافته' : profit.absoluteChange < 0 ? 'کاهش یافته' : 'بدون تغییر بوده است';
    lines.push(`سود خالص در مقایسه با دوره قبل ${direction} و اکنون ${formatFaAmount(current('netProfit'), insight.currency)} است.`);
    if (rev.absoluteChange > 0) lines.push(`درآمد نیز ${formatFaPercent(rev.pctChange)} رشد کرده است.`);
    if (gp?.absoluteChange > 0) lines.push(`سود ناخالص ${formatFaPercent(gp.pctChange)} رشد کرده است.`);
    if (opx?.absoluteChange < 0) lines.push(`هزینه‌های عملیاتی ${formatFaPercent(Math.abs(opx.pctChange))} کاهش یافته است.`);
  }
  if (insight.cashFlow?.operating != null) {
    lines.push(`جریان نقد عملیاتی ${formatFaAmount(insight.cashFlow.operating, insight.currency)} است.`);
  }
  return lines;
}

function buildFinancialAssistantAnswer(insight, question) {
  const q = String(question || '').replace(/\s+/g, ' ').trim();
  if (!insight) return null;
  const currency = insight.currency || 'IRR';
  const c = insight.comparative || [];
  const current = key => insight.metrics?.[key];
  const find = key => c.find(item => item.line === key);
  const lines = [];

  if (/چرا.*سود|سود.*تغییر|سود.*عوض/i.test(q)) {
    const rev=find('revenue'), profit=find('netIncome'), gp=find('grossProfit'), opx=find('operatingExpenses'), op=find('operatingIncome');
    if (profit) {
      lines.push(`سود خالص از ${formatFaAmount(profit.prior, currency)} به ${formatFaAmount(profit.current, currency)} رسیده است؛ ${profit.pctChange == null ? 'درصد تغییر به دلیل نوع تغییر قابل اتکا نیست' : `افزایش ${formatFaPercent(profit.pctChange)}`}.`);
    }
    if (rev && gp && opx && op) {
      lines.push(`عوامل قابل مشاهده در صورت مالی: درآمد ${rev.pctChange == null ? 'تغییر داشته' : ` ${formatFaPercent(rev.pctChange)} افزایش`}؛ سود ناخالص ${gp.pctChange == null ? 'تغییر داشته' : ` ${formatFaPercent(gp.pctChange)} افزایش`}؛ هزینه‌های عملیاتی ${opx.pctChange == null ? 'تغییر داشته' : ` ${formatFaPercent(Math.abs(opx.pctChange))} کاهش`}؛ سود عملیاتی ${op.pctChange == null ? 'تغییر داشته' : ` ${formatFaPercent(op.pctChange)} افزایش`}.`);
      lines.push('بنابراین داده‌ها با رشد هم‌زمان درآمد و سود ناخالص و کنترل هزینه‌های عملیاتی سازگار است؛ اما این موضوع علت قطعی همه اجزای تغییر سود را اثبات نمی‌کند.');
    } else {
      lines.push('برای توضیح علت تغییر سود، اطلاعات مقایسه‌ای کافی در سند موجود نیست.');
    }
  } else if (/ریسک/i.test(q)) {
    const debt=insight.ratios?.debtToAssets, liabilities=current('totalLiabilities'), equity=current('equity');
    if (debt != null) lines.push(`نسبت بدهی ${formatFaPercent(debt)} است؛ یعنی ${formatFaAmount(liabilities, currency)} بدهی در برابر ${formatFaAmount(equity, currency)} حقوق مالکانه.`);
    if (liabilities != null && equity != null && liabilities > equity) lines.push(`بدهی ${formatFaAmount(liabilities - equity, currency)} بیشتر از حقوق مالکانه است؛ این موضوع نیاز به کنترل ساختار تأمین مالی دارد.`);
    const mismatch=(insight.integrity||[]).find(x=>x.status==='MISMATCH');
    if (mismatch) lines.push(`یک اختلاف ${formatFaAmount(Math.abs(mismatch.difference), currency)} در کنترل ${FINANCIAL_INTEGRITY_LABELS_FA[mismatch.id] || 'حسابداری'} دیده شده است.`);
  } else if (/کم|ناقص|اطلاعات.*لازم|چه چیز/i.test(q)) {
    const limitations=(insight.limitations||[]).map(localizeFinancialText);
    lines.push(...limitations.slice(0,6));
    if (!lines.length) lines.push('در داده‌های فعلی، محدودیت مهمی ثبت نشده است.');
  } else {
    lines.push(...buildFinancialSummary(insight));
  }

  lines.push(`مبنای پاسخ: سند ${q ? 'و' : ''} با وضعیت «${humanizeStatementStatus(insight.documentStatus)}»؛ نتیجه فقط بر اساس شواهد موجود در همان سند است.`);
  return lines.join('\n');
}

function renderStatementInsight(insight) {
  const container = document.querySelector('#statement-insight');
  container.textContent = '';
  latestStatementInsight = insight || null;
  if (!insight) { container.hidden = true; return; }
  container.hidden = false;
  if (insight.error) {
    container.textContent = `تحلیل صورت مالی در دسترس نیست: ${insight.error}`;
    return;
  }

  const summary = document.createElement('h3');
  summary.textContent = 'تحلیل جامع صورت مالی — به زبان ساده';
  container.appendChild(summary);

  const meta = document.createElement('p');
  const periods = Array.isArray(insight.periods) ? insight.periods.map(p => p.label).join(' | ') : 'نامشخص';
  meta.textContent = `وضعیت سند: ${humanizeStatementStatus(insight.documentStatus)} — دوره‌ها: ${periods}`;
  container.appendChild(meta);

  const snapshot = document.createElement('div');
  snapshot.className='financial-snapshot';
  const snapshotItems = [
    ['درآمد', insight.metrics?.revenue, 'amount'],
    ['سود خالص', insight.metrics?.netProfit, 'amount'],
    ['نسبت بدهی', insight.ratios?.debtToAssets, 'percent'],
    ['جریان نقد عملیاتی', insight.cashFlow?.operating, 'amount']
  ];
  for (const [label,value,kind] of snapshotItems) {
    const card=document.createElement('article'); card.className='summary-card';
    const valueText=kind==='percent' ? formatFaPercent(value) : formatFaAmount(value, insight.currency || 'IRR');
    card.innerHTML=`<span>${label}</span><strong>${valueText}</strong>`;
    snapshot.appendChild(card);
  }
  container.appendChild(snapshot);

  const summaryLines = buildFinancialSummary(insight);
  if (summaryLines.length) {
    const executive=document.createElement('section'); executive.className='executive-summary';
    const h=document.createElement('h4'); h.textContent='برداشت مدیریتی'; executive.appendChild(h);
    const ul=document.createElement('ul');
    for(const line of summaryLines){ const li=document.createElement('li'); li.textContent=line; ul.appendChild(li); }
    executive.appendChild(ul); container.appendChild(executive);
  }

  const append = section => { if (section) container.appendChild(section); };
  const textSection = (title, lines) => {
    if (!Array.isArray(lines) || lines.length === 0) return null;
    const section=document.createElement('section'); section.className='result-block';
    const heading=document.createElement('h4'); heading.textContent=title; section.appendChild(heading);
    const list=document.createElement('ul');
    for(const line of lines){ const item=document.createElement('li'); item.textContent=line; list.appendChild(item); }
    section.appendChild(list); return section;
  };

  append(insightList('خلاصه مدیریتی (تفسیر)', insight.interpretation));

  if (insight.ratios) {
    const lines=Object.keys(FINANCIAL_RATIO_LABELS_FA).map(key=>ratioLine(key, insight.ratios[key], insight));
    append(textSection('نسبت‌های مالی', lines));
  }

  append(insightList('نقاط قوت', insight.strengths));
  append(insightList('نقاط ضعف', insight.weaknesses));
  append(insightList('ریسک‌ها', insight.risks));
  append(insightList('فرصت‌ها و رشد', insight.opportunities));
  append(insightList('اقدامات مدیریتی پیشنهادی', insight.managementActions));

  if (Array.isArray(insight.comparative) && insight.comparative.length > 0) {
    append(textSection('مقایسه با دوره قبل', insight.comparative.map(entry=>comparativeLine(entry, insight.currency || 'IRR')));
  }

  if (insight.cashFlow) {
    const cf=insight.cashFlow;
    append(textSection('جریان نقدی', [
      `جریان نقد عملیاتی: ${formatFaAmount(cf.operating, insight.currency || 'IRR')}`,
      `جریان نقد سرمایه‌گذاری: ${formatFaAmount(cf.investing, insight.currency || 'IRR')}`,
      `جریان نقد تأمین مالی: ${formatFaAmount(cf.financing, insight.currency || 'IRR')}`,
      `تغییر خالص وجه نقد: ${formatFaAmount(cf.net, insight.currency || 'IRR')}`,
      `جریان نقد عملیاتی دوره قبل: ${formatFaAmount(cf.priorOperating, insight.currency || 'IRR')}`,
      `کیفیت سود: ${cf.qualityOfEarnings === 'CASH_BACKED' ? 'سود از جریان نقد پشتیبانی می‌شود' : cf.qualityOfEarnings === 'PROFIT_NOT_CASH_BACKED' ? 'سود کاملاً به جریان نقد تبدیل نشده است' : 'نامشخص'}`
    ]));
  }

  if (Array.isArray(insight.integrity) && insight.integrity.length > 0) {
    append(textSection('کنترل‌های سازگاری حسابداری', insight.integrity.map(check=>integrityLine(check, insight.currency || 'IRR'))));
  }

  if (insight.derivedResidual) {
    append(textSection('مقدار باقیمانده مشتق‌شده', [
      `مقدار: ${formatFaAmount(insight.derivedResidual.value, insight.currency || 'IRR')}`,
      'این مقدار جمع هزینه‌های استخراج‌شده از صورت مالی نیست؛ از درآمد منهای سود خالص به‌صورت مشتق‌شده به دست آمده است.'
    ]));
  }

  append(textSection('محدودیت‌ها و داده‌های نامشخص', (insight.limitations || []).map(localizeFinancialText)));
}


document.querySelector('#analysis-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#analysis-result');
  const file = document.querySelector('#csv-file').files[0];
  if (!file) return;
  result.textContent = '';
  try {
    const { format, binary } = resolveIngestRequest(file);
    const ingestBody = { sourceName: file.name, format };
    if (binary) ingestBody.contentBase64 = await fileToBase64(file);
    else ingestBody.content = await readFileText(file);

    const entry = {
      jobId: null,
      sourceName: file.name,
      format,
      createdAt: new Date().toISOString()
    };
    renderIngestJob({ stage: 'RECEIVED', message: INGEST_STAGE_LABELS_FA.RECEIVED, receivedAt: entry.createdAt, progress: null });

    let created;
    try {
      created = await getJson('/api/ingest/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey('ingest:job') },
        body: JSON.stringify(ingestBody)
      });
    } catch (error) {
      if (offlineSync && isConnectivityError(error)) {
        try {
          await offlineSync.enqueue({
            ...ingestBody,
            baseWatermark: lastSyncCursors.get(file.name) || null,
            idempotencyKey: idempotencyKey('ingest:job')
          });
        } catch (storageError) {
          result.textContent = `ذخیره در صف آفلاین ناموفق بود: ${describeFailure(storageError)} فایل حفظ شد؛ پس از برقراری اتصال دوباره تلاش کنید.`;
          return;
        }
        rotateIdempotencyKey('ingest:job');
        result.textContent = 'اتصال در دسترس نیست؛ کار در صف آفلاین ذخیره شد و پس از برقراری اتصال خودکار همگام‌سازی می‌شود.';
        return;
      }
      throw error;
    }

    entry.jobId = created.jobId;
    persistIngestJob(entry);

    if (created.replayed && created.diagnostics && created.diagnostics.idempotency === 'IDEMPOTENCY_IN_PROGRESS') {
      result.textContent = 'این درخواست هم‌اکنون در حال پردازش است…';
    }

    const job = await pollIngestJob(created.jobId);
    rotateIdempotencyKey('ingest:job');
    await finishIngestJob(job, entry);
  } catch (error) {
    result.textContent = `تحلیل ناموفق بود: ${describeFailure(error)}`;
  }
});

/** Resume an in-flight ingest after an ordinary page refresh. */
async function resumePersistedIngestJob() {
  const entry = readPersistedIngestJob();
  if (!entry || !entry.jobId) return;
  try {
    renderIngestJob({ stage: 'RECEIVED', message: 'بازیابی وضعیت پردازش…', receivedAt: entry.createdAt, progress: null });
    const job = await pollIngestJob(entry.jobId);
    await finishIngestJob(job, entry);
  } catch {
    clearPersistedIngestJob();
  }
}

document.querySelector('#executive-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#executive-result');
  try {
    const payload = await getJson('/api/executive/workbench', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        targets: {
          revenue: Number(document.querySelector('#target-revenue').value),
          profit: Number(document.querySelector('#target-profit').value),
          profitMargin: Number(document.querySelector('#target-margin').value),
          debtRatio: Number(document.querySelector('#target-debt').value)
        }
      })
    });
    result.textContent = JSON.stringify({
      status: payload.status,
      kpis: payload.kpis,
      performance: payload.performance,
      recommendations: payload.recommendations
    }, null, 2);
    await refreshDashboard();
  } catch (error) {
    result.textContent = `محاسبه مدیریتی ناموفق بود: ${error.message}`;
  }
});

document.querySelector('#decision-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#decision-result');
  try {
    const alternatives = [
      document.querySelector('#decision-alt-1').value,
      document.querySelector('#decision-alt-2').value
    ];
    const rows = [...document.querySelectorAll('.decision-row')];
    const criteria = rows.map(row => ({
      name: row.querySelector('.criterion-name').value,
      weight: Number(row.querySelector('.criterion-weight').value),
      direction: row.querySelector('.criterion-direction').value
    }));
    const scores = alternatives.map((_, alternativeIndex) => rows.map(row =>
      Number(row.querySelector(alternativeIndex === 0 ? '.criterion-score-1' : '.criterion-score-2').value)
    ));
    const payload = await getJson('/api/decision/workbench', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        problem: document.querySelector('#decision-problem').value,
        alternatives,
        criteria,
        scores
      })
    });
    result.textContent = JSON.stringify({
      status: payload.status,
      recommendation: payload.recommendation,
      weightsSource: payload.weightsSource,
      consistency: payload.consistency,
      evaluations: payload.evaluations
    }, null, 2);
  } catch (error) {
    result.textContent = `ارزیابی تصمیم ناموفق بود: ${error.message}`;
  }
});

async function refreshExecution() {
  const container = document.querySelector('#execution-list');
  try {
    const payload = await getJson('/api/execution/work-items');
    if (!payload.workItems.length) {
      container.textContent = 'هنوز کار اجرایی ثبت نشده است. ابتدا تصمیم بسازید و سپس کار ایجاد کنید.';
      return;
    }
    container.innerHTML = '';
    for (const item of payload.workItems) {
      const card = document.createElement('div');
      card.className = 'execution-item';
      const heading = document.createElement('div');
      heading.className = 'execution-heading';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const status = document.createElement('span');
      status.className = 'execution-status';
      status.textContent = item.status;
      heading.append(title, status);
      const details = document.createElement('p');
      details.textContent = `پیشنهاد تصمیم: ${item.decision?.recommendation ?? '—'} | مسئول: ${item.assignment?.assigneeId ?? '—'} | موعد: ${item.dueDate ?? '—'}`;
      card.append(heading, details);
      if (item.kpi) {
        const kpi = document.createElement('p');
        kpi.textContent = `KPI ${item.kpi.metric}: ${item.kpi.actual}/${item.kpi.target} (${item.kpi.status})`;
        card.appendChild(kpi);
      }
      const actions = document.createElement('div');
      actions.className = 'execution-actions';
      for (const [action, label] of [['approve', 'تأیید'], ['reject', 'رد'], ['assign', 'واگذاری'], ['start', 'شروع'], ['complete', 'تکمیل']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', () => runExecutionAction(item.workItemId, action));
        actions.appendChild(button);
      }
      card.appendChild(actions);
      container.appendChild(card);
    }
  } catch (error) {
    container.textContent = `دریافت کارهای اجرایی ناموفق بود: ${error.message}`;
  }
}

async function runExecutionAction(workItemId, action) {
  const result = document.querySelector('#execution-result');
  try {
    const body = {};
    if (action === 'assign') {
      body.assigneeId = document.querySelector('#execution-assignee').value;
      const due = document.querySelector('#execution-due').value;
      if (due) body.dueDate = new Date(due).toISOString();
    }
    if (action === 'complete') {
      body.kpi = {
        metric: document.querySelector('#execution-kpi-metric').value,
        target: Number(document.querySelector('#execution-kpi-target').value),
        actual: Number(document.querySelector('#execution-kpi-actual').value)
      };
      body.feedback = { result: 'DELIVERED', notes: 'ثبت از رابط کاربری' };
    }
    if (action === 'reject') body.reason = 'رد از رابط کاربری';
    const payload = await getJson(`/api/execution/work-items/${encodeURIComponent(workItemId)}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    result.textContent = `عملیات ${action} انجام شد. وضعیت جدید: ${payload.status}`;
    await refreshExecution();
  } catch (error) {
    result.textContent = `عملیات اجرایی ناموفق بود: ${error.message}`;
  }
}

document.querySelector('#execution-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#execution-result');
  try {
    const payload = await getJson('/api/execution/work-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey('work-items:propose') },
      body: JSON.stringify({
        title: document.querySelector('#execution-title').value,
        priority: document.querySelector('#execution-priority').value
      })
    });
    rotateIdempotencyKey('work-items:propose');
    result.textContent = `کار اجرایی ${payload.workItemId} در وضعیت ${payload.status} ایجاد شد.`;
    await refreshExecution();
  } catch (error) {
    result.textContent = `ایجاد کار اجرایی ناموفق بود: ${error.message}`;
  }
});

document.querySelector('#execution-refresh').addEventListener('click', refreshExecution);

document.querySelector('#report-button').addEventListener('click', async () => {  const result = document.querySelector('#report-result');
  try {
    const payload = await getJson('/api/report');
    result.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    result.textContent = `تولید گزارش ناموفق بود: ${error.message}`;
  }
});

async function refreshReportArtifacts() {
  const container = document.querySelector('#report-artifacts');
  if (!container) return;
  try {
    const payload = await getJson('/api/report/artifacts');
    if (!payload.artifacts.length) {
      container.textContent = 'هنوز فایل گزارشی تولید نشده است. برای شروع دکمه «تولید و دانلود فایل گزارش» را بزنید.';
      return;
    }
    container.innerHTML = '';
    for (const artifact of payload.artifacts) {
      const card = document.createElement('div');
      card.className = 'execution-item';
      const heading = document.createElement('div');
      heading.className = 'execution-heading';
      const title = document.createElement('strong');
      title.textContent = artifact.fileName;
      const format = document.createElement('span');
      format.className = 'execution-status';
      format.textContent = artifact.format;
      heading.append(title, format);
      const details = document.createElement('p');
      details.textContent = `${Number(artifact.byteLength).toLocaleString('fa-IR')} بایت | ${artifact.generatedAt} | SHA-256 ${artifact.sha256.slice(0, 12)}…`;
      const link = document.createElement('a');
      link.className = 'primary';
      link.href = `/api/report/artifacts/${encodeURIComponent(artifact.artifactId)}/download`;
      link.textContent = 'دانلود';
      link.setAttribute('download', artifact.fileName);
      card.append(heading, details, link);
      container.appendChild(card);
    }
  } catch (error) {
    container.textContent = `دریافت فایل‌های گزارش ناموفق بود: ${error.message}`;
  }
}

document.querySelector('#report-export-button').addEventListener('click', async () => {
  const result = document.querySelector('#report-result');
  const format = document.querySelector('#report-format').value;
  try {
    const payload = await getJson('/api/report/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey('report:export') },
      body: JSON.stringify({ format })
    });
    rotateIdempotencyKey('report:export');
    const fileResponse = await fetch(payload.downloadUrl);
    if (!fileResponse.ok) throw new Error(`DOWNLOAD_HTTP_${fileResponse.status}`);
    const blob = await fileResponse.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = payload.artifact.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    result.textContent = `گزارش ${payload.artifact.format} تولید و دانلود شد: ${payload.artifact.fileName} (${Number(payload.artifact.byteLength).toLocaleString('fa-IR')} بایت) — SHA-256: ${payload.artifact.sha256.slice(0, 16)}…`;
    await refreshReportArtifacts();
  } catch (error) {
    result.textContent = `تولید فایل گزارش ناموفق بود: ${error.message}`;
  }
});

document.querySelector('#assistant-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#assistant-result');
  try {
    const payload = await getJson('/api/assistant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: document.querySelector('#assistant-question').value })
    });
    result.textContent = buildFinancialAssistantAnswer(latestStatementInsight, payload.question) || localizeFinancialText(payload.answer || 'پاسخی در دسترس نیست.');
  } catch (error) {
    result.textContent = `دستیار در دسترس نیست: ${error.message}`;
  }
});

document.querySelector('#resilience-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#resilience-result');
  try {
    const payload = await getJson('/api/resilience/stress-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        metric: document.querySelector('#resilience-metric').value,
        baseValue: Number(document.querySelector('#resilience-base').value),
        simulationCount: Number(document.querySelector('#resilience-simulations').value),
        scenarios: [{ name: 'base', description: 'Base', shockPercent: 0, appliedAt: 1 }]
      })
    });
    result.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    result.textContent = `تحلیل تاب‌آوری ناموفق بود: ${error.message}`;
  }
});

document.querySelector('#impact-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#impact-result');
  try {
    const payload = await getJson('/api/impact/measure', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        baseline: {
          revenue: Number(document.querySelector('#impact-revenue-before').value),
          profit: Number(document.querySelector('#impact-profit-before').value),
          profitMargin: 0.2,
          debtRatio: 0.3,
          cycleTime: 10,
          throughput: 50,
          errorRate: 0.05,
          capacity: 100,
          operatingCost: Number(document.querySelector('#impact-cost-before').value),
          decisionLatency: 2,
          riskScore: 0.1,
          recordedAt: '2026-01-01T00:00:00Z'
        },
        post: {
          revenue: Number(document.querySelector('#impact-revenue-after').value),
          profit: Number(document.querySelector('#impact-profit-after').value),
          profitMargin: 0.25,
          debtRatio: 0.25,
          cycleTime: 8,
          throughput: 60,
          errorRate: 0.03,
          capacity: 120,
          operatingCost: Number(document.querySelector('#impact-cost-after').value),
          decisionLatency: 1.5,
          riskScore: 0.08,
          recordedAt: '2026-02-01T00:00:00Z'
        }
      })
    });
    result.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    result.textContent = `سنجش تأثیر ناموفق بود: ${error.message}`;
  }
});

document.querySelector('#improvement-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#improvement-result');
  try {
    const payload = await getJson('/api/improvement/improve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        domain: document.querySelector('#improvement-domain').value,
        actualImpact: {
          timeSaved: 2,
          operatingCostReduced: 50,
          actualFinancialValue: 100,
          actualROI: 0.2,
          sustainability: 'SUSTAINABLE'
        },
        currentState: {
          revenue: 5000,
          profit: 1000,
          riskScore: Number(document.querySelector('#improvement-risk').value),
          decisionLatency: Number(document.querySelector('#improvement-latency').value)
        }
      })
    });
    result.textContent = JSON.stringify(payload, null, 2);
  } catch (error) {
    result.textContent = `تحلیل بهبود ناموفق بود: ${error.message}`;
  }
});

function parseNumberList(value) {
  const parts = String(value || '').split(',').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const numbers = parts.map(Number);
  return numbers.every(Number.isFinite) ? numbers : null;
}

async function refreshAnalyticsSources() {
  const select = document.querySelector('#analytics-source');
  if (!select) return;
  try {
    const payload = await getJson('/api/sources');
    const current = select.value;
    select.innerHTML = '<option value="">— انتخاب منبع —</option>';
    for (const source of payload.sources || []) {
      const option = document.createElement('option');
      option.value = source.sha256;
      option.textContent = `${source.sourceName} (${source.format})`;
      select.appendChild(option);
    }
    if (current) select.value = current;
  } catch {
    select.innerHTML = '<option value="">— ابتدا نشست ایجاد کنید —</option>';
  }
}

document.querySelector('#analytics-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#analytics-result');
  try {
    const body = {};
    const sourceSha256 = document.querySelector('#analytics-source').value;
    if (sourceSha256) body.sourceSha256 = sourceSha256;
    const series = parseNumberList(document.querySelector('#analytics-series').value);
    if (series) body.series = series;
    const statementText = document.querySelector('#analytics-statement').value.trim();
    if (statementText) body.statement = JSON.parse(statementText);
    const priceField = document.querySelector('#analytics-price').value;
    const fixed = Number(document.querySelector('#analytics-fixed').value);
    const variable = Number(document.querySelector('#analytics-variable').value);
    const price = Number(priceField);
    const units = Number(document.querySelector('#analytics-units').value);
    if (priceField !== '' && [fixed, variable, price, units].every(Number.isFinite)) {
      body.breakEven = { fixedCosts: fixed, variableCostPerUnit: variable, pricePerUnit: price, unitsSold: units };
    }
    const payload = await getJson('/api/financial/insights', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const summary = { status: payload.status, source: payload.source?.sourceName, ingestedTransactions: payload.ingestedSource?.transactionCount };
    if (payload.ratios) {
      summary.ratios = {
        verticalRows: payload.ratios.vertical?.rows?.length ?? 0,
        profitability: payload.ratios.profitability,
        leverage: payload.ratios.leverage
      };
    }
    if (payload.breakEven) summary.breakEven = payload.breakEven;
    if (payload.forecast) summary.forecast = { naive: payload.forecast.naive, movingAverage: payload.forecast.movingAverage, linearTrend: payload.forecast.linearTrend };
    if (payload.anomalies) {
      summary.anomalies = {
        zscoreAlerts: payload.anomalies.zscore.points.filter(point => point.flag !== 'NORMAL').length,
        iqrAlerts: payload.anomalies.iqr.points.filter(point => point.flag !== 'NORMAL').length
      };
    }
    result.textContent = JSON.stringify(summary, null, 2);
  } catch (error) {
    result.textContent = `تحلیل پیشرفته ناموفق بود: ${error.message}`;
  }
});

wireWorkspaceInteractions();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
if (typeof window !== 'undefined') window.addEventListener('online', () => { flushOfflineQueue(); });
refreshSessionState();
refreshDashboard();
refreshSyncState();
resumePersistedIngestJob();
