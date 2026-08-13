const state = { session: null, dashboard: null };

const $ = id => document.getElementById(id);
const number = value => new Intl.NumberFormat("fa-IR").format(value ?? 0);

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
  const metrics = data.metrics || {};
  $("kpi-revenue").textContent = number(metrics.revenue);
  $("kpi-profit").textContent = number(metrics.profit);
  $("kpi-cash").textContent = number(metrics.cash);
  $("kpi-risk").textContent = `${number(metrics.risk)}٪`;
  const ready = data.status === "READY";
  $("dashboard-status").textContent = ready ? "داشبورد آماده است" : "داده کافی نیست";
  $("confidence").textContent = ready ? "۸۵٪" : "۰٪";
  if (ready) {
    $("priority-title").textContent = Number(metrics.risk ?? 0) >= 40 ? "ریسک نیازمند توجه است" : "تمرکز فعلی: رشد سودآور";
    $("priority-text").textContent = `درآمد ${number(metrics.revenue)}، سود ${number(metrics.profit)} و نقدینگی ${number(metrics.cash)} ثبت شده است. تصمیم بعدی باید با شواهد پشتیبانی شود.`;
  }
}

function renderReport(report) {
  const sections = Array.isArray(report?.sections) ? report.sections : [];
  $("report").innerHTML = `<h3>${report?.title || "گزارش اجرایی"}</h3>${sections.map(section => `<div class="report-row">${section}</div>`).join("") || `<p class="muted">شاهد قابل نمایش وجود ندارد.</p>`}`;
}

function setIdentity(organization, session) {
  $("side-org").textContent = organization || "سازمان نامشخص";
  $("session").textContent = session ? `فعال · ${session.user.username}` : "بدون نشست فعال";
  $("identity-status").textContent = session ? "نشست فعال" : "بدون نشست";
}

async function loadDemo() {
  const data = await api("/api/demo");
  $("organization").value = data.organization.name;
  setIdentity(data.organization.name, null);
  renderDashboard(data.dashboard);
  renderReport(data.report);
  $("data-summary").textContent = `داده نمونه: ${data.records.length} رکورد مالی ذخیره و قابل تحلیل شد`;
  setMessage("داده نمونه بارگذاری شد؛ اکنون تصویر مدیریتی آماده بررسی است.", "ok");
}

async function login() {
  const username = $("username").value.trim();
  const organization = $("organization").value.trim();
  if (!username || !organization) return setMessage("نام کاربر و سازمان را وارد کنید.", "error");
  const session = await api("/api/session", { method: "POST", body: JSON.stringify({ username, organization }) });
  state.session = session;
  setIdentity(session.organization.name, session);
  setMessage("نشست امن و context سازمانی فعال شد.", "ok");
  await refresh();
}

async function logout() {
  if (!state.session?.token) return;
  await api("/api/logout", { method: "POST" });
  state.session = null;
  setIdentity($("organization").value.trim(), null);
  setMessage("نشست پایان یافت.", "ok");
}

async function ingest() {
  if (!state.session?.token) return setMessage("برای ثبت داده ابتدا وارد نشست سازمانی شوید.", "error");
  const amount = Number($("amount").value);
  const category = $("category").value.trim();
  const organization = $("organization").value.trim();
  if (!Number.isFinite(amount) || amount <= 0 || !category || !organization) return setMessage("مبلغ، دسته‌بندی و سازمان باید معتبر باشند.", "error");
  const result = await api("/api/ingest", { method: "POST", body: JSON.stringify({ amount, category, organization }) });
  renderDashboard(result.dashboard);
  $("data-summary").textContent = `رکورد ثبت شد · نسخه ${result.persistence.version}`;
  setMessage("شاهد مالی ثبت شد و شاخص‌های مدیریت به‌روزرسانی شدند.", "ok");
}

async function makeDecision() {
  if (!state.session?.token) return setMessage("برای ثبت تصمیم ابتدا وارد نشست سازمانی شوید.", "error");
  const title = $("decision").value.trim();
  const organization = $("organization").value.trim();
  if (!title) return setMessage("عنوان تصمیم را وارد کنید.", "error");
  const result = await api("/api/decision", { method: "POST", body: JSON.stringify({ title, organization }) });
  $("decision-result").textContent = result.recommendation;
  setMessage("تصمیم ثبت شد و برای تأیید مدیریت در مسیر اجرا قرار گرفت.", "ok");
}

async function refresh() {
  const organization = state.session?.organization?.name || $("organization").value.trim();
  const path = organization ? `/api/dashboard?organization=${encodeURIComponent(organization)}` : "/api/dashboard";
  const dashboard = await api(path);
  renderDashboard(dashboard);
  renderReport(await api("/api/report"));
}

function wireNavigation() {
  document.querySelectorAll("[data-section]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      const sectionMap = { overview: ".workspace", financial: "#financial-section", reports: "#reports-section", decisions: "#decisions-section", alerts: "#alerts-section", organization: "#organization-section" };
      document.querySelector(sectionMap[button.dataset.section] || ".workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-section-target]").forEach(button => button.addEventListener("click", () => $("reports-section")?.scrollIntoView({ behavior: "smooth" })));
  document.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => {
    $("assistant-note").textContent = `درخواست انتخاب‌شده: ${chip.dataset.prompt} · این سطح در نسخه فعلی به‌صورت پیشنهاد تعاملی آماده است.`;
    setMessage("درخواست دستیار انتخاب شد.", "ok");
  }));
}

$("login").addEventListener("click", () => login().catch(error => setMessage(error.message, "error")));
$("logout").addEventListener("click", () => logout().catch(error => setMessage(error.message, "error")));
$("demo").addEventListener("click", () => loadDemo().catch(error => setMessage(error.message, "error")));
$("ingest").addEventListener("click", () => ingest().catch(error => setMessage(error.message, "error")));
$("decision-submit").addEventListener("click", () => makeDecision().catch(error => setMessage(error.message, "error")));
$("refresh").addEventListener("click", () => refresh().catch(error => setMessage(error.message, "error")));
wireNavigation();

api("/api/ready").then(() => {
  $("connection").textContent = "سامانه آنلاین";
  $("connection").classList.add("online");
  setMessage("سامانه آماده استفاده است.", "ok");
}).catch(() => {
  $("connection").textContent = "سرور در دسترس نیست";
  setMessage("runtime هنوز در دسترس نیست.", "error");
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
