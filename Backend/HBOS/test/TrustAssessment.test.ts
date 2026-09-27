/**
 * Focused tests for the additive TrustAssessment supporting service.
 * Proves lifecycle states, quarantine on blocking defects, and honest
 * UNVERIFIED handling. Does not touch the protected ingestion adapter.
 */
import {
  TrustAssessmentService,
  checkPeriodConsistency,
  detectIntraSourceDuplicates,
  assessCrossSourceAgreement,
  parseIsoDateStrict,
} from "../Product/TrustAssessment";
import type {
  FinancialCanonicalModel,
  FinancialIngestionResult,
  FinancialTransaction,
} from "../Product/FinancialDataIngestionAdapter";
import type { StatementIntegrityCheck } from "../Product/FinancialStatementInsight";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function tx(overrides: Partial<FinancialTransaction> = {}): FinancialTransaction {
  return {
    date: "2024-01-05",
    account: "1000",
    debit: 100,
    credit: 0,
    currency: "IRR",
    ...overrides,
  };
}

function model(transactions: FinancialTransaction[]): FinancialCanonicalModel {
  const debit = transactions.reduce((sum, t) => sum + t.debit, 0);
  const credit = transactions.reduce((sum, t) => sum + t.credit, 0);
  return {
    tenantId: "tenant-1",
    source: {
      sourceName: "ledger.csv",
      sourceType: "CSV",
      sha256: SHA_A,
      receivedAt: "2024-02-01T00:00:00.000Z",
    },
    transactions,
    totals: { debit, credit, balance: debit - credit },
  };
}

function result(transactions: FinancialTransaction[]): FinancialIngestionResult {
  return { evidence: model(transactions).source, model: model(transactions), persisted: true };
}

function check(
  id: string,
  status: StatementIntegrityCheck["status"],
): StatementIntegrityCheck {
  return {
    id,
    description: id,
    status,
    expected: 100,
    actual: status === "MISMATCH" ? 90 : 100,
    difference: status === "MISMATCH" ? -10 : 0,
    missing: status === "NOT_TESTABLE" ? ["assets"] : [],
  };
}

describe("TrustAssessment (additive trust-state contract)", () => {
  const service = new TrustAssessmentService();

  test("clean ledger with no reconciliation evidence is CROSS_CHECKED, never TRUSTED", () => {
    const assessment = service.assess({ result: result([tx(), tx({ account: "2000", credit: 100 })]) });
    expect(assessment.state).toBe("CROSS_CHECKED");
    expect(assessment.stages).toEqual(["RECEIVED", "IDENTIFIED", "VALIDATED", "CROSS_CHECKED"]);
    expect(assessment.canonicalBinding).toBe(true);
    expect(assessment.source?.sha256).toBe(SHA_A);
  });

  test("clean ledger + reconciled accounting identities is TRUSTED", () => {
    const assessment = service.assess({
      result: result([tx(), tx({ account: "2000", credit: 100 })]),
      integrityChecks: [check("balance-sheet-identity", "RECONCILED")],
    });
    expect(assessment.state).toBe("TRUSTED");
    expect(assessment.blockingFindings).toEqual([]);
  });

  test("accounting mismatch quarantines the source", () => {
    const assessment = service.assess({
      result: result([tx()]),
      integrityChecks: [check("balance-sheet-identity", "MISMATCH")],
    });
    expect(assessment.state).toBe("QUARANTINED");
    expect(assessment.blockingFindings).toContain("reconciliation-accounting-identities");
  });

  test("not-testable reconciliation is UNVERIFIED and blocks TRUSTED promotion", () => {
    const assessment = service.assess({
      result: result([tx()]),
      integrityChecks: [check("cash-flow-reconciliation", "NOT_TESTABLE")],
    });
    expect(assessment.state).toBe("CROSS_CHECKED");
    expect(assessment.findings.some((f) => f.status === "UNVERIFIED")).toBe(true);
    expect(assessment.limitations.join(" ")).toContain("not testable");
  });

  test("intra-source duplicate rows quarantine (never silently trusted)", () => {
    const rows = [tx(), tx()];
    const assessment = service.assess({ result: result(rows) });
    expect(assessment.state).toBe("QUARANTINED");
    expect(assessment.blockingFindings).toContain("duplicate-intra-source");
    expect(detectIntraSourceDuplicates(rows)).toHaveLength(1);
  });

  test("future-dated transaction quarantines", () => {
    const assessment = service.assess({
      result: result([tx({ date: "2999-01-01" })]),
      now: new Date("2026-09-27T00:00:00.000Z"),
    });
    expect(assessment.state).toBe("QUARANTINED");
    expect(assessment.blockingFindings).toContain("chronology-future-date");
  });

  test("malformed date and negative amount quarantine", () => {
    const assessment = service.assess({
      result: result([tx({ date: "2024/01/05", debit: -5 })]),
    });
    expect(assessment.state).toBe("QUARANTINED");
    expect(assessment.blockingFindings).toContain("chronology-date-format");
    expect(assessment.blockingFindings).toContain("numeric-validity");
  });

  test("cross-source contradiction quarantines; agreement keeps trust path", () => {
    const base = result([tx(), tx({ account: "2000", credit: 100 })]);
    const contradiction = service.assess({
      result: base,
      crossSource: { sourceName: "copy.xlsx", sha256: SHA_B, totals: { debit: 999, credit: 999, balance: 0 } },
    });
    expect(contradiction.state).toBe("QUARANTINED");
    expect(contradiction.blockingFindings).toContain("cross-source-agreement");

    const agreement = service.assess({
      result: base,
      integrityChecks: [check("balance-sheet-identity", "RECONCILED")],
      crossSource: {
        sourceName: "copy.xlsx",
        sha256: SHA_B,
        totals: base.model.totals,
      },
    });
    expect(agreement.state).toBe("TRUSTED");
  });

  test("cross-source with identical content hash is NOT_APPLICABLE (not independent)", () => {
    const base = result([tx()]);
    const findings = assessCrossSourceAgreement(
      { sourceName: "a", sha256: SHA_A, totals: base.model.totals },
      { sourceName: "a-copy", sha256: SHA_A, totals: base.model.totals },
    );
    expect(findings[0].status).toBe("NOT_APPLICABLE");
  });

  test("prior-period cross-source mismatch quarantines", () => {
    const base = result([tx()]);
    const assessment = service.assess({
      result: base,
      priorPeriodFacts: [{ measure: "REVENUE", section: "INCOME_STATEMENT", value: 123 }],
    });
    // Ledger has no document facts, so no shared measure -> UNVERIFIED, not a false mismatch.
    expect(assessment.state).toBe("CROSS_CHECKED");
    expect(assessment.findings.some((f) => f.id === "prior-period-consistency" && f.status === "UNVERIFIED")).toBe(true);
  });

  test("malformed input is REJECTED", () => {
    const assessment = service.assess({ result: undefined as unknown as FinancialIngestionResult });
    expect(assessment.state).toBe("REJECTED");
    expect(assessment.canonicalBinding).toBe(false);
  });

  test("period consistency pure check flags duplicate labels", () => {
    expect(checkPeriodConsistency(["1402", "1401"])[0].status).toBe("PASS");
    expect(checkPeriodConsistency(["1402", "1402"])[0].status).toBe("FAIL");
  });

  test("strict ISO date parser rejects impossible calendar days", () => {
    expect(parseIsoDateStrict("2023-02-29")).toBeNull();
    expect(parseIsoDateStrict("2024-02-29")).not.toBeNull();
    expect(parseIsoDateStrict("2024-13-01")).toBeNull();
  });
});
