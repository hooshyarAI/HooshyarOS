/**
 * B-04 — tenant-safe cognitive memory.
 *
 * Proves the negative tenant-safety contract (A–E), the fail-closed retrieval
 * and ownership rules, the memory provenance surface, and that cognitive
 * orchestration consumes tenant-scoped memory WITHOUT letting it override fresh
 * canonical evidence.
 */
import {
  MemoryEngine,
  MemoryOwnershipRequiredError,
  MemoryTenantRequiredError,
  MemoryTenantConflictError,
  MEMORY_SYSTEM_SCOPE,
} from "../Core/MemoryEngine";
import { MemoryEvent } from "../Entities/MemoryEvent";
import {
  CognitiveOrchestrationService,
  COGNITIVE_MEMORY_ASSERTION_TYPE,
} from "../Product/CognitiveOrchestrationService";
import { composeFinancialStatementInsight } from "../Product/FinancialStatementInsight";
import {
  deriveAnalysisInput,
  derivePriorStatement,
  type FinancialDocumentUnderstanding,
  type FinancialStatementFact,
} from "../Product/FinancialDocumentUnderstanding";
import { FinancialAnalyticsService } from "../Product/FinancialAnalyticsService";

const TENANT_A = "tenant-memory-a";
const TENANT_B = "tenant-memory-b";

const fact = (
  measure: FinancialStatementFact["measure"],
  value: number,
  periodIndex = 0,
  section: FinancialStatementFact["section"] = "INCOME_STATEMENT",
): FinancialStatementFact => ({
  measure, section, label: measure,
  periodLabel: periodIndex === 0 ? "دوره جاری" : "دوره قبل",
  periodIndex, rawValue: value, value: value * 1_000_000,
  unitMultiplier: 1_000_000, currency: "IRR", confidence: 1,
  evidence: { line: 1, text: `${measure}=${value}` },
});

const buildInsight = (facts: readonly FinancialStatementFact[]) => {
  const document: FinancialDocumentUnderstanding = {
    status: "PARTIAL", currency: "IRR", unitMultiplier: 1_000_000, sections: [], facts: [...facts],
  };
  const derived = deriveAnalysisInput(document);
  const prior = derivePriorStatement(document);
  const analytics = new FinancialAnalyticsService().execute({
    tenantId: TENANT_A, statement: derived.statement, priorStatement: prior,
  });
  return composeFinancialStatementInsight({ document, derived, prior, analytics });
};

const HEALTHY_FACTS: readonly FinancialStatementFact[] = [
  fact("REVENUE", 32_129),
  fact("COGS", -27_093),
  fact("GROSS_PROFIT", 5_036),
  fact("OPERATING_EXPENSES", -291),
  fact("OPERATING_PROFIT", 4_708),
  fact("NET_PROFIT", 7_250),
  fact("CURRENT_ASSETS", 31_107, 0, "BALANCE_SHEET"),
  fact("ASSETS", 32_244, 0, "BALANCE_SHEET"),
  fact("CURRENT_LIABILITIES", 17_279, 0, "BALANCE_SHEET"),
  fact("LIABILITIES", 17_407, 0, "BALANCE_SHEET"),
  fact("EQUITY", 14_836, 0, "BALANCE_SHEET"),
  fact("CASH", 5_000, 0, "BALANCE_SHEET"),
  fact("RECEIVABLES", 12_000, 0, "BALANCE_SHEET"),
  fact("INVENTORY", 9_000, 0, "BALANCE_SHEET"),
  fact("PAYABLES", 8_000, 0, "BALANCE_SHEET"),
  fact("REVENUE", 16_527, 1),
  fact("NET_PROFIT", 3_319, 1),
  fact("OPERATING_CASH_FLOW", 4_100, 0, "CASH_FLOW_STATEMENT"),
  fact("NET_CASH_FLOW", 3_900, 0, "CASH_FLOW_STATEMENT"),
];

const divergentMemoryEvent = (value: number, tenantId: string) =>
  new MemoryEvent(
    COGNITIVE_MEMORY_ASSERTION_TYPE,
    JSON.stringify({ netProfit: value }),
    "test-memory",
    tenantId,
    { observedAt: new Date(), traceId: "TRACE-MEMORY-HISTORY", evidenceRef: "test-evidence:prior", validity: "ACTIVE" },
  );

describe("B-04 tenant-safe canonical MemoryEngine", () => {
  test("A) tenant A memory is never returned to tenant B", () => {
    const memory = new MemoryEngine();
    memory.store(new MemoryEvent("EVENT", "tenant-a-private", "src-a", TENANT_A));

    expect(memory.retrieve(TENANT_A)).toHaveLength(1);
    expect(memory.retrieve(TENANT_B)).toHaveLength(0);
  });

  test("B) tenant B cannot retrieve tenant A memory even when query text matches", () => {
    const memory = new MemoryEngine();
    memory.store(new MemoryEvent("EVENT", "shared-query-text", "src-a", TENANT_A));

    const bMatches = memory.retrieve(TENANT_B).filter((event) => event.data === "shared-query-text");
    expect(bMatches).toHaveLength(0);
  });

  test("C) retrieval without tenant context fails closed", () => {
    const memory = new MemoryEngine();
    memory.store(new MemoryEvent("EVENT", "private", "src-a", TENANT_A));

    expect(() => memory.retrieve()).toThrow(MemoryTenantRequiredError);
    expect(() => memory.retrieve("   ")).toThrow(MemoryTenantRequiredError);
  });

  test("D) storing without ownership fails closed unless a trusted tenantId is supplied", () => {
    const memory = new MemoryEngine();

    expect(() => memory.store(new MemoryEvent("EVENT", "unowned", "src"))).toThrow(MemoryOwnershipRequiredError);

    const owned = new MemoryEvent("EVENT", "owned-by-caller", "src");
    memory.store(owned, TENANT_A);
    expect(memory.retrieve(TENANT_A)).toHaveLength(1);

    const conflicting = new MemoryEvent("EVENT", "conflicting", "src", TENANT_A);
    expect(() => memory.store(conflicting, TENANT_B)).toThrow(MemoryTenantConflictError);
  });

  test("E) memory from one source/trace cannot contaminate another tenant", () => {
    const memory = new MemoryEngine();
    memory.store(
      new MemoryEvent("EVENT", "trace-a-data", "source-a", TENANT_A, { traceId: "TRACE-A", evidenceRef: "evidence-a" }),
    );

    expect(memory.retrieve(TENANT_B)).toHaveLength(0);
    const aEvents = memory.retrieve(TENANT_A);
    expect(aEvents).toHaveLength(1);
    expect(aEvents[0].traceId).toBe("TRACE-A");
    expect(aEvents[0].evidenceRef).toBe("evidence-a");
  });

  test("system memory is isolated from every tenant and only reachable by its reserved scope", () => {
    const memory = new MemoryEngine();
    memory.store(new MemoryEvent("SYSTEM_READY", "boot", "HBOS"), MEMORY_SYSTEM_SCOPE);

    expect(memory.retrieve(TENANT_A)).toHaveLength(0);
    expect(memory.retrieve(TENANT_B)).toHaveLength(0);
    expect(memory.retrieve(MEMORY_SYSTEM_SCOPE)).toHaveLength(1);
  });
});

describe("B-04 cognitive memory participates in orchestration without overriding canonical evidence", () => {
  const service = (memory: MemoryEngine) =>
    new CognitiveOrchestrationService(undefined, undefined, undefined, undefined, memory);

  const QUESTION = "این صورت مالی را تحلیل کن";

  test("tenant-scoped memory is actually retrieved and reported with provenance", () => {
    const memory = new MemoryEngine();
    const insight = buildInsight(HEALTHY_FACTS);
    const canonical = insight.metrics.netProfit as number;
    memory.store(divergentMemoryEvent(canonical + Math.max(1_000_000, Math.abs(canonical)), TENANT_A));

    const result = service(memory).orchestrate({ tenantId: TENANT_A, question: QUESTION, insight });

    expect(result.memory.retrievalOccurred).toBe(true);
    expect(result.memory.tenantId).toBe(TENANT_A);
    expect(result.memory.retrievedCount).toBe(1);
    expect(result.memory.references).toHaveLength(1);
    expect(result.memory.traceId).toBe(result.traceId);
    expect(result.memory.authoritativeSource).toBe("CURRENT_CANONICAL_EVIDENCE");
    // Memory informed the reasoning context.
    expect(result.reasoning.steps.some((step) => /knowledge/i.test(step))).toBe(true);
  });

  test("memory does not leak across tenants during orchestration", () => {
    const memory = new MemoryEngine();
    const insight = buildInsight(HEALTHY_FACTS);
    const canonical = insight.metrics.netProfit as number;
    memory.store(divergentMemoryEvent(canonical + 9_999_999, TENANT_A));

    const other = service(memory).orchestrate({ tenantId: TENANT_B, question: QUESTION, insight });

    expect(other.memory.retrievalOccurred).toBe(true);
    expect(other.memory.tenantId).toBe(TENANT_B);
    expect(other.memory.retrievedCount).toBe(0);
    expect(other.memory.conflicts).toHaveLength(0);
    expect(other.contradictions).toHaveLength(0);
  });

  test("orchestration without a tenant scope does not retrieve global memory", () => {
    const memory = new MemoryEngine();
    memory.store(new MemoryEvent("EVENT", "tenant-a-private", "src-a", TENANT_A));
    const insight = buildInsight(HEALTHY_FACTS);

    const result = service(memory).orchestrate({ tenantId: "", question: QUESTION, insight });

    expect(result.memory.retrievalOccurred).toBe(false);
    expect(result.memory.retrievedCount).toBe(0);
    expect(result.memory.tenantId).toBeNull();
  });

  test("a divergent memory is surfaced as CANONICAL_WINS and preserved as historical context", () => {
    const memory = new MemoryEngine();
    const insight = buildInsight(HEALTHY_FACTS);
    const canonical = insight.metrics.netProfit as number;
    const memoryValue = canonical + Math.max(1_000_000, Math.abs(canonical));
    memory.store(divergentMemoryEvent(memoryValue, TENANT_A));

    const before = insight.metrics.netProfit;
    const result = service(memory).orchestrate({ tenantId: TENANT_A, question: QUESTION, insight });

    const conflict = result.memory.conflicts.find((item) => item.subject === "netProfit");
    expect(conflict).toBeTruthy();
    expect(conflict?.canonicalValue).toBe(canonical);
    expect(conflict?.memoryValue).toBe(memoryValue);
    expect(conflict?.resolution).toBe("CANONICAL_WINS");

    // The disagreement is also surfaced on the standard contradiction channel.
    const contradiction = result.contradictions.find((item) => item.subject === "netProfit");
    expect(contradiction?.resolution).toBe("CANONICAL_WINS");
    expect(contradiction?.canonicalValue).toBe(canonical);

    // Canonical evidence was not mutated and the memory is preserved.
    expect(insight.metrics.netProfit).toBe(before);
    expect(memory.retrieve(TENANT_A)).toHaveLength(1);
  });

  test("fresh canonical evidence outranks memory: identical financial output with and without memory", () => {
    const insight = buildInsight(HEALTHY_FACTS);
    const canonical = insight.metrics.netProfit as number;

    const withoutMemory = service(new MemoryEngine()).orchestrate({ tenantId: TENANT_A, question: QUESTION, insight });

    const memory = new MemoryEngine();
    memory.store(divergentMemoryEvent(canonical + 555_555_555, TENANT_A));
    const withMemory = service(memory).orchestrate({ tenantId: TENANT_A, question: QUESTION, insight });

    const financialOf = (result: typeof withoutMemory) =>
      result.executed.find((entry) => entry.capability === "FINANCIAL_INTELLIGENCE");

    expect(financialOf(withMemory)?.status).toBe("EXECUTED");
    expect(financialOf(withMemory)?.result).toEqual(financialOf(withoutMemory)?.result);
  });
});
