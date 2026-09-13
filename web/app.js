async function getJson(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP_${response.status}`);
  return payload;
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
  } catch (error) {
    document.querySelector('#readiness').textContent = `برای ادامه ابتدا نشست ایجاد کنید: ${error.message}`;
  }
}

document.querySelector('#session-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#session-result');
  try {
    const payload = await getJson('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: document.querySelector('#username').value,
        organization: document.querySelector('#organization').value
      })
    });
    result.textContent = `نشست ${payload.organization.name} ایجاد شد. شناسه tenant: ${payload.tenantId}`;
    await refreshDashboard();
  } catch (error) {
    result.textContent = `ایجاد نشست ناموفق بود: ${error.message}`;
  }
});

function fileExtension(name) {
  const parts = String(name || '').toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

document.querySelector('#analysis-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#analysis-result');
  const file = document.querySelector('#csv-file').files[0];
  if (!file) return;
  try {
    const extension = fileExtension(file.name);
    const format = extension === 'json' ? 'STRUCTURED' : extension === 'xlsx' ? 'XLSX' : extension === 'txt' ? 'TXT' : 'CSV';
    const ingestBody = { sourceName: file.name, format };
    if (format === 'XLSX') ingestBody.contentBase64 = await fileToBase64(file);
    else ingestBody.content = await file.text();
    const ingested = await getJson('/api/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(ingestBody)
    });
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
    result.textContent = `تحلیل ناموفق بود: ${error.message}`;
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: document.querySelector('#execution-title').value,
        priority: document.querySelector('#execution-priority').value
      })
    });
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
refreshDashboard();
