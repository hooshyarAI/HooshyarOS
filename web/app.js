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
      if (message === 'INGEST_FORMAT_UNSUPPORTED') {
        return 'این فرمت فایل در حال حاضر پشتیبانی نمی‌شود (PDF/DOCX/XLS/تصویر)؛ فایل CSV، JSON، TXT یا XLSX انتخاب کنید.';
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
    return session;
  } catch {
    result.textContent = 'نشست فعالی وجود ندارد. ثبت‌نام کنید یا با گذرواژه وارد شوید.';
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
 * shared format table. Binary formats are sent as `contentBase64`; text
 * formats as `content`. PDF is a known-but-unsupported format: it is sent with
 * its correct identifier so the canonical runtime can fail it closed precisely
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

document.querySelector('#analysis-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#analysis-result');
  const file = document.querySelector('#csv-file').files[0];
  if (!file) return;
  try {
    const { format, binary } = resolveIngestRequest(file);
    const ingestBody = { sourceName: file.name, format };
    if (binary) ingestBody.contentBase64 = await fileToBase64(file);
    else ingestBody.content = await readFileText(file);
    let ingested;
    try {
      ingested = await getJson('/api/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey('ingest') },
        body: JSON.stringify(ingestBody)
      });
      rotateIdempotencyKey('ingest');
    } catch (error) {
      if (offlineSync && isConnectivityError(error)) {
        try {
          await offlineSync.enqueue({
            ...ingestBody,
            baseWatermark: lastSyncCursors.get(file.name) || null,
            idempotencyKey: idempotencyKey('ingest')
          });
        } catch (storageError) {
          result.textContent = `ذخیره در صف آفلاین ناموفق بود: ${describeFailure(storageError)} فایل حفظ شد؛ پس از برقراری اتصال دوباره تلاش کنید.`;
          return;
        }
        rotateIdempotencyKey('ingest');
        result.textContent = 'اتصال در دسترس نیست؛ کار در صف آفلاین ذخیره شد و پس از برقراری اتصال خودکار همگام‌سازی می‌شود.';
        return;
      }
      throw error;
    }
    const analysis = await getJson('/api/financial/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceSha256: ingested.evidence.sha256,
        assets: Number(document.querySelector('#assets').value),
        liabilities: Number(document.querySelector('#liabilities').value)
      })
    });
    result.textContent = `تحلیل موفق (${format}): سود ${Number(analysis.metrics.profit).toLocaleString('fa-IR')}، نسبت بدهی ${Number(analysis.metrics.debtRatio * 100).toLocaleString('fa-IR')}٪. وضعیت: ${analysis.status}`;
    await refreshDashboard();  } catch (error) {
    result.textContent = `تحلیل ناموفق بود: ${describeFailure(error)}`;
  }
});

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
    result.textContent = text(payload);
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
if (typeof window !== 'undefined') window.addEventListener('online', () => { flushOfflineQueue(); });
refreshSessionState();
refreshDashboard();
refreshSyncState();
