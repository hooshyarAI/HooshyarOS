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
    const dashboard = await getJson('/api/dashboard?organization=' + encodeURIComponent(document.querySelector('#organization').value || 'شرکت نمونه هوشیار'));
    document.querySelector('#revenue').textContent = Number(dashboard.metrics?.revenue ?? 0).toLocaleString('fa-IR');
    document.querySelector('#profit').textContent = Number(dashboard.metrics?.profit ?? 0).toLocaleString('fa-IR');
    document.querySelector('#risk').textContent = `${Number(dashboard.metrics?.risk ?? 0).toLocaleString('fa-IR')}٪`;
  } catch (error) {
    document.querySelector('#readiness').textContent = `خطا در اتصال: ${error.message}`;
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

document.querySelector('#organization').addEventListener('change', refreshDashboard);
refreshDashboard();
