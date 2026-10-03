/**
 * Real product-lifecycle acceptance over the real HTTP runtime and the real
 * 123.xlsx benchmark.
 *
 * This is the end-to-end contract the plan requires: one real source is
 * ingested once, then the SAME canonical intelligence is read back by the
 * analysis endpoint, the insights endpoint, the assistant and the report, and
 * a governed decision is carried through execution to recorded feedback. It
 * runs only when the real benchmark is present on the machine; otherwise it
 * skips without weakening any other assertion.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const findRealXlsx = (): string | undefined => {
  if (process.env.HOOSHYAR_REAL_XLSX) return process.env.HOOSHYAR_REAL_XLSX;
  const desktop = "C:\\Users\\avalipour\\Desktop";
  try {
    for (const entry of readdirSync(desktop, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = `${desktop}\\${entry.name}\\123.xlsx`;
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // No Desktop access: the real-file acceptance stays skipped.
  }
  return undefined;
};

const REAL_XLSX = findRealXlsx();

const QUESTIONS = [
  "وضعیت مالی این شرکت را به‌صورت عمیق و مقایسه‌ای تحلیل کن.",
  "چرا سود خالص تغییر کرده است و عوامل اصلی آن چیست؟",
  "مهم‌ترین ریسک‌های مالی و عملیاتی قابل مشاهده چیست؟",
  "سه سناریوی تصمیم‌گیری بر اساس عوامل واقعی شرکت ارائه کن.",
  "کدام محصولات یا بخش‌ها سودآوری بالاتری دارند و ترکیب فروش چه اثری دارد؟",
  "برای بهبود عملکرد، چه تصمیم‌هایی پیشنهاد می‌شود و هر تصمیم چگونه به اقدام، KPI و پایش تبدیل می‌شود؟",
  "برای هر تصمیم چه داده‌ای هنوز کم است؟",
];

const INTERNAL_LEAK = /\b(preTaxIncome|netProfit|netIncome|cashConversionCycle|workingCapital|operatingIncome|grossProfit|taxes|balance-sheet-identity|productSegments|grossMargin|revenueShare|mixEffect|TAX|PRE_TAX_INCOME)\b/;

const DECISION_BODY = {
  problem: "choose the working-capital improvement path",
  alternatives: ["Accelerate receivables collection", "Renegotiate supplier terms"],
  criteria: [
    { name: "cashRelease", weight: 0.6, direction: "benefit" },
    { name: "executionRisk", weight: 0.4, direction: "cost" },
  ],
  scores: [
    [9, 4],
    [6, 3],
  ],
};

(REAL_XLSX && existsSync(REAL_XLSX) ? describe : describe.skip)("real 123.xlsx end-to-end product lifecycle (HTTP)", () => {
  let server: Server;
  let clock = 1_900_000_000_000;

  const request = (path: string, options: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return fetch(`http://127.0.0.1:${address.port}${path}`, options);
  };
  const tick = () => { clock += 1000; };
  const post = (path: string, cookie: string, body: unknown) => {
    tick();
    return request(path, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
  };

  beforeAll(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      now: () => clock,
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "stub" }) },
      sessionSweepIntervalMs: 0,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("one real source flows through analysis, insights, assistant, report, decision, execution and feedback", async () => {
    const registered = await request("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "lifecycle-owner", password: "Sup3rSecret!", organization: "Lifecycle Org" }) });
    const cookie = (registered.headers.get("set-cookie") ?? "").split(";")[0];
    expect(cookie).toBeTruthy();

    const bytes = readFileSync(REAL_XLSX as string);
    const ingested = await post("/api/ingest", cookie, { sourceName: "123.xlsx", format: "XLSX", contentBase64: bytes.toString("base64") });
    expect(ingested.status).toBe(201);
    const sha256 = (await ingested.json()).evidence.sha256 as string;
    console.log(`LIFECYCLE_INGEST sha256=${sha256}`);

    const analyze = await post("/api/financial/analyze", cookie, { sourceSha256: sha256 });
    expect(analyze.status).toBe(200);
    const analysis = await analyze.json();
    expect(analysis.metrics.revenue).toBe(32_129_418_000_000);
    expect(analysis.metrics.profit).toBe(7_250_000_000_000);
    console.log(`LIFECYCLE_ANALYZE revenue=${analysis.metrics.revenue} profit=${analysis.metrics.profit}`);

    const insightsRes = await post("/api/financial/insights", cookie, { sourceSha256: sha256 });
    expect(insightsRes.status).toBe(200);
    const insights = await insightsRes.json();
    const statement = insights.statementInsight;
    expect(statement).toBeTruthy();
    expect(statement.metrics.revenue).toBe(32_129_418_000_000);
    expect(statement.metrics.preTaxIncome).toBe(8_762_226_000_000);
    expect(statement.metrics.taxes).toBe(1_512_226_000_000);
    const netProfitIdentity = statement.integrity.find((check: { id: string }) => check.id === "net-profit-identity");
    expect(netProfitIdentity.status).toBe("RECONCILED");
    expect(statement.productSegments).toBeTruthy();
    expect(statement.productSegments.totalRevenue).toBe(32_129_418_000_000);
    expect(statement.productSegments.totalGrossProfit).toBe(5_036_175_000_000);
    expect(statement.productSegments.mixEffect).toBeTruthy();
    console.log(`LIFECYCLE_INSIGHTS preTax=${statement.metrics.preTaxIncome} taxes=${statement.metrics.taxes} netProfitIdentity=${netProfitIdentity.status} productSegments=${statement.productSegments.segmentCount} productRevenue=${statement.productSegments.totalRevenue}`);

    const answers: { question: string; intent: string; answer: string }[] = [];
    for (const question of QUESTIONS) {
      const res = await post("/api/assistant", cookie, { question });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(INTERNAL_LEAK.test(body.answer)).toBe(false);
      answers.push({ question, intent: body.response?.intent ?? "?", answer: body.answer });
    }
    const intents = answers.map((entry) => entry.intent);
    const distinctIntents = new Set(intents);
    expect(distinctIntents.size).toBeGreaterThanOrEqual(5);
    expect(intents[4]).toBe("PRODUCT");
    expect(answers[4].answer).toContain("سودآوری محصول/بخش");
    expect(answers[4].answer).toContain("شکر سفيد");
    expect(new Set(answers.map((entry) => entry.answer)).size).toBeGreaterThanOrEqual(6);
    console.log(`LIFECYCLE_ASSISTANT distinctIntents=${distinctIntents.size} intents=${intents.join(",")} distinctAnswers=${new Set(answers.map((entry) => entry.answer)).size}/7`);

    const reportRes = await request("/api/report", { headers: { cookie } });
    expect(reportRes.status).toBe(200);
    const report = await reportRes.json();
    const reportText: string = JSON.stringify(report);
    expect(reportText).toContain("سودآوری محصول/بخش");
    expect(reportText).toContain("سود قبل از مالیات");
    expect(reportText).toContain("شکر سفيد");
    console.log(`LIFECYCLE_REPORT status=${reportRes.status} hasProductSection=true hasPreTax=true`);

    const decision = await post("/api/decision/workbench", cookie, DECISION_BODY);
    expect(decision.status).toBe(200);

    const proposed = await post("/api/execution/work-items", cookie, {
      title: "کوتاه‌کردن چرخه تبدیل نقد",
      description: "اجرای توصیه کاننیکال بر پایه تحلیل ۱۲۳",
      decisionArtifactKey: "decision-workbench:latest",
    });
    expect(proposed.status).toBe(200);
    const workItem = await proposed.json();
    expect(workItem.status).toBe("AWAITING_APPROVAL");
    const workItemId = encodeURIComponent(workItem.workItemId as string);

    expect((await post(`/api/execution/work-items/${workItemId}/approve`, cookie, { comments: "تأیید" })).status).toBe(200);
    expect((await post(`/api/execution/work-items/${workItemId}/assign`, cookie, { assigneeId: "cfo", dueDate: "2026-10-31T00:00:00.000Z" })).status).toBe(200);
    expect((await post(`/api/execution/work-items/${workItemId}/start`, cookie, {})).status).toBe(200);
    const completedRes = await post(`/api/execution/work-items/${workItemId}/complete`, cookie, {
      kpi: { metric: "workingCapitalReleased", target: 1000, actual: 1150, unit: "IRR", series: [800, 950, 1150] },
      evidence: [{ id: "EV-CCC", type: "EXECUTION_MEMO", description: "تسریع وصول مطالبات", sha256: "c".repeat(64) }],
      feedback: {
        result: "DELIVERED",
        notes: "چرخه تبدیل نقد کاهش یافت",
        metrics: {
          before: { cycleTime: 36, throughput: 100, errorRate: 0.1, capacity: 100, cost: 500 },
          after: { cycleTime: 24, throughput: 118, errorRate: 0.05, capacity: 120, cost: 470 },
        },
      },
    });
    expect(completedRes.status).toBe(200);
    const completed = await completedRes.json();
    expect(completed.status).toBe("COMPLETED");
    expect(completed.kpi.status).toBe("ABOVE_TARGET");
    expect(completed.feedback.learning.provenance.verificationStatus).toBe("VERIFIED");
    console.log(`LIFECYCLE_EXECUTION workItem=${workItem.workItemId} status=${completed.status} kpi=${completed.kpi.status} learning=${completed.feedback.learning.provenance.verificationStatus}`);

    const attention = await request("/api/execution/attention", { headers: { cookie } });
    expect(attention.status).toBe(200);
    const attentionBody = await attention.json();
    expect(attentionBody.status).toBe("READY");
    console.log(`LIFECYCLE_MONITORING reminders=${attentionBody.counts.reminders} escalations=${attentionBody.counts.escalations}`);
  }, 120_000);
});
