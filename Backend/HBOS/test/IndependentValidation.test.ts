/**
 * Focused tests for the two-path independent validation primitives.
 * Proves honest agreement/disagreement and that a missing path is never
 * converted into a false confirmation.
 */
import {
  validateDual,
  fromReconciliation,
  summarizeDualValidations,
  type ValidationPath,
} from "../Product/IndependentValidation";
import type { StatementIntegrityCheck } from "../Product/FinancialStatementInsight";

function path(id: string, value: number | null, method: string, basis = method): ValidationPath {
  return { id, method, value, basis, evidence: [] };
}

function check(
  id: string,
  status: StatementIntegrityCheck["status"],
  expected: number | null,
  actual: number | null,
): StatementIntegrityCheck {
  return {
    id,
    description: id,
    status,
    expected,
    actual,
    difference: expected !== null && actual !== null ? expected - actual : null,
    missing: status === "NOT_TESTABLE" ? ["assets"] : [],
  };
}

describe("IndependentValidation (two-path)", () => {
  test("agreement when both paths produce the same value", () => {
    const outcome = validateDual("net-profit", path("A", 150, "canonical-calculation"), path("B", 150, "reconciliation-identity"));
    expect(outcome.status).toBe("AGREEMENT");
    expect(outcome.agreement).toBe(true);
    expect(outcome.requiredReview).toBe(false);
    expect(outcome.magnitude).toBe("NONE");
    expect(outcome.confidenceLimitation).toBe("");
  });

  test("disagreement surfaces magnitude, scope, cause, limitation and review", () => {
    const outcome = validateDual(
      "cash-flow-net",
      path("A", 1000, "canonical-calculation"),
      path("B", 700, "cross-source"),
      { scope: "cash-flow", possibleCauses: ["timing differences"] },
    );
    expect(outcome.status).toBe("DISAGREEMENT");
    expect(outcome.agreement).toBe(false);
    expect(outcome.requiredReview).toBe(true);
    expect(outcome.magnitude).toBe("MATERIAL");
    expect(outcome.absoluteDifference).toBe(300);
    expect(outcome.scope).toBe("cash-flow");
    expect(outcome.possibleCauses).toContain("timing differences");
    expect(outcome.confidenceLimitation).toContain("must not be presented as independently confirmed");
  });

  test("tolerance controls agreement boundaries", () => {
    const tight = validateDual("x", path("A", 100, "calc"), path("B", 100.5, "control"), { tolerance: 0.1 });
    const loose = validateDual("x", path("A", 100, "calc"), path("B", 100.5, "control"), { tolerance: 1 });
    expect(tight.status).toBe("DISAGREEMENT");
    expect(loose.status).toBe("AGREEMENT");
  });

  test("non-finite path values are NOT_TESTABLE, never agreement", () => {
    const outcome = validateDual("revenue", path("A", 1000, "calc"), path("B", null, "control"));
    expect(outcome.status).toBe("NOT_TESTABLE");
    expect(outcome.agreement).toBe(false);
    expect(outcome.requiredReview).toBe(true);
    expect(outcome.confidenceLimitation).toContain("agreement cannot be claimed");
  });

  test("relative difference is null when the canonical value is zero and the other is not", () => {
    const outcome = validateDual("x", path("A", 0, "calc"), path("B", 5, "control"));
    expect(outcome.absoluteDifference).toBe(5);
    expect(outcome.relativeDifference).toBeNull();
    expect(outcome.magnitude).toBe("UNKNOWN");
  });

  test("fromReconciliation builds a genuinely independent PATH B from a reconciled identity", () => {
    const outcome = fromReconciliation("balance-sheet", 1000, [
      check("balance-sheet-identity", "RECONCILED", 1000, 1000),
    ]);
    expect(outcome.status).toBe("AGREEMENT");
    expect(outcome.pathA.method).toBe("canonical-calculation");
    expect(outcome.pathB.method).toBe("reconciliation-identity");
  });

  test("fromReconciliation surfaces an accounting mismatch as disagreement", () => {
    const outcome = fromReconciliation("balance-sheet", 900, [
      check("balance-sheet-identity", "MISMATCH", 1000, 900),
    ]);
    expect(outcome.status).toBe("DISAGREEMENT");
    expect(outcome.pathA.value).toBe(900);
    expect(outcome.pathB.value).toBe(1000);
    expect(outcome.requiredReview).toBe(true);
  });

  test("fromReconciliation with only not-testable checks stays NOT_TESTABLE", () => {
    const outcome = fromReconciliation("cash-flow", 1000, [
      check("cash-flow-reconciliation", "NOT_TESTABLE", null, null),
    ]);
    expect(outcome.status).toBe("NOT_TESTABLE");
    expect(outcome.pathB.value).toBeNull();
    expect(outcome.confidenceLimitation).toContain("no accounting identity could be tested");
  });

  test("summary never converts missing evidence into confirmation", () => {
    const outcomes = [
      validateDual("a", path("A", 1, "calc"), path("B", 1, "control")),
      validateDual("b", path("A", 1, "calc"), path("B", 2, "control")),
      validateDual("c", path("A", 1, "calc"), path("B", null, "control")),
    ];
    const summary = summarizeDualValidations(outcomes);
    expect(summary.total).toBe(3);
    expect(summary.agreements).toBe(1);
    expect(summary.disagreements).toBe(1);
    expect(summary.notTestable).toBe(1);
    expect(summary.allConfirmed).toBe(false);
    expect(summary.requiredReviews).toEqual(["b", "c"]);
  });

  test("summary confirms only when every subject has two agreeing paths", () => {
    const outcomes = [
      validateDual("a", path("A", 1, "calc"), path("B", 1, "control")),
      validateDual("b", path("A", 2, "calc"), path("B", 2, "control")),
    ];
    expect(summarizeDualValidations(outcomes).allConfirmed).toBe(true);
    expect(summarizeDualValidations([]).allConfirmed).toBe(false);
  });
});
