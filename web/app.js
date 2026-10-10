const MAX_BODY_BYTES = 1024 * 1024;
const $ = selector => document.querySelector(selector);

class ApiError extends Error {
  constructor(code, status, payload) {
    super(code);
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

class NetworkError extends Error {}

const ERROR_MESSAGES = {
  AUTHENTICATION_REQUIRED: 'نشست فعالی وجود ندارد یا منقضی شده است. ابتدا نشست ایجاد کنید.',
  SESSION_FIELDS_REQUIRED: 'نام کاربری و سازمان هر دو الزامی هستند.',
  BALANCE_SHEET_FIELDS_REQUIRED: 'مقدار دارایی‌ها و بدهی‌ها باید عدد معتبر باشد.',
  'request-body-too-large': 'حجم فایل بیش از حد مجاز سرور (۱ مگابایت) است.',
  'request-json-invalid': 'درخواست ارسال‌شده نامعتبر بود.',
  NOT_FOUND: 'مسیر درخواستی در سرور وجود ندارد.',
  INVALID_RESPONSE: 'پاسخ سرور قابل خواندن نبود.'
};

const OBSERVATION_MESSAGES = {
  LOSS: 'صورت مالی تحلیل‌شده سود منفی (زیان) دارد.',
  PROFITABLE: 'صورت مالی تحلیل‌شده سود غیرمنفی دارد.'
};

const faNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const faDate = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });

function describeError(error) {
  if (error instanceof NetworkError) return 'اتصال به سرور برقرار نشد. وضعیت شبکه یا اجرای سرور را بررسی کنید.';
  if (error instanceof ApiError) return ERROR_MESSAGES[error.code] ?? `خطای سرور (${error.code})`;
  return 'خطای پیش‌بینی‌نشده رخ داد.';
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...options });
  } catch {
    throw new NetworkError('NETWORK_ERROR');
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('INVALID_RESPONSE', response.status, null);
  }
  if (!response.ok) {
    const code = payload?.error ?? (payload?.status === 'BLOCKED' ? 'ANALYSIS_BLOCKED' : `HTTP_${response.status}`);
    throw new ApiError(code, response.status, payload);
  }
  return payload;
}

function setPill(element, tone, text) {
  element.className = `pill pill-${tone}`;
  element.querySelector('.pill-text').textContent = text;
}

function setResult(element, tone, text) {
  element.dataset.tone = tone;
  element.textContent = text;
}

function showAlert(message) {
  $('#global-alert-text').textContent = message;
  $('#global-alert').hidden = false;
}

function hideAlert() {
  $('#global-alert').hidden = true;
}

function setKpi(id, value) {
  const element = $(id);
  element.dataset.state = value === null ? 'empty' : 'ready';
  delete element.dataset.tone;
  element.textContent = value === null ? '—' : value;
}

function setKpisLoading() {
  $('#kpis').setAttribute('aria-busy', 'true');
  for (const id of ['#revenue', '#profit', '#risk']) {
    const element = $(id);
    element.dataset.state = 'loading';
    element.innerHTML = '<span class="skeleton" aria-hidden="true"></span><span class="sr-only">در حال بارگذاری</span>';
  }
}

function renderUnavailable(title, text) {
  $('#kpis').setAttribute('aria-busy', 'false');
  setKpi('#revenue', null);
  setKpi('#profit', null);
  setKpi('#risk', null);
  $('#dashboard-empty-title').textContent = title;
  $('#dashboard-empty-text').textContent = text;
  $('#dashboard-empty').hidden = false;
  $('#dashboard-meta').textContent = '—';
  renderObservations(null);
  renderSource(null);
}

function renderObservations(observations) {
  const list = $('#observations');
  list.replaceChildren();
  if (!observations || observations.length === 0) {
    const item = document.createElement('li');
    item.className = 'muted';
    item.textContent = observations ? 'یافته‌ای از تحلیل برنگشت.' : 'پس از تحلیل نمایش داده می‌شود.';
    list.append(item);
    return;
  }
  for (const observation of observations) {
    const item = document.createElement('li');
    item.className = observation.code === 'LOSS' ? 'finding finding-warn' : 'finding finding-ok';
    item.textContent = OBSERVATION_MESSAGES[observation.code] ?? observation.message;
    list.append(item);
  }
}

function renderSource(source) {
  const details = $('#source');
  details.replaceChildren();
  const rows = source
    ? [
        ['نام فایل', source.sourceName, 'ltr'],
        ['نوع', source.sourceType, 'ltr'],
        ['زمان دریافت', source.receivedAt ? faDate.format(new Date(source.receivedAt)) : '—'],
        ['اثر انگشت SHA-256', source.sha256 ? `${source.sha256.slice(0, 16)}…` : '—', 'ltr', source.sha256]
      ]
    : [['وضعیت', 'پس از تحلیل نمایش داده می‌شود.']];
  for (const [label, value, dir, title] of rows) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value ?? '—';
    if (dir) dd.dir = dir;
    if (title) dd.title = title;
    if (!source) dd.className = 'muted';
    row.append(dt, dd);
    details.append(row);
  }
}

function renderDashboard(dashboard) {
  $('#kpis').setAttribute('aria-busy', 'false');
  if (!dashboard.analysisAvailable) {
    renderUnavailable('هنوز تحلیلی انجام نشده است', 'نشست فعال است اما هیچ تحلیلی برای آن ثبت نشده. یک فایل CSV را در بخش «تحلیل صورت مالی» بارگذاری کنید.');
    return;
  }
  $('#dashboard-empty').hidden = true;
  const { revenue, profit, risk } = dashboard.metrics ?? {};
  setKpi('#revenue', Number.isFinite(revenue) ? faNumber.format(revenue) : null);
  setKpi('#profit', Number.isFinite(profit) ? faNumber.format(profit) : null);
  setKpi('#risk', Number.isFinite(risk) ? `${faNumber.format(risk)}٪` : null);
  if (Number.isFinite(profit) && profit < 0) $('#profit').dataset.tone = 'negative';
  const received = dashboard.source?.receivedAt ? faDate.format(new Date(dashboard.source.receivedAt)) : null;
  $('#dashboard-meta').textContent = received ? `آخرین به‌روزرسانی: ${received}` : 'زمان به‌روزرسانی ثبت نشده است';
  renderObservations(dashboard.observations ?? []);
  renderSource(dashboard.source ?? null);
}

async function refreshDashboard() {
  hideAlert();
  setKpisLoading();
  setPill($('#connection-status'), 'pending', 'در حال بررسی اتصال…');

  try {
    const ready = await request('/api/ready');
    setPill($('#connection-status'), ready.status === 'READY' ? 'ok' : 'warn', ready.status === 'READY' ? 'سرور متصل و آماده' : 'سرور نیازمند بررسی');
  } catch (error) {
    setPill($('#connection-status'), 'error', 'اتصال به سرور برقرار نیست');
    setPill($('#session-status'), 'muted', 'نشست: نامشخص');
    renderUnavailable('داده در دسترس نیست', describeError(error));
    showAlert(describeError(error));
    return;
  }

  try {
    const session = await request('/api/session');
    setPill($('#session-status'), 'ok', `نشست: ${session.organization?.name ?? 'فعال'}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setPill($('#session-status'), 'warn', 'نشست: ایجاد نشده');
      renderUnavailable('نیاز به نشست', 'برای مشاهده داشبورد ابتدا در بخش «ایجاد نشست» نشست بسازید.');
      return;
    }
    setPill($('#session-status'), 'error', 'نشست: خطا در بررسی');
    renderUnavailable('داده در دسترس نیست', describeError(error));
    showAlert(describeError(error));
    return;
  }

  try {
    renderDashboard(await request('/api/dashboard'));
  } catch (error) {
    renderUnavailable('بارگذاری داشبورد ناموفق بود', describeError(error));
    showAlert(describeError(error));
  }
}

function setBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = busy;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
}

$('#session-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $('#session-result');
  const username = $('#username').value.trim();
  const organization = $('#organization').value.trim();
  if (!username || !organization) {
    setResult(result, 'error', ERROR_MESSAGES.SESSION_FIELDS_REQUIRED);
    return;
  }
  setBusy(form, true, 'در حال ایجاد…');
  try {
    const payload = await request('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, organization })
    });
    setResult(result, 'success', `نشست «${payload.organization.name}» با موفقیت ایجاد شد.`);
    await refreshDashboard();
  } catch (error) {
    setResult(result, 'error', `ایجاد نشست ناموفق بود: ${describeError(error)}`);
  } finally {
    setBusy(form, false);
  }
});

$('#analysis-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $('#analysis-result');
  const file = $('#csv-file').files[0];
  const assetsRaw = $('#assets').value.trim();
  const liabilitiesRaw = $('#liabilities').value.trim();
  if (!file) {
    setResult(result, 'error', 'یک فایل CSV انتخاب کنید.');
    return;
  }
  if (assetsRaw === '' || liabilitiesRaw === '' || !Number.isFinite(Number(assetsRaw)) || !Number.isFinite(Number(liabilitiesRaw))) {
    setResult(result, 'error', ERROR_MESSAGES.BALANCE_SHEET_FIELDS_REQUIRED);
    return;
  }
  if (file.size > MAX_BODY_BYTES) {
    setResult(result, 'error', ERROR_MESSAGES['request-body-too-large']);
    return;
  }
  setBusy(form, true, 'در حال تحلیل…');
  setResult(result, 'info', 'فایل در حال ارسال و تحلیل است…');
  try {
    const payload = await request('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceName: file.name,
        csv: await file.text(),
        assets: Number(assetsRaw),
        liabilities: Number(liabilitiesRaw)
      })
    });
    setResult(result, 'success', `تحلیل موفق: سود ${faNumber.format(payload.metrics.profit)}، نسبت بدهی ${faNumber.format(payload.metrics.debtRatio * 100)}٪.`);
    await refreshDashboard();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ANALYSIS_BLOCKED') {
      const reason = error.payload?.reasoningEvidence?.status;
      setResult(result, 'error', `تحلیل مسدود شد و نتیجه‌ای ثبت نشد${reason ? ` (${reason})` : ''}. داده ورودی را بررسی کنید.`);
    } else {
      setResult(result, 'error', `تحلیل ناموفق بود: ${describeError(error)}`);
    }
    if (error instanceof ApiError && error.status === 401) await refreshDashboard();
  } finally {
    setBusy(form, false);
  }
});

$('#retry-button').addEventListener('click', () => refreshDashboard());

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
refreshDashboard();
