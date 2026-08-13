const state = { session: null, dashboard: null };

const $ = (id) => document.getElementById(id);

function setMessage(message, kind = "info") {
  const node = $("message");
  node.textContent = message;
  node.dataset.kind = kind;
}

async function api(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (state.session?.token && !headers.authorization) headers.authorization = `Bearer ${state.session.token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function renderDashboard(data) {
  state.dashboard = data;
  $("kpi-revenue").textContent = new Intl.NumberFormat("fa-IR").format(data.metrics.revenue ?? 0);
  $("kpi-profit").textContent = new Intl.NumberFormat("fa-IR").format(data.metrics.profit ?? 0);
  $("kpi-cash").textContent = new Intl.NumberFormat("fa-IR").format(data.metrics.cash ?? 0);
  $("kpi-risk").textContent = `${data.metrics.risk ?? 0}%`;
  $("dashboard-status").textContent = data.status === "READY" ? "داشبورد آماده است" : "داده کافی نیست";
}

function renderReport(report) {
  $("report").innerHTML = `<h3>${report.title}</h3>${report.sections.map(section => `<div class="report-row">${section}</div>`).join("")}`;
}

async function loadDemo() {
  const data = await api("/api/demo");
  renderDashboard(data.dashboard);
  renderReport(data.report);
  $("organization").value = data.organization.name;
  $("data-summary").textContent = `داده نمونه: ${data.records.length} رکورد مالی`;
  setMessage("داده نمونه هوشیار.ai بارگذاری شد", "ok");
}

async function login() {
  const username = $("username").value.trim();
  const organization = $("organization").value.trim();
  if (!username || !organization) return setMessage("نام کاربر و سازمان را وارد کنید", "error");
  const session = await api("/api/session", { method: "POST", body: JSON.stringify({ username, organization }) });
  state.session = session;
  $("session").textContent = `فعال: ${session.user.username} / ${session.organization.name}`;
  setMessage("ورود و ایجاد context سازمان با موفقیت انجام شد", "ok");
  await refresh();
}

async function logout() {
  if (!state.session?.token) return;
  await api("/api/logout", { method: "POST" });
  state.session = null;
  $("session").textContent = "نشست منقضی شد";
  setMessage("نشست با موفقیت پایان یافت", "ok");
}

async function ingest() {
  if (!state.session?.token) return setMessage("ابتدا وارد نشست سازمانی شوید", "error");
  const amount = Number($("amount").value);
  const category = $("category").value.trim();
  if (!Number.isFinite(amount) || amount <= 0 || !category) return setMessage("مبلغ و دسته‌بندی معتبر وارد کنید", "error");
  const result = await api("/api/ingest", { method: "POST", body: JSON.stringify({ amount, category, organization: $("organization").value.trim() }) });
  renderDashboard(result.dashboard);
  $("data-summary").textContent = `رکورد جدید ثبت شد؛ نسخه ${result.persistence.version}`;
  setMessage("رکورد مالی ثبت و در داشبورد اعمال شد", "ok");
}

async function makeDecision() {
  if (!state.session?.token) return setMessage("ابتدا وارد نشست سازمانی شوید", "error");
  const title = $("decision").value.trim();
  if (!title) return setMessage("عنوان تصمیم را وارد کنید", "error");
  const result = await api("/api/decision", { method: "POST", body: JSON.stringify({ title, organization: $("organization").value.trim() }) });
  $("decision-result").textContent = result.recommendation;
  setMessage("تصمیم در مرکز تصمیم ثبت و قابل پیگیری شد", "ok");
}

async function refresh() {
  const path = state.session?.organization?.name ? `/api/dashboard?organization=${encodeURIComponent(state.session.organization.name)}` : "/api/dashboard";
  const dashboard = await api(path);
  renderDashboard(dashboard);
  const report = await api("/api/report");
  renderReport(report);
}

$("login").addEventListener("click", () => login().catch(error => setMessage(error.message, "error")));
$("demo").addEventListener("click", () => loadDemo().catch(error => setMessage(error.message, "error")));
$("ingest").addEventListener("click", () => ingest().catch(error => setMessage(error.message, "error")));
$("decision-submit").addEventListener("click", () => makeDecision().catch(error => setMessage(error.message, "error")));
$("refresh").addEventListener("click", () => refresh().catch(error => setMessage(error.message, "error")));
if ($("logout")) $("logout").addEventListener("click", () => logout().catch(error => setMessage(error.message, "error")));

api("/api/ready").then(() => setMessage("سامانه آماده استفاده است", "ok")).catch(() => setMessage("سرور هنوز در دسترس نیست", "error"));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
