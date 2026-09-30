/**
 * B-04 — tenant-safe cognitive memory over the REAL HTTP runtime.
 *
 * Every question is issued as a real `POST /api/assistant` request against a
 * real `CommercialRuntimeServer` that has ingested the real 123.xlsx benchmark.
 * The test proves that tenant-scoped memory is genuinely retrieved during
 * cognition, that it is reported with provenance, that tenant A's memory is
 * never visible to tenant B, that Q8/Q9 stay COMPOSITE, that canonical financial
 * values remain authoritative, and that unavailable capabilities stay honest.
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
    // No Desktop access: the real-dataset runtime acceptance stays skipped.
  }
  return undefined;
};

const REAL_XLSX = findRealXlsx();

const Q1 = "تحلیل کامل صورت مالی را انجام بده";
const Q2 = "وضعیت تاب‌آوری مالی شرکت چگونه است؟";
const Q8 = "برای رشد شرکت چه کنم و آیا این رشد از نظر مالی تاب‌آور است؟";
const Q9 = "چه ریسک‌هایی دارم و برای کاهش آنها چه اقدامی انجام دهم؟";

interface MemoryConflictRecord {
  subject: string;
  memoryValue: number;
  canonicalValue: number;
  resolution: string;
}

interface MemoryProvenance {
  retrievalOccurred: boolean;
  tenantId: string | null;
  retrievedCount: number;
  references: string[];
  traceId: string;
  authoritativeSource: string;
  conflicts: MemoryConflictRecord[];
}

interface Cognition {
  traceId: string;
  status: string;
  intent: { primary: string; secondary: string[]; answerMode: string };
  executedCapabilities: string[];
  capabilities: { capability: string; owner: string; status: string; unavailableReason?: string; evidenceCount: number }[];
  contradictions: { subject: string; canonicalValue: number; specialistValue: number; resolution: string }[];
  unavailableCapabilities: { capability: string; owner: string; reason: string }[];
  memory: MemoryProvenance;
}

interface AssistantResponse {
  status: string;
  tenantId: string;
  question: string;
  answer: string;
  cognition: Cognition;
  evidence: { analysisSource: { sha256: string } };
}

const INTERNAL_LEAK = /\b(preTaxIncome|netProfit|netIncome|cashConversionCycle|workingCapital|operatingIncome|grossProfit|balance-sheet-identity|productSegments|FINANCIAL_INTELLIGENCE|RESILIENCE|COMPOSITE|COGNITIVE_FINANCIAL_ASSERTION)\b/;

(REAL_XLSX && existsSync(REAL_XLSX) ? describe : describe.skip)("B-04 tenant-safe cognitive memory over the real HTTP runtime (123.xlsx)", () => {
  let server: Server;
  let clock = 1_950_000_000_000;

  const request = (path: string, options: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return fetch(`http://127.0.0.1:${address.port}${path}`, options);
  };
  const post = (path: string, cookie: string, body: unknown) => {
    clock += 1000;
    return request(path, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
  };
  const register = async (username: string, organization: string) => {
    const response = await request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
    });
    const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
    expect(cookie).toBeTruthy();
    return cookie;
  };
  const ingestAndAnalyze = async (cookie: string) => {
    const bytes = readFileSync(REAL_XLSX as string);
    const ingested = await post("/api/ingest", cookie, {
      sourceName: "123.xlsx", format: "XLSX", contentBase64: bytes.toString("base64"),
    });
    expect(ingested.status).toBe(201);
    const sha256 = (await ingested.json()).evidence.sha256 as string;
    const analyze = await post("/api/financial/analyze", cookie, { sourceSha256: sha256 });
    expect(analyze.status).toBe(200);
    const insights = await post("/api/financial/insights", cookie, { sourceSha256: sha256 });
    expect(insights.status).toBe(200);
    expect((await insights.json()).statementInsight).toBeTruthy();
    return sha256;
  };

  const tenantA = new Map<string, AssistantResponse>();
  let tenantBSecondQuestion: AssistantResponse;
  let tenantBMemoryTenantId: string | null = null;
  let tenantBFirstRetrieved = -1;

  beforeAll(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      now: () => clock,
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "stub" }) },
      sessionSweepIntervalMs: 0,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));

    const cookieA = await register("b04-owner-a", "B04 Org A");
    await ingestAndAnalyze(cookieA);

    // Cross-request cognitive memory: the first question stores a tenant-scoped
    // snapshot, every later question retrieves it.
    for (const question of [Q1, Q2, Q8, Q9]) {
      const response = await post("/api/assistant", cookieA, { question });
      expect(response.status).toBe(200);
      tenantA.set(question, (await response.json()) as AssistantResponse);
    }

    // A second tenant ingests the same document and asks a question. It must not
    // observe tenant A's memory.
    const cookieB = await register("b04-owner-b", "B04 Org B");
    await ingestAndAnalyze(cookieB);
    const firstB = await post("/api/assistant", cookieB, { question: Q2 });
    expect(firstB.status).toBe(200);
    const firstBBody = (await firstB.json()) as AssistantResponse;
    tenantBMemoryTenantId = firstBBody.cognition.memory.tenantId;
    tenantBFirstRetrieved = firstBBody.cognition.memory.retrievedCount;
    const secondB = await post("/api/assistant", cookieB, { question: Q8 });
    expect(secondB.status).toBe(200);
    tenantBSecondQuestion = (await secondB.json()) as AssistantResponse;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const of = (question: string): AssistantResponse => {
    const body = tenantA.get(question);
    if (!body) throw new Error(`no response recorded for ${question}`);
    return body;
  };

  test("memory retrieval is genuinely present in the cognition provenance", () => {
    for (const question of [Q1, Q2, Q8, Q9]) {
      const body = of(question);
      expect(body.cognition.memory).toBeTruthy();
      expect(body.cognition.memory.retrievalOccurred).toBe(true);
      expect(body.cognition.memory.tenantId).toBe(body.tenantId);
      expect(body.cognition.memory.authoritativeSource).toBe("CURRENT_CANONICAL_EVIDENCE");
      expect(body.cognition.memory.references.length).toBe(body.cognition.memory.retrievedCount);
      expect(body.cognition.memory.traceId).toBe(body.cognition.traceId);
    }
  });

  test("memory is used across requests, not merely declared", () => {
    // The first question stores the canonical snapshot; later questions see it.
    expect(of(Q1).cognition.memory.retrievedCount).toBe(0);
    expect(of(Q2).cognition.memory.retrievedCount).toBeGreaterThanOrEqual(1);
    expect(of(Q9).cognition.memory.retrievedCount).toBeGreaterThanOrEqual(1);
  });

  test("cognition still executes and question-driven routing still works", () => {
    for (const question of [Q1, Q2, Q8, Q9]) {
      const body = of(question);
      expect(body.cognition.status).toBe("READY");
      expect(body.cognition.executedCapabilities.length).toBeGreaterThan(0);
      expect(body.cognition.traceId).toMatch(/^TRACE-/);
    }
    expect(of(Q1).cognition.intent.primary).toBe("ANALYZE");
    expect(of(Q2).cognition.intent.primary).toBe("RESILIENCE");
  });

  test("Q8 and Q9 remain COMPOSITE", () => {
    expect(of(Q8).cognition.intent.answerMode).toBe("COMPOSITE");
    expect(of(Q8).cognition.intent.secondary.length).toBeGreaterThanOrEqual(2);
    expect(of(Q8).cognition.executedCapabilities).toContain("SCENARIO");
    expect(of(Q8).cognition.executedCapabilities).toContain("LIQUIDITY_LEVERAGE");

    expect(of(Q9).cognition.intent.answerMode).toBe("COMPOSITE");
    expect(of(Q9).cognition.intent.primary).toBe("RISK");
    expect(of(Q9).cognition.intent.secondary).toContain("ACTION");
    expect(of(Q9).cognition.executedCapabilities).toContain("ACTION_FINDINGS");
  });

  test("canonical financial values remain authoritative over memory", () => {
    const analyze = of(Q1).cognition;
    const financial = analyze.capabilities.find((entry) => entry.capability === "FINANCIAL_INTELLIGENCE");
    expect(financial?.status).toBe("EXECUTED");
    expect(financial?.owner).toBe("FinancialIntelligenceEngine");
    expect(financial?.evidenceCount ?? 0).toBeGreaterThan(0);
    // Every surfaced disagreement keeps the canonical value authoritative.
    for (const question of [Q1, Q2, Q8, Q9]) {
      for (const contradiction of of(question).cognition.contradictions) {
        expect(contradiction.resolution).toBe("CANONICAL_WINS");
      }
      for (const conflict of of(question).cognition.memory.conflicts) {
        expect(conflict.resolution).toBe("CANONICAL_WINS");
        expect(typeof conflict.canonicalValue).toBe("number");
      }
    }
  });

  test("tenant B never sees tenant A memory", () => {
    expect(tenantBMemoryTenantId).toBe(tenantBSecondQuestion.tenantId);
    // Tenant B's first question retrieved none of tenant A's records.
    expect(tenantBFirstRetrieved).toBe(0);
    const aReferences = new Set(of(Q9).cognition.memory.references);
    for (const reference of tenantBSecondQuestion.cognition.memory.references) {
      expect(aReferences.has(reference)).toBe(false);
    }
    expect(tenantBSecondQuestion.cognition.memory.conflicts).toHaveLength(0);
  });

  test("unavailable capabilities remain honest and no internal identifier leaks", () => {
    // Q9 selects risk scoring, but a statement document carries no risk
    // probability/impact: honest absence, never a fabricated score.
    const risk = of(Q9).cognition.unavailableCapabilities.find((entry) => entry.capability === "RISK_INTELLIGENCE");
    expect(risk).toBeTruthy();
    expect(risk?.owner).toBe("RiskIntelligenceEngine.assess");
    expect(risk?.reason.length).toBeGreaterThan(0);
    for (const question of [Q1, Q2, Q8, Q9]) {
      const body = of(question);
      expect(INTERNAL_LEAK.test(body.answer)).toBe(false);
      expect(body.answer).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
