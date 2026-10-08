/**
 * product.independent-validation — reusable two-path validation primitives.
 *
 * This is a COMPOSITION module, not an Engine and not a competing calculation
 * owner. It arranges two genuinely distinguishable validation paths around an
 * already-produced result and reports agreement or disagreement honestly:
 *
 *   PATH A — canonical domain engine / source-grounded calculation
 *   PATH B — independent reconciliation / control / alternate identity /
 *            cross-source validation / secondary validator
 *
 * It never manufactures confidence. When the paths disagree it surfaces the
 * affected result, the magnitude, the likely scope, possible causes, the
 * confidence limitation and whether human review is required. When a path
 * cannot run it reports NOT_TESTABLE rather than pretending agreement.
 *
 * Financial reconciliation is NOT re-implemented here: callers pass the
 * existing `StatementIntegrityCheck` output (from the canonical
 * `FinancialStatementInsight`) as PATH B via `fromReconciliation`.
 */
import type { StatementIntegrityCheck } from "./FinancialStatementInsight";

export type DualValidationStatus = "AGREEMENT" | "DISAGREEMENT" | "NOT_TESTABLE";
export type DisagreementMagnitude = "NONE" | "MINOR" | "MATERIAL" | "UNKNOWN";

export interface ValidationPath {
  /** "A" for the canonical path, "B" for the independent path, or descriptive. */
  readonly id: string;
  /** Machine-readable method, e.g. canonical-calculation, reconciliation-identity, cross-source. */
  readonly method: string;
  readonly value: number | null;
  /** What the value is grounded in (formula, identity, source). */
  readonly basis: string;
  readonly evidence: readonly string[];
}

export interface DualValidationOptions {
  /** Absolute tolerance for agreement. Defaults to 0.01 (currency minor unit). */
  readonly tolerance?: number;
  readonly scope?: string;
  readonly possibleCauses?: readonly string[];
  /** Relative magnitude threshold above which a difference is MATERIAL. Default 0.05. */
  readonly materialityThreshold?: number;
}

export interface DualValidationOutcome {
  readonly subject: string;
  readonly status: DualValidationStatus;
  readonly agreement: boolean;
  readonly pathA: ValidationPath;
  readonly pathB: ValidationPath;
  readonly tolerance: number;
  readonly absoluteDifference: number | null;
  readonly relativeDifference: number | null;
  readonly magnitude: DisagreementMagnitude;
  readonly scope: string;
  readonly possibleCauses: readonly string[];
  readonly confidenceLimitation: string;
  readonly requiredReview: boolean;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function magnitudeOf(
  absoluteDifference: number,
  relativeDifference: number | null,
  materialityThreshold: number,
): DisagreementMagnitude {
  if (absoluteDifference === 0) return "NONE";
  if (relativeDifference === null) return "UNKNOWN";
  const relative = Math.abs(relativeDifference);
  return relative <= materialityThreshold ? "MINOR" : "MATERIAL";
}

/**
 * Compare two validation paths for the same subject. Values that are not
 * finite are NOT_TESTABLE, never a silent agreement.
 */
export function validateDual(
  subject: string,
  pathA: ValidationPath,
  pathB: ValidationPath,
  options: DualValidationOptions = {},
): DualValidationOutcome {
  const tolerance = typeof options.tolerance === "number" && options.tolerance >= 0
    ? options.tolerance
    : 0.01;
  const materialityThreshold = typeof options.materialityThreshold === "number" && options.materialityThreshold > 0
    ? options.materialityThreshold
    : 0.05;
  const scope = options.scope ?? subject;
  const possibleCauses = options.possibleCauses ?? [];

  const a = finiteOrNull(pathA.value);
  const b = finiteOrNull(pathB.value);
  if (a === null || b === null) {
    return {
      subject,
      status: "NOT_TESTABLE",
      agreement: false,
      pathA,
      pathB,
      tolerance,
      absoluteDifference: null,
      relativeDifference: null,
      magnitude: "UNKNOWN",
      scope,
      possibleCauses,
      confidenceLimitation:
        "one or both validation paths produced no finite value; agreement cannot be claimed",
      requiredReview: true,
    };
  }

  const absoluteDifference = Math.abs(a - b);
  const relativeDifference = a === 0 ? (b === 0 ? 0 : null) : (a - b) / Math.abs(a);
  const agreement = absoluteDifference <= tolerance;

  return {
    subject,
    status: agreement ? "AGREEMENT" : "DISAGREEMENT",
    agreement,
    pathA,
    pathB,
    tolerance,
    absoluteDifference,
    relativeDifference,
    magnitude: magnitudeOf(absoluteDifference, relativeDifference, materialityThreshold),
    scope,
    possibleCauses: agreement ? [] : possibleCauses,
    confidenceLimitation: agreement
      ? ""
      : "paths disagree; the result must not be presented as independently confirmed",
    requiredReview: !agreement,
  };
}

/**
 * Build PATH B from the canonical accounting-identity reconciliation output.
 * PATH A is the canonical calculated value; PATH B is the identity's expected
 * value. This makes the two paths genuinely independent (calculation vs.
 * accounting identity), not the same formula twice.
 */
export function fromReconciliation(
  subject: string,
  pathAValue: number | null,
  checks: readonly StatementIntegrityCheck[],
  options: DualValidationOptions = {},
): DualValidationOutcome {
  const pathA: ValidationPath = {
    id: "A",
    method: "canonical-calculation",
    value: finiteOrNull(pathAValue),
    basis: "canonical domain engine output",
    evidence: [`subject=${subject}`],
  };

  const testable = (checks ?? []).filter(
    (check) => check.status === "RECONCILED" || check.status === "MISMATCH",
  );
  const mismatch = testable.find((check) => check.status === "MISMATCH");

  if (testable.length === 0) {
    return {
      subject,
      status: "NOT_TESTABLE",
      agreement: false,
      pathA,
      pathB: {
        id: "B",
        method: "reconciliation-identity",
        value: null,
        basis: "accounting identity not testable",
        evidence: (checks ?? []).map((check) => `${check.id}=${check.status}`),
      },
      tolerance: options.tolerance ?? 0.01,
      absoluteDifference: null,
      relativeDifference: null,
      magnitude: "UNKNOWN",
      scope: options.scope ?? subject,
      possibleCauses: [],
      confidenceLimitation:
        "no accounting identity could be tested against the canonical value",
      requiredReview: true,
    };
  }

  const identity = mismatch ?? testable[0];
  const expected = finiteOrNull(identity.expected);
  const actual = finiteOrNull(identity.actual);
  const pathB: ValidationPath = {
    id: "B",
    method: "reconciliation-identity",
    value: mismatch ? expected : (actual ?? expected),
    basis: `accounting identity ${identity.id} (${identity.status})`,
    evidence: [
      `expected=${identity.expected}`,
      `actual=${identity.actual}`,
      `difference=${identity.difference}`,
      ...identity.missing.map((item) => `missing=${item}`),
    ],
  };

  return validateDual(subject, pathA, pathB, {
    ...options,
    possibleCauses: options.possibleCauses ?? [
      "extraction error in one of the statement lines",
      "unit or sign mismatch between sections",
      "incomplete statement where a required line was not extracted",
    ],
  });
}

export interface DualValidationSummary {
  readonly total: number;
  readonly agreements: number;
  readonly disagreements: number;
  readonly notTestable: number;
  readonly materialDisagreements: readonly string[];
  readonly requiredReviews: readonly string[];
  readonly allConfirmed: boolean;
}

/** Aggregate several dual validations without turning any gap into a pass. */
export function summarizeDualValidations(
  outcomes: readonly DualValidationOutcome[],
): DualValidationSummary {
  const agreements = outcomes.filter((outcome) => outcome.status === "AGREEMENT");
  const disagreements = outcomes.filter((outcome) => outcome.status === "DISAGREEMENT");
  const notTestable = outcomes.filter((outcome) => outcome.status === "NOT_TESTABLE");
  return {
    total: outcomes.length,
    agreements: agreements.length,
    disagreements: disagreements.length,
    notTestable: notTestable.length,
    materialDisagreements: disagreements
      .filter((outcome) => outcome.magnitude === "MATERIAL")
      .map((outcome) => outcome.subject),
    requiredReviews: outcomes.filter((outcome) => outcome.requiredReview).map((outcome) => outcome.subject),
    allConfirmed:
      outcomes.length > 0 &&
      agreements.length === outcomes.length,
  };
}
