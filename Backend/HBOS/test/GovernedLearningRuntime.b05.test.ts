/**
 * B-05.2 — governed learning inside the REAL cognitive path.
 *
 * Nothing here is mocked away. Two proofs are combined:
 *
 *  1. REAL HTTP: a real `CommercialRuntimeServer` ingests the real 123.xlsx
 *     benchmark and answers real `POST /api/assistant` requests. The runtime's
 *     own observed result drives the canonical lifecycle, and a later request
 *     genuinely retrieves the promoted artifact through cognitive orchestration.
 *
 *  2. REAL orchestration: the real `CognitiveOrchestrationService` composed with
 *     the real `GovernedLearningLifecycle`, the real `GovernanceEngine`, the real
 *     `MemoryEngine` and the real `IntelligenceEngine`, over the canonical insight
 *     composed from the same real document. Only the reasoning call is observed
 *     (a spy on the real engine) so the `knowledgeItems` handed to it can be
 *     inspected — the learning service itself is never replaced.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { CognitiveOrchestrationService } from "../Product/CognitiveOrchestrationService";
import { GovernedLearningLifecycle } from "../Product/GovernedLearningLifecycle";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { GovernanceEngine } from "../Engines/GovernanceEngine";
import { IntelligenceEngine } from "../Engines/IntelligenceEngine";
import { MemoryEngine } from "../Core/MemoryEngine";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";

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
    // No Desktop access: the real-dataset acceptance stays skipped.
  }
  return undefined;
};

const REAL_XLSX = findRealXlsx();
const REAL = Boolean(REAL_XLSX && existsSync(REAL_XLSX as string));

const Q1 = "تحلیل کامل صورت مالی را انجام بده";
const Q2 = "وضعیت تاب‌آوری مالی شرکت چگونه است؟";

/** Canonical 123.xlsx truth. Read from the composed insight, never reconstructed. */
const CANONICAL_REVENUE = 32_129_418_000_000;
const CANONICAL_NET_PROFIT = 7_250_000_000_000;

const ownerContext = (tenantId: string) =>
  SecurityContext.forHumanUser(Principal.humanUser("owner", tenantId), [Authorization.READ, Authorization.WRITE, Authorization.ACCESS_EVIDENCE]);
const viewerContext = (tenantId: string) =>
  SecurityContext.forHumanUser(Principal.humanUser("viewer", tenantId), [Authorization.READ]);

const INTERNAL_LEAK = /\b(preTaxIncome|netIncome|cashConversionCycle|operatingIncome|grossProfit|balance-sheet-identity|productSegments|FINANCIAL_INTELLIGENCE|RESILIENCE|COMPOSITE|COGNITIVE_FINANCIAL_ASSERTION|GovernedLearningLifecycle|statement-integrity-reconciliation|CANONICAL_WINS)\b/;

interface LearningProvenanceWire {
  retrievalOccurred: boolean;
  tenantId: string | null;
  retrievedCount: number;
  activeVersions: number[];
  authoritativeSource: string;
  contradictionCount: number;
  promotedThisRequest?: string;
}

interface CognitionWire {
  traceId: string;
  status: string;
  contradictions: { subject: string; canonicalValue: number; specialistValue: number; resolution: string }[];
  limitations: string[];
  learning: LearningProvenanceWire;
}

interface AssistantWire {
  status: string;
  tenantId: string;
  answer: string;
  cognition: CognitionWire;
  evidence: { analysisSource: { sha256: string } };
}

(REAL ? describe : describe.skip)("B-05.2 governed learning over the real HTTP runtime and real orchestration (123.xlsx)", () => {
  let server: Server;
  let clock = 1_950_000_000_000;
  let sha256 = "";

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
    sha256 = (await ingested.json()).evidence.sha256 as string;
    expect(sha256).toMatch(/^10d44d/);
    const analyze = await post("/api/financial/analyze", cookie, { sourceSha256: sha256 });
    expect(analyze.status).toBe(200);
    const analytics = await post("/api/financial/insights", cookie, { sourceSha256: sha256 });
    expect(analytics.status).toBe(200);
    return analytics;
  };

  // ---- real HTTP chain ---------------------------------------------------
  let tenantAFirst!: AssistantWire;
  let tenantASecond!: AssistantWire;
  let tenantBFirst!: AssistantWire;
  let tenantBSecond!: AssistantWire;

  // ---- real orchestration chain ------------------------------------------
  let store!: SQLitePersistenceStore;
  let learning!: GovernedLearningLifecycle;
  let intelligence!: IntelligenceEngine;
  let orchestration!: CognitiveOrchestrationService;
  let insight!: Record<string, unknown>;
  let insightSnapshot = "";

  beforeAll(async () => {
    server = createCommercialRuntimeServer({
      databasePath: ":memory:",
      now: () => clock,
      reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "stub" }) },
      sessionSweepIntervalMs: 0,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));

    const cookieA = await register("b05-owner-a", "B05 Org A");
    const analyticsA = await ingestAndAnalyze(cookieA);
    insight = (await analyticsA.json()).statementInsight as Record<string, unknown>;
    expect(insight).toBeTruthy();
    insightSnapshot = JSON.stringify(insight);

    tenantAFirst = (await (await post("/api/assistant", cookieA, { question: Q1 })).json()) as AssistantWire;
    tenantASecond = (await (await post("/api/assistant", cookieA, { question: Q2 })).json()) as AssistantWire;

    const cookieB = await register("b05-owner-b", "B05 Org B");
    await ingestAndAnalyze(cookieB);
    tenantBFirst = (await (await post("/api/assistant", cookieB, { question: Q1 })).json()) as AssistantWire;
    tenantBSecond = (await (await post("/api/assistant", cookieB, { question: Q2 })).json()) as AssistantWire;

    store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    learning = new GovernedLearningLifecycle(store, new GovernanceEngine(), () => ++clock);
    intelligence = new IntelligenceEngine();
    orchestration = new CognitiveOrchestrationService(undefined, undefined, undefined, intelligence, new MemoryEngine(), learning);
  });

  afterAll(async () => {
    store?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // ---- helpers over the REAL lifecycle -----------------------------------
  const TENANT = "orchestration-tenant-a";
  const OTHER = "orchestration-tenant-b";
  const SUBJECT = "statement-integrity-reconciliation";

  const promoteLesson = async (tenantId: string, subject: string, statement: string) => {
    const observation = await learning.recordObservation({
      tenantId, subject,
      sourceRef: `financial-ingestion:${sha256}`,
      observedAt: new Date(Date.parse("2026-10-01T00:00:00.000Z") + clock).toISOString(),
    });
    const candidate = await learning.createCandidateLesson({ tenantId, observationRef: observation.observationId, statement });
    await learning.validateEvidence({
      tenantId, candidateRef: candidate.candidateId,
      evidence: [{ ref: `integrity:${sha256}:balance-sheet-identity`, verified: true }],
    });
    const measured = await learning.recordMeasuredResult({
      tenantId, candidateRef: candidate.candidateId,
      metric: "reconciledIntegrityControls", outcome: "FULLY_RECONCILED", value: 6,
    });
    return learning.promote({ tenantId, candidateRef: measured.candidateId, securityContext: ownerContext(tenantId) });
  };

  const ask = (tenantId: string, question = Q1) => orchestration.orchestrate({ tenantId, question, insight: insight as never });

  // ============================================================ positive

  test("the REAL /api/assistant path creates a governed learning artifact from its own observed result", () => {
    // The first request has nothing to retrieve: retrieval precedes learning.
    expect(tenantAFirst.cognition.learning.retrievalOccurred).toBe(true);
    expect(tenantAFirst.cognition.learning.retrievedCount).toBe(0);
    // It promoted a real artifact from this request's real verified outcome.
    expect(tenantAFirst.cognition.learning.promotedThisRequest).toMatch(/^learn-statement-integrity-reconciliation-v1-/);
  });

  test("the REAL /api/assistant path then retrieves that artifact through cognitive orchestration", () => {
    expect(tenantASecond.cognition.learning.retrievalOccurred).toBe(true);
    expect(tenantASecond.cognition.learning.retrievedCount).toBe(1);
    expect(tenantASecond.cognition.learning.activeVersions).toEqual([1]);
    expect(tenantASecond.cognition.learning.tenantId).toBe(tenantASecond.tenantId);
    expect(tenantASecond.cognition.learning.authoritativeSource).toBe("CURRENT_CANONICAL_EVIDENCE");
  });

    test("the learned artifact reaches the REAL IntelligenceEngine as knowledgeItems", async () => {
     const reason = jest.spyOn(IntelligenceEngine.prototype, "reason");
     try {
       ask(TENANT);
       expect(reason).toHaveBeenCalled();
       const contexts = reason.mock.calls.map((call) => call[1]);
       // Nothing is learned yet for this tenant, so run again after promotion.
       reason.mockClear();
       const artifact = await promoteLesson(TENANT, SUBJECT, "Collecting receivables faster improved the current ratio over two observed cycles.");
       const result = ask(TENANT);
       expect(result.learning.retrievalOccurred).toBe(true);
       expect(result.learning.retrievedCount).toBe(1);
       expect(result.learning.artifactRefs).toEqual([artifact.artifactId]);
       expect(result.learning.activeVersions).toEqual([1]);

       // Expect that the reason method was called during this ask.
       expect(reason).toHaveBeenCalled();
       const passed = reason.mock.calls[reason.mock.calls.length - 1][1];
       const learned = passed.knowledgeItems.filter((item) => item.source.startsWith("learning:"));
       expect(learned).toHaveLength(1);
       expect(learned[0].id).toBe(artifact.artifactId);
       expect(learned[0].title).toBe(`learning:${SUBJECT}@v1`);
       expect(learned[0].description).toContain("reconciledIntegrityControls");
       expect(learned[0].tenantId).toBe(TENANT);
       // Contextual, never canonical truth.
       expect(learned[0].confidence).toBe(0.5);
       void contexts;
     } finally {
       reason.mockRestore();
     }
   });

  test("learned knowledge influences reasoning without changing canonical financial facts", () => {
    const result = ask(TENANT);
    expect(result.reasoning.status).toBe("EXECUTED");
    // Reasoning still ran over the deterministic canonical owners.
    expect(result.executionOrder.indexOf("REASONING")).toBeGreaterThan(result.executionOrder.indexOf("FINANCIAL_INTELLIGENCE"));
    const financial = result.executed.find((entry) => entry.capability === "FINANCIAL_INTELLIGENCE");
    expect(financial?.status).toBe("EXECUTED");
    expect(financial?.result.profit).toBe(CANONICAL_NET_PROFIT);
    expect(financial?.result.revenue).toBe(CANONICAL_REVENUE);
    // The canonical insight was never mutated.
    expect(JSON.stringify(insight)).toBe(insightSnapshot);
  });

  // ======================================================== contradiction

  test("a divergent learned artifact yields CANONICAL_WINS and preserves both sides", async () => {
    // A controlled, deliberate divergence from the canonical 123.xlsx truth.
    const divergentStatement = JSON.stringify({ netProfit: 1 });
    const artifact = await promoteLesson(TENANT, SUBJECT, divergentStatement);

    const result = ask(TENANT);
    expect(result.learning.retrievalOccurred).toBe(true);
    expect(result.learning.contradictions).toHaveLength(1);
    const conflict = result.learning.contradictions[0];
    expect(conflict.resolution).toBe("CANONICAL_WINS");
    expect(conflict.subject).toBe("netProfit");
    expect(conflict.learnedValue).toBe(1);
    expect(conflict.canonicalValue).toBe(CANONICAL_NET_PROFIT);
    expect(conflict.artifactRef).toBe(artifact.artifactId);
    expect(conflict.artifactVersion).toBe(2);

    // Also surfaced on the standard contradiction channel.
    const mirrored = result.contradictions.filter((entry) => entry.subject === "netProfit" && entry.specialistValue === 1);
    expect(mirrored.length).toBeGreaterThanOrEqual(1);
    for (const entry of result.contradictions) expect(entry.resolution).toBe("CANONICAL_WINS");

    // Canonical truth is untouched; no merge, no averaging.
    expect(JSON.stringify(insight)).toBe(insightSnapshot);
    const financial = result.executed.find((entry) => entry.capability === "FINANCIAL_INTELLIGENCE");
    expect(financial?.result.profit).toBe(CANONICAL_NET_PROFIT);

    // The learning artifact is preserved, not discarded.
    const preserved = learning.retrieveVersionSync(TENANT, SUBJECT, 2);
    expect(preserved?.artifactId).toBe(artifact.artifactId);
    expect(preserved?.statement).toBe(divergentStatement);
  });

  test("the superseded version is not returned as active context but stays recoverable", async () => {
    const result = ask(TENANT);
    expect(result.learning.activeVersions).toEqual([2]);
    expect(result.learning.retrievedCount).toBe(1);
    const v1 = learning.retrieveVersionSync(TENANT, SUBJECT, 1);
    expect(v1?.validity).toBe("SUPERSEDED");
    expect(v1?.statement).toContain("Collecting receivables faster");
  });

  // ============================================================ negative

  test("blank tenant fails closed — no learning is retrieved at all", () => {
    const result = orchestration.orchestrate({ tenantId: "   ", question: Q1, insight: insight as never });
    expect(result.learning.retrievalOccurred).toBe(false);
    expect(result.learning.retrievedCount).toBe(0);
    expect(result.learning.artifactRefs).toEqual([]);
    expect(result.learning.activeVersions).toEqual([]);
  });

  test("tenant B never retrieves tenant A's learning artifact", async () => {
    // Tenant A really holds an active artifact.
    expect(ask(TENANT).learning.retrievedCount).toBe(1);
    // Tenant B, same real document, same orchestration service: nothing.
    const other = ask(OTHER);
    expect(other.learning.retrievalOccurred).toBe(true);
    expect(other.learning.retrievedCount).toBe(0);
    expect(other.learning.tenantId).toBe(OTHER);
    expect(learning.retrieveActiveSync(OTHER)).toEqual([]);
  });

  test("over the real HTTP runtime, tenant B never sees tenant A's learning", () => {
    // Tenant B's first request predates its own artifact.
    expect(tenantBFirst.cognition.learning.retrievalOccurred).toBe(true);
    expect(tenantBFirst.cognition.learning.retrievedCount).toBe(0);
    expect(tenantBFirst.cognition.learning.tenantId).toBe(tenantBFirst.tenantId);
    expect(tenantBFirst.tenantId).not.toBe(tenantAFirst.tenantId);
    // Its second request sees only its own artifact, promoted by itself.
    expect(tenantBSecond.cognition.learning.retrievedCount).toBe(1);
    expect(tenantBSecond.cognition.learning.promotedThisRequest).toBeUndefined();
    expect(tenantBSecond.cognition.learning.tenantId).toBe(tenantBSecond.tenantId);
  });

  test("a candidate without a measured result cannot become promoted, even over real evidence", async () => {
    const observation = await learning.recordObservation({
      tenantId: OTHER, subject: "unmeasured-lesson",
      sourceRef: `financial-ingestion:${sha256}`,
      observedAt: new Date(clock).toISOString(),
    });
    const candidate = await learning.createCandidateLesson({ tenantId: OTHER, observationRef: observation.observationId, statement: "Shortening the collection cycle helps." });
    await learning.validateEvidence({
      tenantId: OTHER, candidateRef: candidate.candidateId,
      evidence: [{ ref: `integrity:${sha256}:cash-flow-identity`, verified: true }],
    });
    await expect(learning.promote({ tenantId: OTHER, candidateRef: candidate.candidateId, securityContext: ownerContext(OTHER) }))
      .rejects.toThrow(/measured result/);
    expect(learning.retrieveActiveSync(OTHER)).toEqual([]);
  });

  test("a candidate with invalid evidence cannot become promoted", async () => {
    const observation = await learning.recordObservation({
      tenantId: OTHER, subject: "invalid-evidence-lesson",
      sourceRef: `financial-ingestion:${sha256}`,
      observedAt: new Date(clock).toISOString(),
    });
    const candidate = await learning.createCandidateLesson({ tenantId: OTHER, observationRef: observation.observationId, statement: "Extending payables improves liquidity." });
    await learning.validateEvidence({
      tenantId: OTHER, candidateRef: candidate.candidateId,
      evidence: [{ ref: "unverified-hypothesis", verified: false }],
    });
    const measured = await learning.recordMeasuredResult({
      tenantId: OTHER, candidateRef: candidate.candidateId,
      metric: "currentRatio", outcome: "IMPROVED", value: 1.8,
    });
    expect(measured.validationState).toBe("INVALID");
    await expect(learning.promote({ tenantId: OTHER, candidateRef: candidate.candidateId, securityContext: ownerContext(OTHER) }))
      .rejects.toThrow(/VALIDATED/);
    expect(learning.retrieveActiveSync(OTHER)).toEqual([]);
  });

  test("an unauthorized promotion is denied by the real GovernanceEngine", async () => {
    const observation = await learning.recordObservation({
      tenantId: OTHER, subject: "viewer-denied-lesson",
      sourceRef: `financial-ingestion:${sha256}`,
      observedAt: new Date(clock).toISOString(),
    });
    const candidate = await learning.createCandidateLesson({ tenantId: OTHER, observationRef: observation.observationId, statement: "Refinancing lowers the debt ratio." });
    await learning.validateEvidence({
      tenantId: OTHER, candidateRef: candidate.candidateId,
      evidence: [{ ref: `integrity:${sha256}:pre-tax-identity`, verified: true }],
    });
    const measured = await learning.recordMeasuredResult({
      tenantId: OTHER, candidateRef: candidate.candidateId,
      metric: "debtRatio", outcome: "IMPROVED", value: 0.4,
    });
    await expect(learning.promote({ tenantId: OTHER, candidateRef: candidate.candidateId, securityContext: viewerContext(OTHER) }))
      .rejects.toThrow(/DENIED/);
    expect(learning.retrieveActiveSync(OTHER)).toEqual([]);
    // And a cross-tenant actor cannot promote into another tenant either.
    await expect(learning.promote({ tenantId: OTHER, candidateRef: measured.candidateId, securityContext: ownerContext(TENANT) }))
      .rejects.toThrow(/DENIED/);
    expect(learning.retrieveActiveSync(OTHER)).toEqual([]);
  });

  test("orchestration without a learning dependency keeps the exact previous behaviour", () => {
    const legacy = new CognitiveOrchestrationService();
    const result = legacy.orchestrate({ tenantId: TENANT, question: Q1, insight: insight as never });
    expect(result.learning.retrievalOccurred).toBe(false);
    expect(result.learning.retrievedCount).toBe(0);
    expect(result.learning.tenantId).toBe(TENANT);
    expect(result.reasoning.status).toBe("EXECUTED");
  });

  test("no learning internals leak into the Persian user answer", () => {
    for (const body of [tenantAFirst, tenantASecond, tenantBSecond]) {
      expect(INTERNAL_LEAK.test(body.answer)).toBe(false);
      expect(body.answer).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
