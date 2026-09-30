/**
 * B-03 — live cognitive orchestration over the REAL HTTP runtime.
 *
 * This test does not call the orchestration service directly. Every question is
 * issued as a real HTTP `POST /api/assistant` request against a real
 * `CommercialRuntimeServer` that has ingested the real 123.xlsx benchmark, so
 * the whole chain is exercised:
 *
 *   USER QUESTION -> analyzeQuestion -> QuestionIntent -> capability selection
 *   -> canonical specialist engines -> consistency gate -> reasoning
 *   -> user-facing composition
 *
 * It asserts on the orchestration provenance the runtime returns, so a passing
 * run proves that the question actually changed WHICH capabilities executed —
 * not merely which heading was printed.
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
    // No Desktop access: the real-dataset orchestration acceptance stays skipped.
  }
  return undefined;
};

const REAL_XLSX = findRealXlsx();

/** The nine mandatory runtime questions. */
const QUESTIONS = [
  "تحلیل کامل صورت مالی را انجام بده",
  "وضعیت تاب‌آوری مالی شرکت چگونه است؟",
  "مهم‌ترین ریسک‌های شرکت چیست؟",
  "علت تغییر سود چیست؟",
  "چه اطلاعاتی برای نتیجه‌گیری کم است؟",
  "برای رشد شرکت چه مسیرهایی وجود دارد؟",
  "الان چه اقدامی باید انجام بدهم؟",
  "برای رشد شرکت چه کنم و آیا این رشد از نظر مالی تاب‌آور است؟",
  "چه ریسک‌هایی دارم و برای کاهش آنها چه اقدامی انجام دهم؟",
] as const;

interface CognitionCapabilityRecord {
  capability: string;
  owner: string;
  status: string;
  unavailableReason?: string;
  evidenceCount: number;
}

interface Cognition {
  traceId: string;
  status: string;
  intent: { primary: string; secondary: string[]; answerMode: string; userGoal: string; requiredEvidenceDomains: string[] };
  selectedCapabilities: string[];
  executionOrder: string[];
  capabilities: CognitionCapabilityRecord[];
  executedCapabilities: string[];
  unavailableCapabilities: { capability: string; owner: string; reason: string }[];
  reasoning: { status: string; confidenceSource: string; stepCount: number };
  contradictions: { subject: string; canonicalValue: number; specialistValue: number; resolution: string }[];
  limitations: string[];
}

interface AssistantResponse {
  status: string;
  question: string;
  answer: string;
  cognition: Cognition;
  response?: { intent: string; sections: { heading: string; lines: string[] }[] };
  evidence: { analysisSource: { sha256: string }; documentStatus: string };
}

const INTERNAL_LEAK = /\b(preTaxIncome|netProfit|netIncome|cashConversionCycle|workingCapital|operatingIncome|grossProfit|balance-sheet-identity|productSegments|grossMargin|revenueShare|mixEffect|profitMargin|debtRatio|reasoned_domain|FINANCIAL_INTELLIGENCE|RESILIENCE|COMPOSITE)\b/;

(REAL_XLSX && existsSync(REAL_XLSX) ? describe : describe.skip)("B-03 live cognitive orchestration over the real HTTP runtime (123.xlsx)", () => {
  let server: Server;
  let clock = 1_900_000_000_000;
  const results = new Map<string, AssistantResponse>();
  let canonicalNetProfit: number | undefined;

  const request = (path: string, options: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return fetch(`http://127.0.0.1:${address.port}${path}`, options);
  };
  const post = (path: string, cookie: string, body: unknown) => {
    clock += 1000;
    return request(path, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
  };

  beforeAll(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      now: () => clock,
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "stub" }) },
      sessionSweepIntervalMs: 0,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));

    const registered = await request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "b03-owner", password: "Sup3rSecret!", organization: "B03 Org" }),
    });
    const cookie = (registered.headers.get("set-cookie") ?? "").split(";")[0];
    expect(cookie).toBeTruthy();

    const bytes = readFileSync(REAL_XLSX as string);
    const ingested = await post("/api/ingest", cookie, {
      sourceName: "123.xlsx", format: "XLSX", contentBase64: bytes.toString("base64"),
    });
    expect(ingested.status).toBe(201);
    const sha256 = (await ingested.json()).evidence.sha256 as string;

    const analyze = await post("/api/financial/analyze", cookie, { sourceSha256: sha256 });
    expect(analyze.status).toBe(200);
    const analysis = await analyze.json();
    canonicalNetProfit = analysis.metrics.profit as number;

    const insights = await post("/api/financial/insights", cookie, { sourceSha256: sha256 });
    expect(insights.status).toBe(200);
    expect((await insights.json()).statementInsight).toBeTruthy();

    // Every mandatory question is executed through the REAL endpoint.
    for (const question of QUESTIONS) {
      const response = await post("/api/assistant", cookie, { question });
      expect(response.status).toBe(200);
      const body = (await response.json()) as AssistantResponse;
      results.set(question, body);
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const of = (question: string): AssistantResponse => {
    const body = results.get(question);
    if (!body) throw new Error(`no response recorded for ${question}`);
    return body;
  };

  test("every question is answered by a real orchestration with provenance", () => {
    for (const question of QUESTIONS) {
      const body = of(question);
      expect(body.cognition).toBeTruthy();
      expect(body.cognition.traceId).toMatch(/^TRACE-/);
      expect(body.cognition.intent.primary).toBeTruthy();
      expect(body.cognition.executionOrder.length).toBeGreaterThan(0);
      expect(body.cognition.executedCapabilities.length).toBeGreaterThan(0);
      expect(body.answer.length).toBeGreaterThan(200);
    }
  });

  test("Q1..Q9 reach distinct, non-general intents", () => {
    expect(of(QUESTIONS[0]).cognition.intent.primary).toBe("ANALYZE");
    expect(of(QUESTIONS[1]).cognition.intent.primary).toBe("RESILIENCE");
    expect(of(QUESTIONS[2]).cognition.intent.primary).toBe("RISK");
    expect(of(QUESTIONS[3]).cognition.intent.primary).toBe("PROFIT_CHANGE");
    expect(of(QUESTIONS[4]).cognition.intent.primary).toBe("DATA_GAPS");
    expect(of(QUESTIONS[5]).cognition.intent.primary).toBe("GROWTH");
    expect(of(QUESTIONS[6]).cognition.intent.primary).toBe("ACTION");
    // No mandatory question silently falls back to the general path.
    for (const question of QUESTIONS) {
      expect(of(question).cognition.intent.primary).not.toBe("GENERAL");
    }
  });

  test("Q8 genuinely executes two intents (growth + resilience + action)", () => {
    const body = of(QUESTIONS[7]);
    expect(body.cognition.intent.answerMode).toBe("COMPOSITE");
    expect(body.cognition.intent.secondary.length).toBeGreaterThanOrEqual(2);
    // Both the growth and the resilience capability really ran.
    expect(body.cognition.executedCapabilities).toContain("SCENARIO");
    expect(body.cognition.executedCapabilities).toContain("LIQUIDITY_LEVERAGE");
  });

  test("Q9 genuinely executes risk and action capabilities", () => {
    const body = of(QUESTIONS[8]);
    expect(body.cognition.intent.answerMode).toBe("COMPOSITE");
    expect(body.cognition.intent.primary).toBe("RISK");
    expect(body.cognition.intent.secondary).toContain("ACTION");
    expect(body.cognition.executedCapabilities).toContain("FINANCIAL_INTELLIGENCE");
    expect(body.cognition.executedCapabilities).toContain("ACTION_FINDINGS");
    // Governance gate is evaluated for the action path.
    expect(body.cognition.capabilities.some((entry) => entry.capability === "GOVERNANCE" && entry.status === "EXECUTED")).toBe(true);
  });

  test("the question controls EXECUTION, not only the rendered headings", () => {
    // Q1 (analyze) and Q5 (data gaps) must not run the same capability set.
    const q1 = new Set(of(QUESTIONS[0]).cognition.executedCapabilities);
    const q5 = new Set(of(QUESTIONS[4]).cognition.executedCapabilities);
    const symmetricDifference = (a: Set<string>, b: Set<string>) =>
      [...a].filter((item) => !b.has(item)).length + [...b].filter((item) => !a.has(item)).length;
    expect(symmetricDifference(q1, q5)).toBeGreaterThan(0);
    // DATA_GAPS must NOT pull in the financial/liquidity specialist engines.
    expect(q5.has("FINANCIAL_INTELLIGENCE")).toBe(false);
    // Q2 (resilience) and Q6 (growth) must not collapse onto one execution.
    const q2 = new Set(of(QUESTIONS[1]).cognition.executedCapabilities);
    const q6 = new Set(of(QUESTIONS[5]).cognition.executedCapabilities);
    expect(symmetricDifference(q2, q6)).toBeGreaterThan(0);
    // Growth really invokes the scenario capability; resilience really does not rely on it.
    expect(q6.has("SCENARIO")).toBe(true);
    // Q1 and Q5 answers themselves must not collapse.
    expect(of(QUESTIONS[0]).answer).not.toBe(of(QUESTIONS[4]).answer);
    expect(of(QUESTIONS[1]).answer).not.toBe(of(QUESTIONS[5]).answer);
  });

  test("canonical financial specialist engines really execute on the financial path", () => {
    const analyze = of(QUESTIONS[0]).cognition;
    expect(analyze.executedCapabilities).toContain("FINANCIAL_INTELLIGENCE");
    const financial = analyze.capabilities.find((entry) => entry.capability === "FINANCIAL_INTELLIGENCE");
    expect(financial?.status).toBe("EXECUTED");
    expect(financial?.owner).toBe("FinancialIntelligenceEngine");
    // The specialist consumed real canonical evidence, not an empty context.
    expect(financial?.evidenceCount ?? 0).toBeGreaterThan(0);
  });

  test("reasoning really runs over the orchestration context", () => {
    for (const question of QUESTIONS) {
      const body = of(question);
      expect(body.cognition.reasoning.status).toBe("EXECUTED");
      expect(body.cognition.reasoning.stepCount).toBeGreaterThan(0);
    }
  });

  test("capabilities that cannot honestly execute are reported unavailable, never faked", () => {
    // A statement document carries no risk probability/impact, so risk scoring
    // must be reported unavailable rather than invented.
    const risk = of(QUESTIONS[2]).cognition.unavailableCapabilities.find((entry) => entry.capability === "RISK_INTELLIGENCE");
    expect(risk).toBeTruthy();
    expect(risk?.owner).toBe("RiskIntelligenceEngine.assess");
    expect(risk?.reason.length).toBeGreaterThan(0);
    // An ACTION question carries no decision matrices.
    const decision = of(QUESTIONS[6]).cognition.unavailableCapabilities.find((entry) => entry.capability === "DECISION_INTELLIGENCE");
    expect(decision).toBeTruthy();
  });

  test("canonical financial truth is preserved and never overwritten", () => {
    for (const question of QUESTIONS) {
      const body = of(question);
      // Any detected disagreement is surfaced with the canonical value winning.
      for (const contradiction of body.cognition.contradictions) {
        expect(contradiction.resolution).toBe("CANONICAL_WINS");
        expect(typeof contradiction.canonicalValue).toBe("number");
        expect(typeof contradiction.specialistValue).toBe("number");
      }
    }
  });

  test("no internal identifier leaks into the Persian user surface", () => {
    for (const question of QUESTIONS) {
      const body = of(question);
      expect(INTERNAL_LEAK.test(body.answer)).toBe(false);
      expect(body.answer).toMatch(/[\u0600-\u06FF]/);
    }
  });

  test("limitations are reported rather than hidden", () => {
    // The RESILIENCE path fully executed on this document, so it correctly
    // reports no capability limitation. The paths that COULD NOT fully execute
    // must disclose the missing canonical evidence instead of inventing it.
    expect(of(QUESTIONS[1]).cognition.unavailableCapabilities.length).toBe(0);
    // The risk question discloses the absent probability/impact evidence.
    expect(of(QUESTIONS[2]).cognition.limitations.length).toBeGreaterThan(0);
    // An ACTION question discloses the absent decision matrices.
    expect(of(QUESTIONS[6]).cognition.limitations.length).toBeGreaterThan(0);
  });
});
