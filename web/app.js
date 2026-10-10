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
  EXECUTIVE_TARGETS_INVALID: 'همه هدف‌ها باید عدد معتبر و بزرگ‌تر از صفر باشند.',
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

let currentHistory = [];

const TREND_METRICS = {
  revenue: { label: 'درآمد', color: '#167d75', value: item => item.metrics?.revenue },
  profit: { label: 'سود', color: '#4774bd', value: item => item.metrics?.profit },
  risk: { label: 'ریسک بدهی', color: '#c07828', value: item => item.metrics?.risk }
};

const EXECUTIVE_METRICS = {
  revenue: { label: 'درآمد', direction: 'بیشتر بهتر است', format: value => faNumber.format(value) },
  profit: { label: 'سود', direction: 'بیشتر بهتر است', format: value => faNumber.format(value) },
  profitMargin: { label: 'حاشیه سود', direction: 'بیشتر بهتر است', format: value => `${faNumber.format(value * 100)}٪` },
  debtRatio: { label: 'نسبت بدهی', direction: 'کمتر بهتر است', format: value => `${faNumber.format(value * 100)}٪` }
};

function renderExecutiveTargets(targets) {
  const fields = [
    ['#target-revenue', targets?.revenue],
    ['#target-profit', targets?.profit],
    ['#target-profit-margin', Number.isFinite(targets?.profitMargin) ? targets.profitMargin * 100 : null],
    ['#target-debt-ratio', Number.isFinite(targets?.debtRatio) ? targets.debtRatio * 100 : null]
  ];
  for (const [selector, value] of fields) {
    $(selector).value = Number.isFinite(value) ? String(value) : '';
  }
  $('#target-config-status').textContent = targets
    ? 'هدف‌های صریح سازمان بارگذاری شد؛ ارزیابی بر همین مبنا انجام می‌شود.'
    : 'هنوز هدفی ثبت نشده است؛ هوشیار هدف پیش‌فرض یا ساختگی ایجاد نمی‌کند.';
}

function renderExecutiveEvaluation(evaluation, targetsConfigured) {
  const list = $('#executive-findings');
  list.replaceChildren();
  const note = $('#executive-evaluation-note');
  if (!targetsConfigured) {
    note.textContent = 'ابتدا هدف‌های واقعی سازمان را ثبت کنید تا شاخص‌های تحلیل‌شده با همان هدف‌ها مقایسه شوند.';
    const item = document.createElement('li');
    item.className = 'muted';
    item.textContent = 'بدون هدف مصوب، وضعیت مدیریتی اعلام نمی‌شود.';
    list.append(item);
    return;
  }
  if (!evaluation) {
    note.textContent = 'هدف‌ها ثبت شده‌اند؛ پس از ثبت یک تحلیل مالی موفق، نتیجه مقایسه نمایش داده می‌شود.';
    const item = document.createElement('li');
    item.className = 'muted';
    item.textContent = 'هنوز داده مالی موفقی برای ارزیابی وجود ندارد.';
    list.append(item);
    return;
  }
  note.textContent = 'مقایسه بر اساس آخرین تحلیل موفق و هدف‌هایی است که سازمان ثبت کرده است؛ وضعیت به‌تنهایی علت انحراف را اثبات نمی‌کند.';
  evaluation.kpis.forEach((kpi, index) => {
    const metric = EXECUTIVE_METRICS[kpi.name];
    if (!metric) return;
    const recommendation = evaluation.recommendations[index];
    const status = recommendation?.status ?? 'BLOCKED';
    const statusText = status === 'ON_TRACK'
      ? 'در محدوده هدف'
      : status === 'AT_RISK'
        ? 'نیازمند بررسی فاصله از هدف'
        : 'ارزیابی مسدود شد';
    const item = document.createElement('li');
    item.className = `finding ${status === 'ON_TRACK' ? 'finding-ok' : 'finding-warn'} executive-finding`;
    const title = document.createElement('strong');
    title.textContent = `${metric.label}: ${statusText}`;
    const detail = document.createElement('p');
    detail.textContent = `مقدار واقعی: ${metric.format(kpi.actual)}؛ هدف: ${metric.format(kpi.target)}. قاعده این شاخص: ${metric.direction}.`;
    item.append(title, detail);
    list.append(item);
  });
}

function renderTrend(history = currentHistory) {
  currentHistory = Array.isArray(history) ? history : [];
  const svg = $('#trend-chart');
  const summary = $('#trend-summary');
  svg.replaceChildren();
  const metric = TREND_METRICS[$('#trend-metric').value] ?? TREND_METRICS.revenue;
  const points = currentHistory
    .map(item => ({ date: item.analyzedAt, value: metric.value(item) }))
    .filter(item => Number.isFinite(item.value));
  if (points.length < 2) {
    summary.textContent = points.length === 1
      ? 'یک تحلیل ثبت شده است؛ برای نمایش روند، یک تحلیل دیگر لازم است.'
      : 'پس از ثبت دست‌کم دو تحلیل موفق، روند واقعی این شاخص نمایش داده می‌شود.';
    svg.setAttribute('aria-label', summary.textContent);
    return;
  }

  const width = 800, height = 260, left = 72, right = 24, top = 18, bottom = 42;
  const values = points.map(point => point.value);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { const pad = Math.abs(min) * 0.08 || 1; min -= pad; max += pad; }
  else { const pad = (max - min) * 0.12; min -= pad; max += pad; }
  const x = index => left + index * (width - left - right) / (points.length - 1);
  const y = value => top + (max - value) * (height - top - bottom) / (max - min);
  const node = (tag, attrs = {}, text = null) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    if (text !== null) element.textContent = text;
    svg.append(element);
    return element;
  };
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `روند ${metric.label} بر اساس ${points.length} تحلیل ثبت‌شده`);
  for (let i = 0; i < 4; i += 1) {
    const value = max - i * (max - min) / 3;
    const gy = y(value);
    node('line', { x1: left, y1: gy, x2: width - right, y2: gy, class: 'trend-grid' });
    node('text', { x: left - 10, y: gy + 4, 'text-anchor': 'end', class: 'trend-axis-label' }, faNumber.format(value));
  }
  node('polyline', {
    points: points.map((point, index) => `${x(index)},${y(point.value)}`).join(' '),
    fill: 'none', stroke: metric.color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  });
  points.forEach((point, index) => {
    node('circle', { cx: x(index), cy: y(point.value), r: 4.5, fill: metric.color, stroke: '#fff', 'stroke-width': 2 });
    const date = point.date ? new Date(point.date) : null;
    const label = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(date) : '—';
    if (index === 0 || index === points.length - 1 || points.length <= 6) {
      node('text', { x: x(index), y: height - 14, 'text-anchor': 'middle', class: 'trend-axis-label' }, label);
    }
  });
  const first = points[0].value, last = points[points.length - 1].value;
  const delta = last - first;
  const direction = delta > 0 ? 'افزایش' : delta < 0 ? 'کاهش' : 'بدون تغییر';
  summary.textContent = `روند ${metric.label}: ${direction} ${faNumber.format(Math.abs(delta))} از اولین تا آخرین تحلیل؛ بر پایه ${points.length} تحلیل ثبت‌شده.`;
}

function renderUnavailable(title, text, clearExecutive = true) {
  $('#kpis').setAttribute('aria-busy', 'false');
  setKpi('#revenue', null);
  setKpi('#profit', null);
  setKpi('#risk', null);
  $('#dashboard-empty-title').textContent = title;
  $('#dashboard-empty-text').textContent = text;
  $('#dashboard-empty').hidden = false;
  $('#dashboard-meta').textContent = '—';
  if (clearExecutive) {
    renderExecutiveTargets(null);
    renderExecutiveEvaluation(null, false);
  }
  renderObservations(null);
  renderSource(null);
  renderTrend([]);
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
  renderExecutiveTargets(dashboard.targets ?? null);
  renderExecutiveEvaluation(dashboard.executiveEvaluation ?? null, dashboard.targetsConfigured === true);
  if (!dashboard.analysisAvailable) {
    renderUnavailable('هنوز تحلیلی انجام نشده است', 'نشست فعال است اما هیچ تحلیلی برای آن ثبت نشده. یک فایل CSV را در بخش «تحلیل صورت مالی» بارگذاری کنید.', false);
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
  renderTrend(dashboard.history ?? []);
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

$('#targets-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = $('#targets-result');
  const raw = {
    revenue: $('#target-revenue').value.trim(),
    profit: $('#target-profit').value.trim(),
    profitMargin: $('#target-profit-margin').value.trim(),
    debtRatio: $('#target-debt-ratio').value.trim()
  };
  const values = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Number(value)]));
  if (Object.values(raw).some(value => value === '') ||
      Object.values(values).some(value => !Number.isFinite(value) || value <= 0)) {
    setResult(result, 'error', ERROR_MESSAGES.EXECUTIVE_TARGETS_INVALID);
    return;
  }
  setBusy(form, true, 'در حال ثبت هدف‌ها…');
  setResult(result, 'info', 'هدف‌های واردشده در حال ذخیره‌سازی هستند…');
  try {
    await request('/api/executive-targets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        targets: {
          revenue: values.revenue,
          profit: values.profit,
          profitMargin: values.profitMargin / 100,
          debtRatio: values.debtRatio / 100
        }
      })
    });
    setResult(result, 'success', 'هدف‌های سازمان ذخیره شد و ارزیابی مدیریتی به‌روزرسانی می‌شود.');
    await refreshDashboard();
  } catch (error) {
    setResult(result, 'error', `ثبت هدف‌ها ناموفق بود: ${describeError(error)}`);
  } finally {
    setBusy(form, false);
  }
});

$('#trend-metric').addEventListener('change', () => renderTrend(currentHistory));
$('#retry-button').addEventListener('click', () => refreshDashboard());

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
refreshDashboard();
