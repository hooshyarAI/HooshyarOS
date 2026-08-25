async function getJson(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `HTTP_${response.status}`);
  return payload;
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
    result.textContent = `نشست ${payload.organization.name} با موفقیت ایجاد شد.`;
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
refreshDashboard();
