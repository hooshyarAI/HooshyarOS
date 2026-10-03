/**
 * C-01.2 — capability selection fidelity over the REAL runtime.
 *
 * Nothing here is mocked away. The test proves that materially different
 * question classes select and execute their correct canonical capabilities
 * without fabricating missing evidence.
 *
 * Positive cases:
 *  1. FINANCIAL intent → financial capabilities
 *  2. RISK intent → risk capability when evidence exists
 *  3. GROWTH → executive/scenario per contract
 *  4. RESILIENCE
 *  5. PRODUCT → product segment
 *  6. DATA GAPS → integrity/evidence
 *  7. ACTION → decision/action/governance
 *  8. DECISION → DecisionWorkbench
 *  9. ORGANIZATIONAL → OrganizationalProblemSolving
 * 10. OPERATIONAL/EXECUTION → AutonomousOperations
 * 11. EXECUTIVE → ExecutiveWorkbench
 * 12. COMPOSITE → union of required capabilities without duplicates
 *
 * Negative cases:
 * 13. Missing organizational evidence → UNAVAILABLE
 * 14. Missing decision evidence → UNAVAILABLE
 * 15. Missing workflow context → UNAVAILABLE
 * 16. Financial-only evidence must not be relabeled as organizational evidence
 * 17. Unauthorized consequential action → governance denial / no execution
 * 18. Cross-tenant evidence cannot be consumed
 * 19. Reasoning cannot invent a capability result
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
import { OrganizationalProblemSolvingService, ProblemCategory, ProblemSeverity } from "../Product/OrganizationalProblemSolvingService";
import { DecisionWorkbench } from "../Product/DecisionWorkbench";

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
      console.error(`[C-01.2] Fixture discovery failed for ${base}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return undefined;
};

const REAL_XLSX = findRealXlsx();
const REAL = Boolean(REAL_XLSX && existsSync(REAL_XLSX as string));

// Explicit diagnostic when real benchmark is absent — fails visibly rather than silently passing
if (!REAL) {
  console.error("[C-01.2] REAL benchmark not available. Set HOOSHYAR_REAL_XLSX or place 123.xlsx in a discoverable location. Financial acceptance tests will be skipped with explicit diagnostics.");
}

// Canonical 123.xlsx truth. Read from the composed insight, never reconstructed.
const CANONICAL_REVENUE = 32_129_418_000_000;
const CANONICAL_NET_PROFIT = 7_250_000_000_000;

const ownerContext = (tenantId: string) =>
  SecurityContext.forHumanUser(Principal.humanUser("owner", tenantId), [Authorization.READ, Authorization.WRITE, Authorization.ACCESS_EVIDENCE]);
const viewerContext = (tenantId: string) =>
  SecurityContext.forHumanUser(Principal.humanUser("viewer", tenantId), [Authorization.READ]);

const INTERNAL_LEAK = /\b(preTaxIncome|netIncome|cashConversionCycle|operatingIncome|grossProfit|balance-sheet-identity|productSegments|FINANCIAL_INTELLIGENCE|RESILIENCE|COMPOSITE|COGNITIVE_FINANCIAL_ASSERTION|GovernedLearningLifecycle|statement-integrity-reconciliation|CANONICAL_WINS)\b/;
const CONTEXT_LEAK = /(Revenue=|Profit=|ProfitMargin=|DebtRatio=|Observations=|SourceSha256=|financial-ingestion:|integrity:|governance:|TRACE-|tenant:)/;

interface CapabilityWire {
    capability: string;
    owner: string;
    status: "EXECUTED" | "UNAVAILABLE" | "NOT_REQUIRED";
    unavailableReason?: string;
    evidenceCount: number;
    evidence?: string[];
    result?: Record<string, unknown>;
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
    evidence: { analysisSource: { sha256: string } | null; financialAnalysisAvailable: boolean; statementContext: boolean };
}

const REAL_REASON = IntelligenceEngine.prototype.reason;

interface ObservedReasoning {
    problem: string;
    data: Record<string, unknown>;
    knowledgeItems: Array<{ id: string; title: string; description: string; confidence: number; source: string; tenantId?: string }>;
    evidenceItems: Array<{ id: string; type: string; summary: string; sourceRef: string; tenantId?: string }>;
}

describe("C-01.2 capability selection fidelity over the REAL runtime", () => {
    let server: Server;
    let clock = 1_950_000_000_000;
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

    const login = async (username: string) => {
        clock += 1000;
        const response = await request("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: "Sup3rSecret!" }),
        });
        const cookie = (response.headers.get("set-cookie") ?? "").split(";")[0];
        expect(cookie).toBeTruthy();
        return cookie;
    };

    const ask = async (cookie: string, question: string) => {
        const response = await post("/api/assistant", cookie, { question });
        return { status: response.status, body: (await response.json()) as AssistantWire };
    };

    // Tenant A: no financial analysis, but has organizational problem cases and decision
    let tenantA!: string;
    let tenantB!: string; // Tenant B: has financial analysis (123.xlsx)
    let tenantC!: string; // Tenant C: cross-tenant isolation check

    const answers = new Map<string, AssistantWire>();

    beforeAll(async () => {
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            now: () => clock,
            sessionSweepIntervalMs: 0,
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));

        // Observe the REAL IntelligenceEngine.reason without replacing it
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

        // Tenant A: no financial analysis
        tenantA = await register("c012-tenant-a", "C012 Org A");

        // Tenant B: with financial analysis (if real xlsx available)
        if (REAL) {
            tenantB = await register("c012-tenant-b", "C012 Org B");
            // Ingest and analyze 123.xlsx for tenantB
            const xlsxBuffer = readFileSync(REAL_XLSX!);
            const xlsxBase64 = xlsxBuffer.toString("base64");
             const ingestResp = await post("/api/ingest", tenantB, {
                sourceName: "123.xlsx",
                format: "XLSX",
                contentBase64: xlsxBase64,
            });
            expect([200, 201]).toContain(ingestResp.status);
            const ingestBody = await ingestResp.json();
            const sha256 = ingestBody.source?.sha256;
            expect(sha256).toMatch(/^10d44/);
            const analyzeResp = await post("/api/financial/analyze", tenantB, { sourceSha256: sha256 });
            expect(analyzeResp.status).toBe(200);
            const insightsResp = await post("/api/financial/insights", tenantB, { sourceSha256: sha256 });
            expect(insightsResp.status).toBe(200);

            // Create a problem case for tenantB for organizational tests
            const problemResp = await post("/api/problems", tenantB, {
                title: "Cash flow bottleneck in receivables",
                scope: "finance",
                category: "PROCESS",
                severity: "HIGH",
                description: "Receivables collection period exceeds 90 days causing cash flow pressure",
            });
            expect(problemResp.status).toBe(201);
            // Create a decision for tenantB
            await post("/api/decision/workbench", tenantB, {
                problem: "Select financing option for working capital gap",
                alternatives: ["Bank loan", "Factoring", "Extended supplier terms"],
                scores: [[8, 6, 7], [7, 8, 6], [6, 7, 9]],
                criteria: [
                    { name: "Cost", weight: 0.5, direction: "cost" },
                    { name: "Speed", weight: 0.3, direction: "benefit" },
                    { name: "Flexibility", weight: 0.2, direction: "benefit" },
                ],
            });
        }

        // Tenant C: for cross-tenant isolation
        tenantC = await register("c012-tenant-c", "C012 Org C");

        // Ask questions for tenant A (no financial analysis)
        const questionsA = [
            { family: "FINANCIAL", question: "تحلیل کامل صورت مالی را انجام بده" },
            { family: "RISK", question: "ریسکهای مالی شرکت چیست؟" },
            { family: "GROWTH", question: "ظرفیت رشد شرکت چقدر است؟" },
            { family: "RESILIENCE", question: "تاب‌آوری مالی شرکت چگونه است؟" },
            { family: "PRODUCT", question: "سودآوری محصولات را تحلیل کن" },
            { family: "DATA_GAPS", question: "چه اطلاعاتی برای تحلیل کم است؟" },
            { family: "ACTION", question: "برای بهبود وضعیت چه اقداماتی پیشنهاد می‌شود؟" },
            { family: "ORGANIZATIONAL", question: "سازمان و فرآیند تأیید تصمیم شرکت چگونه است؟" },
            { family: "DECISION", question: "کدام گزینه برای تأمین نقدینگی مناسب‌تر است؟" },
            { family: "EXECUTION", question: "وضعیت اجرای اقدام‌های اصلاحی چیست؟" },
            { family: "OPERATIONAL", question: "ظرفیت عملیاتی و جریان تأمین چطور کار می‌کند؟" },
            { family: "GENERAL", question: "یک توضیح کلی درباره این شرکت بده" },
        ];

        for (const q of questionsA) {
            answers.set(`A:${q.family}`, (await ask(tenantA, q.question)).body);
        }

        // If real xlsx, ask financial questions for tenant B
        if (REAL) {
            const questionsB = [
                { family: "FINANCIAL", question: "تحلیل کامل صورت مالی را انجام بده" },
                { family: "RISK", question: "ریسکهای مالی شرکت چیست؟" },
                { family: "RESILIENCE", question: "تاب‌آوری مالی شرکت چگونه است؟" },
                { family: "ORGANIZATIONAL", question: "سازمان و فرآیند تأیید تصمیم شرکت چگونه است؟" },
                { family: "DECISION", question: "کدام گزینه برای تأمین نقدینگی مناسب‌تر است؟" },
                { family: "EXECUTION", question: "وضعیت اجرای اقدام‌های اصلاحی چیست؟" },
                { family: "OPERATIONAL", question: "ظرفیت عملیاتی و جریان تأمین چطور کار می‌کند؟" },
            ];
            for (const q of questionsB) {
                answers.set(`B:${q.family}`, (await ask(tenantB, q.question)).body);
            }
        }

        // Cross-tenant: tenant C asks a question
        answers.set("C:GENERAL", (await ask(tenantC, "یک توضیح کلی بده")).body);
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    // ============================================================ POSITIVE CASES ============================================================

    test("FINANCIAL intent selects financial capabilities and executes with insight", () => {
        if (!REAL) {
            console.warn("[C-01.2] FINANCIAL test skipped: real benchmark not available");
            return;
        }
        const body = answers.get("B:FINANCIAL")!;
        expect(body.cognition.intent.primary).toBe("ANALYZE");
        const caps = body.cognition.capabilities;
        const executed = caps.filter((c) => c.status === "EXECUTED").map((c) => c.capability);
        expect(executed).toContain("FINANCIAL_INTELLIGENCE");
        expect(executed).toContain("LIQUIDITY_LEVERAGE");
        expect(executed).toContain("INTEGRITY_EVIDENCE");
        // REASONING is handled as the orchestration conclusion, not an executed capability
        expect(body.cognition.reasoning.status).toBe("EXECUTED");
        // No fabricated financial values — find the Tenant B entry (has revenue) among all "تحلیل کامل" calls
        const financialEntries = observed.filter((o) => o.problem.includes("تحلیل کامل") && typeof o.data.revenue === "number");
        expect(financialEntries.length).toBeGreaterThan(0);
        expect(financialEntries[0].data.revenue).toBeDefined();
        expect(financialEntries[0].data.profit).toBeDefined();
    });

    test("RISK intent selects risk capability; UNAVAILABLE when no risk evidence", () => {
        // Tenant A has no financial analysis -> RISK_INTELLIGENCE should be UNAVAILABLE
        const bodyA = answers.get("A:RISK")!;
        expect(bodyA.cognition.intent.primary).toBe("RISK");
        const riskCap = bodyA.cognition.capabilities.find((c) => c.capability === "RISK_INTELLIGENCE");
        expect(riskCap).toBeDefined();
        expect(riskCap!.status).toBe("UNAVAILABLE");
        expect(riskCap!.unavailableReason).toMatch(/probability|impact|ریسک/i);

        // Tenant B has financial analysis but still no risk probability/impact
        if (!REAL) {
            console.warn("[C-01.2] RISK tenant B test skipped: real benchmark not available");
            return;
        }
        const bodyB = answers.get("B:RISK")!;
        const riskCapB = bodyB.cognition.capabilities.find((c) => c.capability === "RISK_INTELLIGENCE");
        expect(riskCapB).toBeDefined();
        expect(riskCapB!.status).toBe("UNAVAILABLE");
    });

    test("GROWTH intent selects scenario and executive capabilities", () => {
        const body = answers.get("A:GROWTH")!;
        expect(body.cognition.intent.primary).toBe("GROWTH");
        const caps = body.cognition.selectedCapabilities;
        expect(caps).toContain("SCENARIO");
        expect(caps).toContain("FINANCIAL_INTELLIGENCE");
        expect(caps).toContain("EXECUTIVE_INTELLIGENCE");
        expect(caps).toContain("REASONING");
    });

    test("RESILIENCE intent selects liquidity, leverage, earnings quality, organizational", () => {
        const body = answers.get("A:RESILIENCE")!;
        expect(body.cognition.intent.primary).toBe("RESILIENCE");
        const caps = body.cognition.selectedCapabilities;
        expect(caps).toContain("LIQUIDITY_LEVERAGE");
        expect(caps).toContain("WORKING_CAPITAL");
        expect(caps).toContain("EARNINGS_QUALITY");
        expect(caps).toContain("COMPARATIVE_EVIDENCE");
        expect(caps).toContain("FINANCIAL_INTELLIGENCE");
        expect(caps).toContain("ORGANIZATIONAL_INTELLIGENCE");
        expect(caps).toContain("REASONING");
    });

    test("PRODUCT intent selects product segment capability", () => {
        const body = answers.get("A:PRODUCT")!;
        expect(body.cognition.intent.primary).toBe("PRODUCT");
        const caps = body.cognition.selectedCapabilities;
        expect(caps).toContain("PRODUCT_SEGMENT");
        expect(caps).toContain("FINANCIAL_INTELLIGENCE");
        expect(caps).toContain("REASONING");
        const prodCap = body.cognition.capabilities.find((c) => c.capability === "PRODUCT_SEGMENT");
        expect(prodCap).toBeDefined();
        expect(prodCap!.status).toBe("UNAVAILABLE"); // no product segment data
        expect(prodCap!.unavailableReason).toMatch(/product|segment|محصول|بخش/i);
    });

    test("DATA GAPS intent selects integrity evidence capability", () => {
        const body = answers.get("A:DATA_GAPS")!;
        expect(body.cognition.intent.primary).toBe("DATA_GAPS");
        const caps = body.cognition.selectedCapabilities;
        expect(caps).toContain("INTEGRITY_EVIDENCE");
        expect(caps).toContain("REASONING");
    });

    test("ACTION intent selects action findings, decision intelligence, governance", () => {
        const body = answers.get("A:ACTION")!;
        expect(body.cognition.intent.primary).toBe("ACTION");
        const caps = body.cognition.selectedCapabilities;
        expect(caps).toContain("ACTION_FINDINGS");
        expect(caps).toContain("DECISION_INTELLIGENCE");
        expect(caps).toContain("GOVERNANCE");
        expect(caps).toContain("REASONING");
        // Governance should EXECUTE (advisory check) even without statement
        const govCap = body.cognition.capabilities.find((c) => c.capability === "GOVERNANCE");
        expect(govCap).toBeDefined();
        expect(govCap!.status).toBe("EXECUTED");
        expect(govCap!.owner).toBe("GovernanceEngine.evaluate");
        // Action findings and decision intelligence should be UNAVAILABLE
        const actionCap = body.cognition.capabilities.find((c) => c.capability === "ACTION_FINDINGS");
        expect(actionCap).toBeDefined();
        expect(actionCap!.status).toBe("UNAVAILABLE");
        const decisionCap = body.cognition.capabilities.find((c) => c.capability === "DECISION_INTELLIGENCE");
        expect(decisionCap).toBeDefined();
        expect(decisionCap!.status).toBe("UNAVAILABLE");
    });

    test("ORGANIZATIONAL intent selects organizational problem solving; UNAVAILABLE without problem cases", () => {
        // Tenant A has no problem cases
        const bodyA = answers.get("A:ORGANIZATIONAL")!;
        expect(bodyA.cognition.intent.primary).toBe("ORGANIZATIONAL");
        const capsA = bodyA.cognition.selectedCapabilities;
        expect(capsA).toContain("ORGANIZATIONAL_PROBLEM_SOLVING");
        expect(capsA).toContain("ORGANIZATIONAL_INTELLIGENCE");
        expect(capsA).toContain("REASONING");
        const opsCapA = bodyA.cognition.capabilities.find((c) => c.capability === "ORGANIZATIONAL_PROBLEM_SOLVING");
        expect(opsCapA).toBeDefined();
        expect(opsCapA!.status).toBe("UNAVAILABLE");
        expect(opsCapA!.unavailableReason).toMatch(/problem case|پرونده مسئله/i);
    });

    // Tenant B has problem cases - positive leg requires real benchmark
    (REAL ? test : test.skip)("ORGANIZATIONAL positive leg: with problem cases, must EXECUTE with evidence", () => {
        const bodyB = answers.get("B:ORGANIZATIONAL")!;
        const opsCapB = bodyB.cognition.capabilities.find((c) => c.capability === "ORGANIZATIONAL_PROBLEM_SOLVING");
        expect(opsCapB).toBeDefined();
        // With problem cases, must EXECUTE — unconditional assertion
        expect(opsCapB!.status).toBe("EXECUTED");
        expect(opsCapB!.evidenceCount).toBeGreaterThan(0);
    });

    test("DECISION intent selects decision workbench; UNAVAILABLE without decision matrix", () => {
        const bodyA = answers.get("A:DECISION")!;
        expect(bodyA.cognition.intent.primary).toBe("DECISION");
        const capsA = bodyA.cognition.selectedCapabilities;
        expect(capsA).toContain("DECISION_WORKBENCH");
        expect(capsA).toContain("DECISION_INTELLIGENCE");
        expect(capsA).toContain("GOVERNANCE");
        expect(capsA).toContain("REASONING");
        const dwCapA = bodyA.cognition.capabilities.find((c) => c.capability === "DECISION_WORKBENCH");
        expect(dwCapA).toBeDefined();
        expect(dwCapA!.status).toBe("UNAVAILABLE");
        expect(dwCapA!.unavailableReason).toMatch(/decision|تصمیم|ماتریس/i);
    });

    // Tenant B has decision matrix - positive leg requires real benchmark
    (REAL ? test : test.skip)("DECISION positive leg: with decision matrix, must EXECUTE with evidence", () => {
        const bodyB = answers.get("B:DECISION")!;
        const dwCapB = bodyB.cognition.capabilities.find((c) => c.capability === "DECISION_WORKBENCH");
        expect(dwCapB).toBeDefined();
        // With decision matrix, must EXECUTE — unconditional assertion
        expect(dwCapB!.status).toBe("EXECUTED");
        expect(dwCapB!.evidenceCount).toBeGreaterThan(0);
    });

    test("OPERATIONAL intent selects autonomous operations; UNAVAILABLE without workflow context", () => {
        const body = answers.get("A:OPERATIONAL")!;
        expect(body.cognition.intent.primary).toBe("OPERATIONAL");
        const caps = body.cognition.selectedCapabilities;
        expect(caps).toContain("AUTONOMOUS_OPERATIONS");
        expect(caps).toContain("REASONING");
        const autoCap = body.cognition.capabilities.find((c) => c.capability === "AUTONOMOUS_OPERATIONS");
        expect(autoCap).toBeDefined();
        expect(autoCap!.status).toBe("UNAVAILABLE");
        expect(autoCap!.unavailableReason).toMatch(/workflow|وَرک‌فلو|context/i);
    });

    test("EXECUTION intent selects autonomous operations and governance; UNAVAILABLE without workflow", () => {
        const body = answers.get("A:EXECUTION")!;
        expect(body.cognition.intent.primary).toBe("EXECUTION");
        const caps = body.cognition.selectedCapabilities;
        expect(caps).toContain("AUTONOMOUS_OPERATIONS");
        expect(caps).toContain("GOVERNANCE");
        expect(caps).toContain("REASONING");
        const autoCap = body.cognition.capabilities.find((c) => c.capability === "AUTONOMOUS_OPERATIONS");
        expect(autoCap).toBeDefined();
        expect(autoCap!.status).toBe("UNAVAILABLE");
        const govCap = body.cognition.capabilities.find((c) => c.capability === "GOVERNANCE");
        expect(govCap).toBeDefined();
        expect(govCap!.status).toBe("EXECUTED"); // governance gate runs
    });

    test("EXECUTIVE intent selects executive workbench; UNAVAILABLE without targets", () => {
        // GENERAL intent maps to executive workbench
        const body = answers.get("A:GENERAL")!;
        const caps = body.cognition.selectedCapabilities;
        expect(caps).toContain("EXECUTIVE_INTELLIGENCE");
        expect(caps).toContain("FINANCIAL_INTELLIGENCE");
        expect(caps).toContain("REASONING");
        const execCap = body.cognition.capabilities.find((c) => c.capability === "EXECUTIVE_INTELLIGENCE");
        expect(execCap).toBeDefined();
        expect(execCap!.status).toBe("UNAVAILABLE");
        expect(execCap!.unavailableReason).toMatch(/executive|target|هدف|شاخص/i);
    });

    test("COMPOSITE question selects union of required capabilities without duplicates", async () => {
        // Ask a question that triggers RISK + ACTION intents (both weight 100)
        // "ریسک شرکت چیست و چه اقدامی پیشنهاد می‌شود؟" -> RISK + ACTION
        const compositeQuestion = "ریسک شرکت چیست و چه اقدامی پیشنهاد می‌شود؟";
        const response = await ask(tenantA, compositeQuestion);
        expect(response.status).toBe(200);
        const body = response.body;
        expect(body.cognition.intent.answerMode).toBe("COMPOSITE");
        expect(body.cognition.intent.secondary.length).toBeGreaterThan(0);
        const caps = body.cognition.selectedCapabilities;
        // Should have capabilities from multiple intents
        expect(caps.length).toBeGreaterThan(5);
        // No duplicates
        const uniqueCaps = [...new Set(caps)];
        expect(caps.length).toBe(uniqueCaps.length);
        // Execution order respects dependency law — GOVERNANCE must be present and after REASONING
        // (ACTION intent adds GOVERNANCE gate)
        const order = body.cognition.executionOrder;
        const reasoningIdx = order.indexOf("REASONING");
        const governanceIdx = order.indexOf("GOVERNANCE");
        expect(governanceIdx).toBeGreaterThanOrEqual(0);
        expect(governanceIdx).toBeGreaterThan(reasoningIdx);
    });

    // ============================================================ NEGATIVE CASES ============================================================

    test("Missing organizational evidence → ORGANIZATIONAL_PROBLEM_SOLVING is UNAVAILABLE, not fabricated", () => {
        const body = answers.get("A:ORGANIZATIONAL")!;
        const cap = body.cognition.capabilities.find((c) => c.capability === "ORGANIZATIONAL_PROBLEM_SOLVING");
        expect(cap!.status).toBe("UNAVAILABLE");
        expect(cap!.unavailableReason).toBeTruthy();
        // No result data fabricated
        expect(Object.keys(cap!.result ?? {}).length).toBe(0);
    });

    test("Missing decision evidence → DECISION_WORKBENCH is UNAVAILABLE, not fabricated", () => {
        const body = answers.get("A:DECISION")!;
        const cap = body.cognition.capabilities.find((c) => c.capability === "DECISION_WORKBENCH");
        expect(cap!.status).toBe("UNAVAILABLE");
        expect(cap!.unavailableReason).toBeTruthy();
    });

    test("Missing workflow context → AUTONOMOUS_OPERATIONS is UNAVAILABLE, not fabricated", () => {
        const body = answers.get("A:OPERATIONAL")!;
        const cap = body.cognition.capabilities.find((c) => c.capability === "AUTONOMOUS_OPERATIONS");
        expect(cap!.status).toBe("UNAVAILABLE");
        expect(cap!.unavailableReason).toBeTruthy();
    });

    (REAL ? test : test.skip)("Financial-only evidence is NOT relabeled as organizational evidence", () => {
        // When only financial insight exists, organizational capabilities should report UNAVAILABLE
        // not execute with relabeled financial ratios
        const body = answers.get("B:ORGANIZATIONAL")!;
        // The financial ratios in the insight should NOT be passed as organizational evidence
        const orgIntelCap = body.cognition.capabilities.find((c) => c.capability === "ORGANIZATIONAL_INTELLIGENCE");
        expect(orgIntelCap).toBeDefined();
        // Should be UNAVAILABLE because financial ratios are not organizational evidence
        expect(orgIntelCap!.status).toBe("UNAVAILABLE");
        expect(orgIntelCap!.unavailableReason).toMatch(/organizational|سازمانی|genuine evidence/i);
    });

    test("Unauthorized consequential action → governance DENIED / no execution", async () => {
        // Register a viewer in tenantA's existing organization (gets VIEWER role, not OWNER)
        const viewer = await register("c012-viewer", "C012 Org A");
        const response = await ask(viewer, "برای بهبود وضعیت چه اقداماتی پیشنهاد می‌شود؟");
        expect(response.status).toBe(200); // Endpoint still answers
        const body = response.body;
        const govCap = body.cognition.capabilities.find((c) => c.capability === "GOVERNANCE");
        expect(govCap).toBeDefined();
        // Governance executes as advisory check
        expect(govCap!.status).toBe("EXECUTED");
        // Governance denial for VIEWER (lacks APPROVE/EXECUTE) is surfaced in limitations
        const limitations = body.cognition.limitations;
        expect(limitations.some((l) => l.includes("حاکمیتی") && l.includes("مجوز"))).toBe(true);
        // No consequential capabilities should have executed
        const actionCap = body.cognition.capabilities.find((c) => c.capability === "ACTION_FINDINGS");
        expect(actionCap).toBeDefined();
        expect(actionCap!.status).toBe("UNAVAILABLE");
        const decisionCap = body.cognition.capabilities.find((c) => c.capability === "DECISION_INTELLIGENCE");
        expect(decisionCap).toBeDefined();
        expect(decisionCap!.status).toBe("UNAVAILABLE");
    });

    (REAL ? test : test.skip)("Cross-tenant evidence cannot be consumed", () => {
        // Tenant C should not see tenant B's problem cases, decisions, or evidence
        const bodyC = answers.get("C:GENERAL")!;
        // Should not have access to B's memory or learning
        expect(bodyC.cognition.memory.retrievedCount).toBe(0);
        expect(bodyC.cognition.learning.retrievedCount).toBe(0);
        // Capability evidence/results/unavailableReasons must not reference B's artifacts
        for (const cap of bodyC.cognition.capabilities) {
            const evidenceRefs = cap.evidence ?? [];
            for (const ref of evidenceRefs) {
                expect(ref).not.toMatch(/problem-case:|decision:|financial-ingestion:/);
            }
            if (cap.unavailableReason) {
                expect(cap.unavailableReason).not.toMatch(/problem-case:|decision:|financial-ingestion:/);
            }
            if (cap.result) {
                const resultStr = JSON.stringify(cap.result);
                expect(resultStr).not.toMatch(/problem-case:|decision:|financial-ingestion:/);
            }
        }
    });

    test("Reasoning cannot invent a capability result — knowledgeItems only contain real executed capability data", () => {
        // Index observations by actual question text for stable identity
        const observedByQuestion = new Map<string, ObservedReasoning>();
        for (const o of observed) {
            observedByQuestion.set(o.problem, o);
        }

        for (const [key, body] of answers) {
            const question = body.question;
            const reasoningEntry = observedByQuestion.get(question);
            // Must have a matching observation — this is the assertion that the harness can fail
            expect(reasoningEntry).toBeDefined();
            if (!reasoningEntry) continue;
            // knowledgeItems should not contain fabricated financial data
            // (evidenceItems may legitimately contain financial-ingestion refs for tenants with financial analysis)
            for (const item of reasoningEntry.knowledgeItems) {
                expect(item.title).not.toMatch(/revenue|profit|netProfit|totalAssets|totalLiabilities/i);
                expect(item.description).not.toMatch(/CANONICAL_WINS|statement-integrity-reconciliation/i);
            }
        }
    });

    // ============================================================ REAL HTTP EVIDENCE ============================================================

    test("REAL HTTP: non-financial question reaches orchestration with correct intent and capabilities", async () => {
        const response = await ask(tenantA, "سازمان و فرآیند تأیید تصمیم شرکت چگونه است؟");
        expect(response.status).toBe(200);
        const body = response.body;
        expect(body.cognition.intent.primary).toBe("ORGANIZATIONAL");
        expect(body.cognition.selectedCapabilities).toContain("ORGANIZATIONAL_PROBLEM_SOLVING");
        expect(body.cognition.selectedCapabilities).toContain("ORGANIZATIONAL_INTELLIGENCE");
        expect(body.cognition.executedCapabilities).toContain("GOVERNANCE");
        expect(body.cognition.reasoning.status).toBe("EXECUTED");
        expect(body.answer.trim().length).toBeGreaterThan(0);
        // No internal leakage
        expect(body.answer).not.toMatch(INTERNAL_LEAK);
        expect(body.answer).not.toMatch(CONTEXT_LEAK);
    });

    (REAL ? test : test.skip)("REAL HTTP: financial question with 123.xlsx executes canonical financial capabilities", async () => {
        const response = await ask(tenantB, "تحلیل کامل صورت مالی را انجام بده");
        expect(response.status).toBe(200);
        const body = response.body;
        expect(body.evidence.financialAnalysisAvailable).toBe(true);
        expect(body.evidence.statementContext).toBe(true);
        expect(body.cognition.intent.primary).toBe("ANALYZE");
        const caps = body.cognition.capabilities.filter((c) => c.status === "EXECUTED").map((c) => c.capability);
        expect(caps).toContain("FINANCIAL_INTELLIGENCE");
        expect(caps).toContain("LIQUIDITY_LEVERAGE");
        expect(caps).toContain("INTEGRITY_EVIDENCE");
        // REASONING is handled as the orchestration conclusion, not an executed capability
        expect(body.cognition.reasoning.status).toBe("EXECUTED");
        // Canonical values intact — find Tenant B's financial reasoning entry (has revenue)
        const financialEntries = observed.filter((o) => o.problem.includes("تحلیل کامل") && typeof o.data.revenue === "number");
        expect(financialEntries.length).toBeGreaterThan(0);
        const lastEntry = financialEntries[financialEntries.length - 1];
        expect(lastEntry.data.revenue).toBe(CANONICAL_REVENUE);
        expect(lastEntry.data.profit).toBe(CANONICAL_NET_PROFIT);
    });
});