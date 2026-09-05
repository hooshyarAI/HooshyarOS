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

document.querySelector('#analysis-form').addEventListener('submit', async event => {
  event.preventDefault();
  const result = document.querySelector('#analysis-result');
  const file = document.querySelector('#csv-file').files[0];
  if (!file) return;
  try {
    const payload = await getJson('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sourceName: file.name,
        csv: await file.text(),
        assets: Number(document.querySelector('#assets').value),
        liabilities: Number(document.querySelector('#liabilities').value)
      })
    });
    result.textContent = `تحلیل موفق: سود ${Number(payload.metrics.profit).toLocaleString('fa-IR')}، نسبت بدهی ${Number(payload.metrics.debtRatio * 100).toLocaleString('fa-IR')}٪. وضعیت: ${payload.status}`;
    await refreshDashboard();
  } catch (error) {
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

document.querySelector('#report-button').addEventListener('click', async () => {
  const result = document.querySelector('#report-result');
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
refreshDashboard();
