/**
 * C-01.1 — platform-wide cognitive entry over the REAL runtime.
 *
 * The knot under test is the claim that the canonical assistant path is a
 * PLATFORM entry point, not a financial-only entry point:
 *
 *   1. A non-financial question reaches the canonical assistant path.
 *   2. It does NOT require a fabricated `FinancialStatementInsight`.
 *   3. The question intent is classified by the canonical classifier.
 *   4. The classified intent selects the capability set.
 *   5. Capabilities whose canonical owner has no verified evidence are
 *      reported `UNAVAILABLE` with an honest reason.
 *   6. Reasoning still runs, and receives ONLY the verified context that
 *      genuinely exists.
 *   7. No fabricated domain result is produced.
 *   8. The existing financial `/api/assistant` behaviour is unchanged.
 *
 * NOTHING is mocked. The real `CommercialRuntimeServer` is created, real
 * tenants register over real HTTP, and the questions are answered by the real
 * `CognitiveOrchestrationService`, the real `FinancialIntelligenceEngine`,
 * the real `GovernanceEngine`, the real `MemoryEngine`, the real
 * `GovernedLearningLifecycle` and the real `IntelligenceEngine`. The
 * reasoning call is only OBSERVED — a pass-through spy over the real engine's
 * prototype method — so the context actually handed to it can be inspected.
 * The engine itself always executes; its behaviour is never replaced.
 *
 * No evidence is fabricated. Where a domain capability genuinely cannot run,
 * the test asserts the honest absence rather than a simulated result.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { IntelligenceEngine } from "../Engines/IntelligenceEngine";

/** Canonical 123.xlsx truth, asserted only on the financial regression path. */
const CANONICAL_REVENUE = 32_129_418_000_000;
const CANONICAL_NET_PROFIT = 7_250_000_000_000;
const CANONICAL_TOTAL_ASSETS = 32_244_256_000_000;
const CANONICAL_TOTAL_LIABILITIES = 17_407_417_000_000;

const findRealXlsx = (): string | undefined => {
  if (process.env.HOOSHYAR_REAL_XLSX) return process.env.HOOSHYAR_REAL_XLSX;
  // Portable discovery: env override first, then platform user profile, then repo-relative fallback
  const candidates: string[] = [];
  if (process.env.USERPROFILE) {
    candidates.push(`${process.env.USERPROFILE}\\Desktop`);
    candidates.push(`${process.env.USERPROFILE}\\OneDrive\\Desktop`);
  }
  if (process.env.HOME) {
    candidates.push(`${process.env.HOME}\\Desktop`);
  }
  // Repository-relative fixture directory (only if artifact is genuinely present)
  candidates.push(`${process.cwd()}\\test-fixtures`);
  for (const base of candidates) {
    try {
      if (!existsSync(base)) continue;
      for (const entry of readdirSync(base, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const candidate = `${base}\\${entry.name}\\123.xlsx`;
        if (existsSync(candidate)) return candidate;
      }
    } catch (e) {
      // Discovery failed for this candidate — log and continue to next
      console.error(`[C-01.1] Fixture discovery failed for ${base}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return undefined;
};

const REAL_XLSX = findRealXlsx();
const REAL = Boolean(REAL_XLSX && existsSync(REAL_XLSX as string));

// Explicit diagnostic when real benchmark is absent — fails visibly rather than silently passing
if (!REAL) {
  console.error("[C-01.1] REAL benchmark not available. Set HOOSHYAR_REAL_XLSX or place 123.xlsx in a discoverable location. Financial regression tests will be skipped with explicit diagnostics.");
}

/**
 * Internal identifiers that must never reach a user-facing Persian answer:
 * canonical English field names, engine and service names, capability ids,
 * provenance refs and raw request-context markers.
 */
const INTERNAL_LEAK =
  /\b(preTaxIncome|netIncome|cashConversionCycle|operatingIncome|grossProfit|balance-sheet-identity|productSegments|FINANCIAL_INTELLIGENCE|LIQUIDITY_LEVERAGE|ACTION_FINDINGS|EXECUTIVE_INTELLIGENCE|ORGANIZATIONAL_INTELLIGENCE|INTEGRITY_EVIDENCE|DECISION_INTELLIGENCE|REASONING|COGNITIVE_FINANCIAL_ASSERTION|GovernedLearningLifecycle|CognitiveOrchestrationService|FinancialStatementInsight|FinancialIntelligenceEngine|IntelligenceEngine|GovernanceEngine|CANONICAL_WINS|StatementInsight|SourceSha256)\b/;
/** Reasoning-context markers and runtime provenance that must stay internal. */
const CONTEXT_LEAK = /(Revenue=|Profit=|ProfitMargin=|DebtRatio=|Observations=|SourceSha256=|financial-ingestion:|integrity:|governance:|TRACE-|tenant:)/;

interface CapabilityWire {
    capability: string;
    owner: string;
    status: "EXECUTED" | "UNAVAILABLE" | "NOT_REQUIRED";
    unavailableReason?: string;
    evidenceCount: number;
}

interface UnavailableWire {
    capability: string;
    owner: string;
    reason: string;
}

interface CognitionWire {
    traceId: string;
    status: string;
    intent: {
        primary: string;
        secondary: string[];
        answerMode: string;
        userGoal: string;
        requiredEvidenceDomains: string[];
    };
    selectedCapabilities: string[];
    executionOrder: string[];
    capabilities: CapabilityWire[];
    executedCapabilities: string[];
    unavailableCapabilities: UnavailableWire[];
    reasoning: { status: string; confidenceSource: string; stepCount: number };
    contradictions: unknown[];
    limitations: string[];
    memory: { retrievalOccurred: boolean; tenantId: string | null; retrievedCount: number; references: string[]; authoritativeSource: string };
    learning: {
        retrievalOccurred: boolean;
        tenantId: string | null;
        retrievedCount: number;
        activeVersions: number[];
        authoritativeSource: string;
        contradictionCount: number;
        promotedThisRequest?: string;
    };
}

interface AssistantWire {
    status: string;
    tenantId: string;
    question: string;
    answer: string;
    cognition: CognitionWire;
    evidence: {
        analysisSource: { sha256: string } | null;
        financialAnalysisAvailable: boolean;
        executiveWorkbench: boolean;
        statementContext: boolean;
    };
}

/**
 * The non-financial question families C-01.1 must serve. Each is a real user
 * question expressed in Persian. `expectedIntent` is the intent the CANONICAL
 * classifier actually produces for it — asserted as observed truth, never as
 * an assumed label.
 */
const NON_FINANCIAL_QUESTIONS: ReadonlyArray<{
    readonly family: string;
    readonly question: string;
    readonly expectedIntent: string;
}> = [
    { family: "ACTION", question: "برای بهبود وضعیت چه اقداماتی پیشنهاد می‌شود؟", expectedIntent: "ACTION" },
    { family: "ORGANIZATIONAL", question: "سازمان و فرآیند تأیید تصمیم شرکت چگونه است؟", expectedIntent: "ORGANIZATIONAL" },
    { family: "DECISION", question: "کدام گزینه برای تأمین نقدینگی مناسب‌تر است؟", expectedIntent: "DECISION" },
    { family: "EXECUTION", question: "وضعیت اجرای اقدام‌های اصلاحی چیست؟", expectedIntent: "EXECUTION" },
    { family: "OPERATIONAL", question: "ظرفیت عملیاتی و جریان تأمین چطور کار می‌کند؟", expectedIntent: "OPERATIONAL" },
    { family: "GENERAL", question: "یک توضیح کلی درباره این شرکت بده", expectedIntent: "GENERAL" },
];

/**
 * Capabilities whose canonical owner consumes verified domain evidence. With
 * no statement, no workbench and no decision matrix in existence, none of them
 * may execute: each must be reported UNAVAILABLE with its honest reason.
 */
const EVIDENCE_DEPENDENT: ReadonlySet<string> = new Set([
    "COMPARATIVE_EVIDENCE",
    "INTEGRITY_EVIDENCE",
    "PRODUCT_SEGMENT",
    "SCENARIO",
    "ACTION_FINDINGS",
    "FINANCIAL_INTELLIGENCE",
    "LIQUIDITY_LEVERAGE",
    "WORKING_CAPITAL",
    "EARNINGS_QUALITY",
    "RISK_INTELLIGENCE",
    "ORGANIZATIONAL_INTELLIGENCE",
    "EXECUTIVE_INTELLIGENCE",
    "DECISION_INTELLIGENCE",
]);
/** Reasoning input/context as the real `IntelligenceEngine` received it. */
/** The REAL reasoning method, captured before any observation spy is installed. */
const REAL_REASON = IntelligenceEngine.prototype.reason;

interface ObservedReasoning {
    problem: string;
    data: Record<string, unknown>;
    knowledgeItems: Array<{ id: string; title: string; description: string; confidence: number; source: string; tenantId?: string }>;
    evidenceItems: Array<{ id: string; type: string; summary: string; sourceRef: string; tenantId?: string }>;
}

describe("C-01.1 platform-wide cognitive entry — non-financial questions over the REAL runtime", () => {
    let server: Server;
    let clock = 1_950_000_000_000;
    /** Observed reasoning calls. The engine itself always runs. */
    let observed: ObservedReasoning[] = [];

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
        clock += 1000;
        const response = await request("/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
        });
        const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
        expect(cookie).toBeTruthy();
        return cookie;
    };

    /** Ask the real endpoint and return both the HTTP status and the body. */
    const ask = async (cookie: string, question: string) => {
        const response = await post("/api/assistant", cookie, { question });
        return { status: response.status, body: (await response.json()) as AssistantWire };
    };

    // ---- REAL HTTP chain, tenant with NO prior financial analysis ----------
    let owner!: string;
    let otherOwner!: string;
    const answers = new Map<string, AssistantWire>();

    beforeAll(async () => {
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            now: () => clock,
            sessionSweepIntervalMs: 0,
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));

        // Observe the REAL IntelligenceEngine.reason without replacing it: the
        // spy calls through, so reasoning genuinely executes every time.
        const spy = jest.spyOn(IntelligenceEngine.prototype, "reason");
        spy.mockImplementation(function (this: IntelligenceEngine, input: any, context: any) {
            observed.push({
                problem: input.problem,
                data: input.data ?? {},
                knowledgeItems: context.knowledgeItems ?? [],
                evidenceItems: context.evidenceItems ?? [],
            });
            return REAL_REASON.call(this, input, context);
        });

        // Two real tenants. Neither ever ingests, analyzes, or otherwise
        // produces a FinancialStatementInsight.
        owner = await register("c011-owner-a", "C011 Org A");
        otherOwner = await register("c011-owner-b", "C011 Org B");
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            answers.set(entry.family, (await ask(owner, entry.question)).body);
        }
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    // ============================================================ 1 + 2

    test("a non-financial question enters the canonical assistant path instead of being refused", () => {
        expect(answers.size).toBe(NON_FINANCIAL_QUESTIONS.length);
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const body = answers.get(entry.family)!;
            // The endpoint answers; it does not fail closed with a synthetic
            // ASSISTANT_ANALYSIS_REQUIRED rejection.
            expect(body.status).toBe("READY");
            expect(body.question).toBe(entry.question);
            expect(body.cognition.traceId).toMatch(/^TRACE-/);
            expect(body.cognition.selectedCapabilities.length).toBeGreaterThan(0);
            expect(body.answer.trim().length).toBeGreaterThan(0);
        }
    });

    test("no request requires a fake FinancialStatementInsight — the absence is reported, not filled in", () => {
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const body = answers.get(entry.family)!;
            expect(body.evidence.statementContext).toBe(false);
            expect(body.evidence.financialAnalysisAvailable).toBe(false);
            expect(body.evidence.analysisSource).toBeNull();
            // Nothing statement-shaped leaked into the cognition contract: with
            // no canonical statement there can be no canonical-vs-specialist
            // disagreement to report.
            expect(body.cognition.contradictions).toEqual([]);
            // No capability whose owner needs statement evidence executed, so no
            // result can have been derived from a synthesized insight.
            for (const capability of body.cognition.capabilities) {
                if (EVIDENCE_DEPENDENT.has(capability.capability)) {
                    expect(capability.status).not.toBe("EXECUTED");
                }
            }
            // Governance is the one capability that legitimately runs from the
            // caller's own authority, with no statement evidence at all.
            expect(body.cognition.executedCapabilities.every((capability) => capability === "GOVERNANCE")).toBe(true);
        }
    });

    // ============================================================ 3 + 4

    test("every non-financial question is classified by the canonical intent contract", () => {
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const intent = answers.get(entry.family)!.cognition.intent;
            expect(intent.primary).toBe(entry.expectedIntent);
            expect(Array.isArray(intent.secondary)).toBe(true);
            expect(["FOCUSED", "COMPOSITE"]).toContain(intent.answerMode);
            expect(intent.userGoal.length).toBeGreaterThan(0);
            expect(intent.requiredEvidenceDomains.length).toBeGreaterThan(0);
        }
    });

    test("capability selection is produced from the classified intent, and differs between question families", () => {
        const action = answers.get("ACTION")!.cognition;
        expect(action.selectedCapabilities).toContain("ACTION_FINDINGS");
        expect(action.selectedCapabilities).toContain("GOVERNANCE");
        expect(action.selectedCapabilities).toContain("REASONING");
        expect(action.selectedCapabilities).not.toContain("FINANCIAL_INTELLIGENCE");

        const general = answers.get("GENERAL")!.cognition;
        expect(general.selectedCapabilities).toContain("FINANCIAL_INTELLIGENCE");
        expect(general.selectedCapabilities).toContain("EXECUTIVE_INTELLIGENCE");
        expect(general.selectedCapabilities).toContain("REASONING");

        // Selection is intent-driven, not fixed: two different question
        // families execute two different capability sets.
        expect(action.selectedCapabilities).not.toEqual(general.selectedCapabilities);
        // The dependency law holds: evidence, then domain analysis, then
        // reasoning, then the governance gate. Reasoning therefore never runs
        // before a domain capability, and GOVERNANCE, when selected, is the
        // terminal gate on consequential execution.
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const order = answers.get(entry.family)!.cognition.executionOrder;
            const reasoningAt = order.indexOf("REASONING");
            expect(reasoningAt).toBeGreaterThanOrEqual(0);
            const governanceAt = order.indexOf("GOVERNANCE");
            if (governanceAt >= 0) {
                expect(governanceAt).toBeGreaterThan(reasoningAt);
                expect(governanceAt).toBe(order.length - 1);
            }
            const domainCapabilities = order.filter(
                (capability) => capability !== "REASONING" && capability !== "GOVERNANCE",
            );
            for (const capability of domainCapabilities) {
                expect(order.indexOf(capability)).toBeLessThan(reasoningAt);
            }
        }
    });

    // ============================================================ 5

    test("capabilities needing financial evidence are UNAVAILABLE with an honest, non-empty reason", () => {
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const body = answers.get(entry.family)!;
            const unavailable = body.cognition.capabilities.filter((capability) => capability.status === "UNAVAILABLE");
            const reported = new Set(body.cognition.unavailableCapabilities.map((record) => record.capability));
            for (const capability of unavailable) {
                expect(capability.unavailableReason).toBeTruthy();
                expect(capability.owner.length).toBeGreaterThan(0);
                expect(reported.has(capability.capability)).toBe(true);
            }
            // Every reported unavailability names its canonical owner and why.
            for (const record of body.cognition.unavailableCapabilities) {
                expect(record.reason.trim().length).toBeGreaterThan(0);
                expect(record.owner.trim().length).toBeGreaterThan(0);
            }
            // The financial-evidence owners are named honestly rather than faked.
            const financial = unavailable.find((capability) => capability.capability === "FINANCIAL_INTELLIGENCE");
            if (financial) expect(financial.unavailableReason).toMatch(/canonical/i);
        }

        // ACTION on a tenant with no statement evidence is the sharpest case.
        const action = answers.get("ACTION")!.cognition;
        expect(action.unavailableCapabilities.map((record) => record.capability).sort()).toEqual([
            "ACTION_FINDINGS",
            "DECISION_INTELLIGENCE",
        ]);
        const findings = action.capabilities.find((capability) => capability.capability === "ACTION_FINDINGS")!;
        expect(findings.status).toBe("UNAVAILABLE");
        expect(findings.unavailableReason).toMatch(/no management action findings/i);
        const decision = action.capabilities.find((capability) => capability.capability === "DECISION_INTELLIGENCE")!;
        expect(decision.status).toBe("UNAVAILABLE");
        expect(decision.unavailableReason).toMatch(/decision request/i);
    });

    test("missing domain evidence stays explicit in the user-facing limitations", () => {
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const limitations = answers.get(entry.family)!.cognition.limitations;
            expect(limitations.length).toBeGreaterThan(0);
            for (const limitation of limitations) {
                expect(limitation.trim().length).toBeGreaterThan(0);
                // Honest limitations are user-facing Persian, never an id.
                expect(limitation).toMatch(/[\u0600-\u06FF]/);
                expect(INTERNAL_LEAK.test(limitation)).toBe(false);
            }
        }
        // The cognition status itself never claims more than ran.
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const body = answers.get(entry.family)!;
            const executedSomething = body.cognition.capabilities.some((capability) => capability.status === "EXECUTED");
            expect(body.cognition.status).toBe(executedSomething ? "READY" : "PARTIAL");
        }
    });

    // ============================================================ 6

    test("reasoning runs for every non-financial question and receives only verified context", () => {
        expect(observed.length).toBeGreaterThanOrEqual(NON_FINANCIAL_QUESTIONS.length);
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const body = answers.get(entry.family)!;
            expect(body.cognition.reasoning.status).toBe("EXECUTED");
            expect(body.cognition.reasoning.stepCount).toBeGreaterThan(0);

            const call = observed.find((item) => item.problem === entry.question);
            expect(call).toBeDefined();
            // Only genuinely EXECUTED capabilities reach the reasoning `data`;
            // an UNAVAILABLE capability contributes nothing.
            for (const key of Object.keys(call!.data)) {
                const capability = body.cognition.capabilities.find((record) => record.capability === key);
                if (capability) expect(capability.status).toBe("EXECUTED");
            }
            // No fabricated canonical financial value is injected: this tenant
            // has no statement, so no profit/revenue/ratio key may appear.
            for (const forbidden of ["profit", "revenue", "debtRatio", "profitMargin", "liquidityRatio"]) {
                expect(call!.data[forbidden]).toBeUndefined();
            }
            // Nothing was invented as historical or learned context either.
            expect(call!.knowledgeItems).toEqual([]);
            for (const item of call!.evidenceItems) {
                if (item.id.startsWith("financial-ingestion:")) throw new Error("fabricated financial evidence reference");
            }
        }
    });

    test("tenant-scoped cognitive memory and governed learning report honest retrieval", () => {
        const body = answers.get("ACTION")!;
        expect(body.cognition.memory.retrievalOccurred).toBe(true);
        expect(body.cognition.memory.tenantId).toBe(body.tenantId);
        // No analysis has ever run, so no assertion and no lesson exist.
        expect(body.cognition.memory.retrievedCount).toBe(0);
        expect(body.cognition.memory.references).toEqual([]);
        expect(body.cognition.learning.retrievalOccurred).toBe(true);
        expect(body.cognition.learning.tenantId).toBe(body.tenantId);
        expect(body.cognition.learning.retrievedCount).toBe(0);
        expect(body.cognition.learning.activeVersions).toEqual([]);
        expect(body.cognition.learning.promotedThisRequest).toBeUndefined();
        expect(body.cognition.learning.authoritativeSource).toBe("CURRENT_CANONICAL_EVIDENCE");
    });

    test("another tenant on the same runtime is scoped to its own empty context", async () => {
        const response = await ask(otherOwner, "برای بهبود وضعیت چه اقداماتی پیشنهاد می‌شود؟");
        expect(response.status).toBe(200);
        expect(response.body.status).toBe("READY");
        const body = response.body;
        expect(body.tenantId).not.toBe(answers.get("ACTION")!.tenantId);
        expect(body.cognition.memory.tenantId).toBe(body.tenantId);
        expect(body.cognition.learning.tenantId).toBe(body.tenantId);
        expect(body.cognition.memory.retrievedCount).toBe(0);
        expect(body.cognition.learning.retrievedCount).toBe(0);
    });

    // ============================================================ 7

    test("no fabricated domain result is produced for any non-financial question", () => {
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const body = answers.get(entry.family)!;
            // No domain result exists that was not produced by a canonical
            // owner from verified evidence: with no statement, only the
            // authority-only governance gate may have run.
            expect(body.cognition.executedCapabilities).not.toContain("FINANCIAL_INTELLIGENCE");
            expect(body.cognition.executedCapabilities).not.toContain("LIQUIDITY_LEVERAGE");
            expect(body.cognition.executedCapabilities).not.toContain("WORKING_CAPITAL");
            expect(body.cognition.executedCapabilities).not.toContain("EARNINGS_QUALITY");
            expect(body.cognition.executedCapabilities).not.toContain("COMPARATIVE_EVIDENCE");
            expect(body.cognition.executedCapabilities).not.toContain("INTEGRITY_EVIDENCE");
            expect(body.cognition.executedCapabilities).not.toContain("PRODUCT_SEGMENT");
            expect(body.cognition.executedCapabilities).not.toContain("SCENARIO");
            expect(body.cognition.executedCapabilities).not.toContain("RISK_INTELLIGENCE");
            expect(body.cognition.executedCapabilities).not.toContain("ORGANIZATIONAL_INTELLIGENCE");
            expect(body.cognition.executedCapabilities).not.toContain("EXECUTIVE_INTELLIGENCE");
            expect(body.cognition.executedCapabilities).not.toContain("ACTION_FINDINGS");
            // Reasoning over an empty financial context must not claim
            // certainty it does not have.
            for (const entry2 of NON_FINANCIAL_QUESTIONS) {
                const other = answers.get(entry2.family)!;
                if (other.cognition.reasoning.confidenceSource !== "unavailable") {
                    throw new Error(`unexpected confident reasoning for ${entry2.family}`);
                }
            }
            // The answer itself states the honest Persian position and invents
            // no financial figure.
            expect(body.answer).toMatch(/[\u0600-\u06FF]/);
            expect(body.answer).not.toMatch(/[0-9]/);
        }
    });

    // ============================================================ presentation

    test("the Persian answer exposes no internal identifier and no request context", () => {
        for (const entry of NON_FINANCIAL_QUESTIONS) {
            const body = answers.get(entry.family)!;
            expect(INTERNAL_LEAK.test(body.answer)).toBe(false);
            expect(CONTEXT_LEAK.test(body.answer)).toBe(false);
            expect(body.answer).not.toContain(body.tenantId);
            expect(body.answer).not.toContain(body.cognition.traceId);
            expect(body.answer).toMatch(/[\u0600-\u06FF]/);
        }
    });
});

(REAL ? describe : describe.skip)("C-01.1 regression — the financial /api/assistant path is unchanged (real 123.xlsx)", () => {
    let server: Server;
    let clock = 1_950_000_010_000;
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

    let cookie = "";
    let financialAnswer!: AssistantWire;
    let actionAnswer!: AssistantWire;
    let observed: ObservedReasoning[] = [];

    beforeAll(async () => {
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            now: () => clock,
            sessionSweepIntervalMs: 0,
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));

        const spy = jest.spyOn(IntelligenceEngine.prototype, "reason");
        spy.mockImplementation(function (this: IntelligenceEngine, input: any, context: any) {
            observed.push({
                problem: input.problem,
                data: input.data ?? {},
                knowledgeItems: context.knowledgeItems ?? [],
                evidenceItems: context.evidenceItems ?? [],
            });
            return REAL_REASON.call(this, input, context);
        });

        clock += 1000;
        const registered = await request("/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username: "c011-financial", password: "Sup3rSecret!", organization: "C011 Financial" }),
        });
        cookie = (registered.headers.get("set-cookie") ?? "").split(";")[0];
        expect(cookie).toBeTruthy();

        const bytes = readFileSync(REAL_XLSX as string);
        const ingested = await post("/api/ingest", cookie, {
            sourceName: "123.xlsx", format: "XLSX", contentBase64: bytes.toString("base64"),
        });
        expect(ingested.status).toBe(201);
        sha256 = (await ingested.json()).evidence.sha256 as string;
        expect(sha256).toMatch(/^10d44d/);
        expect((await post("/api/financial/analyze", cookie, { sourceSha256: sha256 })).status).toBe(200);
        expect((await post("/api/financial/insights", cookie, { sourceSha256: sha256 })).status).toBe(200);

        const first = await post("/api/assistant", cookie, { question: "تحلیل کامل صورت مالی را انجام بده" });
        expect(first.status).toBe(200);
        financialAnswer = (await first.json()) as AssistantWire;

        const second = await post("/api/assistant", cookie, { question: "برای بهبود وضعیت چه اقداماتی پیشنهاد می‌شود؟" });
        expect(second.status).toBe(200);
        actionAnswer = (await second.json()) as AssistantWire;
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    test("the financial question still executes the canonical financial capabilities with canonical values", () => {
        expect(financialAnswer.cognition.intent.primary).toBe("ANALYZE");
        expect(financialAnswer.evidence.financialAnalysisAvailable).toBe(true);
        expect(financialAnswer.evidence.statementContext).toBe(true);
        expect(financialAnswer.evidence.analysisSource?.sha256).toBe(sha256);
        expect(financialAnswer.cognition.executedCapabilities).toEqual(
            expect.arrayContaining(["INTEGRITY_EVIDENCE", "FINANCIAL_INTELLIGENCE", "LIQUIDITY_LEVERAGE"]),
        );
        expect(financialAnswer.cognition.reasoning.status).toBe("EXECUTED");
        expect(financialAnswer.answer).toMatch(/[\u0600-\u06FF]/);
        expect(INTERNAL_LEAK.test(financialAnswer.answer)).toBe(false);
        expect(CONTEXT_LEAK.test(financialAnswer.answer)).toBe(false);
    });

    test("the canonical financial values reaching reasoning are unchanged by the platform-wide entry", () => {
        const call = observed.find((item) => item.problem === "تحلیل کامل صورت مالی را انجام بده");
        expect(call).toBeDefined();
        const financial = call!.data.FINANCIAL_INTELLIGENCE as Record<string, number>;
        expect(financial.revenue).toBe(CANONICAL_REVENUE);
        expect(financial.profit).toBe(CANONICAL_NET_PROFIT);
        expect(call!.data.profit).toBe(CANONICAL_NET_PROFIT);
    });

    test("memory and governed learning still flow for a tenant that has a real statement", () => {
        expect(financialAnswer.cognition.learning.promotedThisRequest).toMatch(/^learn-statement-integrity-reconciliation-v1-/);
        expect(actionAnswer.cognition.learning.retrievedCount).toBe(1);
        expect(actionAnswer.cognition.learning.activeVersions).toEqual([1]);
        expect(actionAnswer.cognition.learning.tenantId).toBe(actionAnswer.tenantId);

        // The learned artifact and the memory assertion reach reasoning as
        // low-confidence CONTEXT only; canonical values remain authoritative.
        const call = observed.find((item) => item.problem === "برای بهبود وضعیت چه اقداماتی پیشنهاد می‌شود؟");
        expect(call).toBeDefined();
        const memory = call!.knowledgeItems.filter((item) => item.source.startsWith("memory:"));
        const learning = call!.knowledgeItems.filter((item) => item.source.startsWith("learning:"));
        expect(memory.length).toBeGreaterThanOrEqual(1);
        expect(learning.length).toBe(1);
        for (const item of [...memory, ...learning]) {
            expect(item.confidence).toBe(0.5);
            expect(item.tenantId).toBe(actionAnswer.tenantId);
        }
        // Canonical facts are asserted exactly as the document states them.
        expect(memory[0].description).toContain(`"netProfit":${CANONICAL_NET_PROFIT}`);
        expect(memory[0].description).toContain(`"revenue":${CANONICAL_REVENUE}`);
        expect(memory[0].description).toContain(`"totalAssets":${CANONICAL_TOTAL_ASSETS}`);
        expect(memory[0].description).toContain(`"totalLiabilities":${CANONICAL_TOTAL_LIABILITIES}`);
    });

    test("a non-financial question inside a financially analysed tenant is served from that verified evidence", () => {
        expect(actionAnswer.cognition.intent.primary).toBe("ACTION");
        expect(actionAnswer.cognition.executedCapabilities).toContain("ACTION_FINDINGS");
        expect(actionAnswer.cognition.executedCapabilities).toContain("GOVERNANCE");
        // The decision matrix is genuinely absent, so it stays honestly absent.
        expect(actionAnswer.cognition.unavailableCapabilities.map((record) => record.capability)).toEqual(["DECISION_INTELLIGENCE"]);
        expect(actionAnswer.evidence.financialAnalysisAvailable).toBe(true);
        expect(actionAnswer.answer).toMatch(/[\u0600-\u06FF]/);
        expect(INTERNAL_LEAK.test(actionAnswer.answer)).toBe(false);
        expect(CONTEXT_LEAK.test(actionAnswer.answer)).toBe(false);
        expect(actionAnswer.answer).not.toContain(actionAnswer.tenantId);
    });
});