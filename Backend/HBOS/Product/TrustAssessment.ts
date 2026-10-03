/**
 * product.trust-assessment — additive trust-state assessment over an
 * already-produced canonical ingestion result.
 *
 * This is a PURITY-LAYER SUPPORTING SERVICE, not a new Engine and not a
 * second ingestion adapter. It consumes an accepted `FinancialIngestionResult`
 * (canonical output of the protected `FinancialDataIngestionAdapter`) plus any
 * reconciliation / cross-source evidence a caller already holds, and returns an
 * explicit trust lifecycle:
 *
 *   RECEIVED -> IDENTIFIED -> VALIDATED -> CROSS_CHECKED -> RECONCILED -> TRUSTED
 *                                                          \-> QUARANTINED
 *                                                          \-> REJECTED
 *
 * It deliberately does NOT modify `FinancialDataIngestionAdapter.ts`, its
 * schema, or any canonical calculation. Injecting a trust field into the frozen
 * canonical model remains REQUIRES_ARCHITECTURE_CHANGE_CONTROL; this service is
 * an additive consumer a caller may invoke without changing the canonical path.
 *
 * Honesty rules enforced here:
 *   - A finding is only PASS when its evidence was actually checked.
 *   - Absent evidence is reported UNVERIFIED, never silently promoted to trust.
 *   - QUARANTINED is used for blocking defects (identity, numeric, chronology,
 *     duplicate rows, accounting mismatch, cross-source contradiction).
 *   - This service never fabricates a check that did not run.
 */
import type {
  FinancialCanonicalModel,
  FinancialIngestionResult,
  FinancialTransaction,
} from "./FinancialDataIngestionAdapter";
import type { StatementIntegrityCheck } from "./FinancialStatementInsight";

export type TrustState =
  | "RECEIVED"
  | "IDENTIFIED"
  | "VALIDATED"
  | "CROSS_CHECKED"
  | "RECONCILED"
  | "TRUSTED"
  | "QUARANTINED"
  | "REJECTED";

export type TrustFindingStatus = "PASS" | "FAIL" | "UNVERIFIED" | "NOT_APPLICABLE";
export type TrustFindingSeverity = "BLOCKING" | "ADVISORY";
export type TrustFindingCategory =
  | "IDENTITY"
  | "STRUCTURE"
  | "PROVENANCE"
  | "NUMERIC"
  | "CHRONOLOGY"
  | "DUPLICATE"
  | "RECONCILIATION"
  | "CROSS_SOURCE";

export interface TrustFinding {
  readonly id: string;
  readonly category: TrustFindingCategory;
  readonly status: TrustFindingStatus;
  readonly severity: TrustFindingSeverity;
  readonly evidence: readonly string[];
  readonly limitation?: string;
}

/** Minimal cross-source input: the totals + identity of another canonical source. */
export interface CrossSourceTotals {
  readonly sourceName: string;
  readonly sha256: string;
  readonly totals: { readonly debit: number; readonly credit: number; readonly balance: number };
}

export interface TrustAssessmentInput {
  readonly result: FinancialIngestionResult;
  /** Accounting-identity checks, typically from `FinancialStatementInsight.integrity`. */
  readonly integrityChecks?: readonly StatementIntegrityCheck[];
  /** A second independently ingested source to cross-check totals against. */
  readonly crossSource?: CrossSourceTotals;
  /** Statement facts from a prior ingested source for cross-source period consistency. */
  readonly priorPeriodFacts?: readonly PeriodFact[];
  /**
   * Tolerance for cross-source numeric comparisons. Defaults to an absolute
   * 0.01 (currency minor-unit) so exact agreement is required unless the caller
   * deliberately widens it with a documented rationale.
   */
  readonly crossSourceTolerance?: number;
  /** Injectable clock for deterministic chronology tests. */
  readonly now?: Date;
}

/** Fact shape accepted for cross-source prior-period comparison. */
export interface PeriodFact {
  readonly measure: string;
  readonly section: string;
  readonly value: number;
}

export interface TrustAssessment {
  readonly state: TrustState;
  /** Ordered lifecycle stages actually reached (never a stage with no evidence). */
  readonly stages: readonly TrustState[];
  readonly findings: readonly TrustFinding[];
  readonly blockingFindings: readonly string[];
  readonly limitations: readonly string[];
  /** The canonical source identity the assessment is bound to, or null. */
  readonly source: {
    readonly sourceName: string;
    readonly sourceType: string;
    readonly sha256: string;
  } | null;
  /** True because this assessment is produced from a canonical ingestion result. */
  readonly canonicalBinding: boolean;
}

/** Strict ISO calendar date `YYYY-MM-DD` with a real calendar day. */
export function parseIsoDateStrict(value: string): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function statusOf(
  id: string,
  category: TrustFindingCategory,
  status: TrustFindingStatus,
  severity: TrustFindingSeverity,
  evidence: readonly string[],
  limitation?: string,
): TrustFinding {
  return { id, category, status, severity, evidence, limitation };
}

/** Identity/provenance: source name + sha256 + source type must be present and real. */
export function checkSourceIdentity(model: FinancialCanonicalModel): TrustFinding[] {
  const source = model?.source;
  const findings: TrustFinding[] = [];

  const identityEvidence: string[] = [];
  let identityOk = true;
  if (!source || typeof source.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(source.sha256)) {
    identityOk = false;
    identityEvidence.push("source.sha256 missing or not a 64-hex-char digest");
  } else {
    identityEvidence.push(`sha256=${source.sha256}`);
  }
  if (!source || typeof source.sourceName !== "string" || !source.sourceName.trim()) {
    identityOk = false;
    identityEvidence.push("source.sourceName missing");
  }
  if (!source || typeof source.sourceType !== "string" || !source.sourceType.trim()) {
    identityOk = false;
    identityEvidence.push("source.sourceType missing");
  }
  findings.push(
    statusOf(
      "identity-source",
      "IDENTITY",
      identityOk ? "PASS" : "FAIL",
      "BLOCKING",
      identityEvidence,
    ),
  );

  if (source?.receivedAt) {
    const receivedOk = !Number.isNaN(Date.parse(source.receivedAt));
    findings.push(
      statusOf(
        "provenance-received-at",
        "PROVENANCE",
        receivedOk ? "PASS" : "FAIL",
        "BLOCKING",
        [`receivedAt=${source.receivedAt}`],
      ),
    );
  } else {
    findings.push(
      statusOf("provenance-received-at", "PROVENANCE", "UNVERIFIED", "ADVISORY", [
        "source.receivedAt absent",
      ]),
    );
  }

  return findings;
}

/** Numeric validity of canonical ledger totals and every transaction amount. */
export function checkNumericValidity(model: FinancialCanonicalModel): TrustFinding[] {
  const findings: TrustFinding[] = [];
  const bad: string[] = [];

  const totals = model?.totals;
  for (const [key, value] of Object.entries({
    debit: totals?.debit,
    credit: totals?.credit,
    balance: totals?.balance,
  })) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      bad.push(`totals.${key} not finite`);
    }
  }

  const transactions = model?.transactions ?? [];
  transactions.forEach((tx, index) => {
    if (typeof tx.debit !== "number" || !Number.isFinite(tx.debit) || tx.debit < 0) {
      bad.push(`transactions[${index}].debit invalid`);
    }
    if (typeof tx.credit !== "number" || !Number.isFinite(tx.credit) || tx.credit < 0) {
      bad.push(`transactions[${index}].credit invalid`);
    }
  });

  findings.push(
    statusOf(
      "numeric-validity",
      "NUMERIC",
      bad.length === 0 ? "PASS" : "FAIL",
      "BLOCKING",
      bad.length === 0 ? [`${transactions.length} transactions finite`] : bad.slice(0, 20),
    ),
  );
  return findings;
}

/** Chronology: every ledger row date must be a real calendar day and not in the future. */
export function checkTransactionChronology(
  transactions: readonly FinancialTransaction[],
  now: Date = new Date(),
): TrustFinding[] {
  const findings: TrustFinding[] = [];
  const badDates: string[] = [];
  const futureDates: string[] = [];
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  transactions.forEach((tx, index) => {
    const parsed = parseIsoDateStrict(tx?.date);
    if (!parsed) {
      badDates.push(`transactions[${index}].date=${JSON.stringify(tx?.date)} not a valid ISO date`);
      return;
    }
    if (parsed.getTime() > horizon.getTime()) {
      futureDates.push(`transactions[${index}].date=${tx.date} is after ${horizon.toISOString()}`);
    }
  });

  findings.push(
    statusOf(
      "chronology-date-format",
      "CHRONOLOGY",
      badDates.length === 0 ? "PASS" : "FAIL",
      "BLOCKING",
      badDates.length === 0 ? [`${transactions.length} dates well-formed`] : badDates.slice(0, 20),
    ),
  );
  findings.push(
    statusOf(
      "chronology-future-date",
      "CHRONOLOGY",
      futureDates.length === 0 ? "PASS" : "FAIL",
      "BLOCKING",
      futureDates.length === 0 ? ["no future-dated rows"] : futureDates.slice(0, 20),
    ),
  );
  return findings;
}

export interface DuplicateGroup {
  readonly key: string;
  readonly count: number;
  readonly indices: readonly number[];
}

/**
 * Intra-source duplicate ledger rows: identical (date, account, debit, credit,
 * currency). Exact duplicates can legitimately occur, so the finding carries an
 * explicit limitation — but it is BLOCKING (quarantine for review) rather than
 * silently trusted, because duplicates can double-count.
 */
export function detectIntraSourceDuplicates(
  transactions: readonly FinancialTransaction[],
): DuplicateGroup[] {
  const groups = new Map<string, number[]>();
  transactions.forEach((tx, index) => {
    const key = [
      tx?.date ?? "",
      (tx?.account ?? "").trim(),
      tx?.debit ?? "",
      tx?.credit ?? "",
      (tx?.currency ?? "").trim(),
    ].join("|");
    const list = groups.get(key);
    if (list) list.push(index);
    else groups.set(key, [index]);
  });
  const duplicates: DuplicateGroup[] = [];
  for (const [key, indices] of groups) {
    if (indices.length > 1) duplicates.push({ key, count: indices.length, indices });
  }
  return duplicates.sort((a, b) => b.count - a.count);
}

/** Document period consistency: period labels within a statement must be distinct. */
export function checkPeriodConsistency(
  periodLabels: readonly string[],
): TrustFinding[] {
  const normalized = periodLabels.map((label) => (label ?? "").trim());
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const label of normalized) {
    if (!label) continue;
    if (seen.has(label)) duplicates.push(label);
    seen.add(label);
  }
  return [
    statusOf(
      "chronology-period-distinct",
      "CHRONOLOGY",
      duplicates.length === 0 ? "PASS" : "FAIL",
      "BLOCKING",
      duplicates.length === 0
        ? [`${seen.size} distinct period label(s)`]
        : duplicates.map((label) => `duplicate period label "${label}"`),
    ),
  ];
}

/** Accounting-identity reconciliation findings derived from existing insight output. */
export function assessReconciliation(
  checks: readonly StatementIntegrityCheck[],
): TrustFinding[] {
  if (!checks || checks.length === 0) {
    return [
      statusOf("reconciliation-accounting-identities", "RECONCILIATION", "NOT_APPLICABLE", "ADVISORY", [
        "no accounting-identity checks supplied (e.g. ledger-only source)",
      ]),
    ];
  }
  const mismatches = checks.filter((check) => check.status === "MISMATCH");
  const reconciled = checks.filter((check) => check.status === "RECONCILED");
  const untestable = checks.filter((check) => check.status === "NOT_TESTABLE");

  const findings: TrustFinding[] = [];
  findings.push(
    statusOf(
      "reconciliation-accounting-identities",
      "RECONCILIATION",
      mismatches.length > 0 ? "FAIL" : reconciled.length > 0 ? "PASS" : "UNVERIFIED",
      "BLOCKING",
      mismatches.length > 0
        ? mismatches.map(
            (check) => `${check.id}: expected=${check.expected} actual=${check.actual} diff=${check.difference}`,
          )
        : reconciled.map((check) => `${check.id}=RECONCILED`),
      untestable.length > 0
        ? `not testable: ${untestable.map((check) => check.id).join(", ")}`
        : undefined,
    ),
  );
  return findings;
}

/** Cross-source contradiction / agreement over two independently ingested sources. */
export function assessCrossSourceAgreement(
  subject: CrossSourceTotals,
  other: CrossSourceTotals,
  tolerance = 0.01,
): TrustFinding[] {
  const findings: TrustFinding[] = [];
  if (!other) {
    return [
      statusOf("cross-source-agreement", "CROSS_SOURCE", "NOT_APPLICABLE", "ADVISORY", [
        "no comparison source supplied",
      ]),
    ];
  }
  if (subject.sha256 === other.sha256) {
    return [
      statusOf("cross-source-agreement", "CROSS_SOURCE", "NOT_APPLICABLE", "ADVISORY", [
        "comparison source has identical content hash (same source, not independent)",
      ]),
    ];
  }

  const keys: readonly (keyof CrossSourceTotals["totals"])[] = ["debit", "credit", "balance"];
  const contradictions: string[] = [];
  const agreements: string[] = [];
  for (const key of keys) {
    const a = subject.totals?.[key];
    const b = other.totals?.[key];
    if (typeof a !== "number" || typeof b !== "number" || !Number.isFinite(a) || !Number.isFinite(b)) {
      findings.push(
        statusOf(
          `cross-source-${key}`,
          "CROSS_SOURCE",
          "UNVERIFIED",
          "ADVISORY",
          [`${key}: comparable values absent`],
        ),
      );
      continue;
    }
    const difference = Math.abs(a - b);
    if (difference <= tolerance) {
      agreements.push(`${key}: ${a}≈${b}`);
    } else {
      contradictions.push(`${key}: ${subject.sourceName}=${a} vs ${other.sourceName}=${b} (Δ=${difference})`);
    }
  }

  findings.push(
    statusOf(
      "cross-source-agreement",
      "CROSS_SOURCE",
      contradictions.length > 0 ? "FAIL" : "PASS",
      "BLOCKING",
      contradictions.length > 0 ? contradictions : agreements,
      contradictions.length > 0
        ? "independent sources disagree; do not present either as trusted without review"
        : undefined,
    ),
  );
  return findings;
}

/**
 * Cross-source prior-period consistency: facts from the current source are
 * matched to facts from a prior ingested source by (section, measure) and
 * compared within tolerance.
 */
export function assessPriorPeriodConsistency(
  currentFacts: readonly PeriodFact[],
  priorFacts: readonly PeriodFact[],
  tolerance = 0.01,
): TrustFinding[] {
  if (!priorFacts || priorFacts.length === 0) {
    return [
      statusOf("prior-period-consistency", "CROSS_SOURCE", "NOT_APPLICABLE", "ADVISORY", [
        "no prior-period source supplied",
      ]),
    ];
  }
  const priorIndex = new Map<string, number>();
  for (const fact of priorFacts) {
    priorIndex.set(`${fact.section}::${fact.measure}`, fact.value);
  }
  const compared: string[] = [];
  const mismatches: string[] = [];
  for (const fact of currentFacts) {
    const key = `${fact.section}::${fact.measure}`;
    if (!priorIndex.has(key)) continue;
    const prior = priorIndex.get(key) as number;
    const difference = Math.abs(fact.value - prior);
    if (difference <= tolerance) compared.push(`${key} agreed`);
    else mismatches.push(`${key}: current=${fact.value} prior=${prior} (Δ=${difference})`);
  }
  if (compared.length === 0 && mismatches.length === 0) {
    return [
      statusOf("prior-period-consistency", "CROSS_SOURCE", "UNVERIFIED", "ADVISORY", [
        "no shared (section, measure) between current and prior source",
      ]),
    ];
  }
  return [
    statusOf(
      "prior-period-consistency",
      "CROSS_SOURCE",
      mismatches.length > 0 ? "FAIL" : "PASS",
      "BLOCKING",
      mismatches.length > 0 ? mismatches : compared,
    ),
  ];
}

/**
 * The additive trust assessment service. It never mutates the canonical result
 * and never throws for a defect it can report as a finding (only truly absent
 * input is REJECTED).
 */
export class TrustAssessmentService {
  assess(input: TrustAssessmentInput): TrustAssessment {
    const result = input?.result;
    const model = result?.model;

    if (!result || !model || !Array.isArray(model.transactions)) {
      return {
        state: "REJECTED",
        stages: [],
        findings: [
          statusOf("structure-canonical-result", "STRUCTURE", "FAIL", "BLOCKING", [
            "canonical ingestion result/model absent or malformed",
          ]),
        ],
        blockingFindings: ["structure-canonical-result"],
        limitations: ["no canonical result to assess"],
        source: null,
        canonicalBinding: false,
      };
    }

    const now = input.now ?? new Date();
    const transactions = model.transactions;

    const findings: TrustFinding[] = [];
    findings.push(...checkSourceIdentity(model));
    findings.push(
      statusOf("structure-ledger", "STRUCTURE", "PASS", "ADVISORY", [
        `${transactions.length} canonical transaction(s) present`,
      ]),
    );
    findings.push(...checkNumericValidity(model));
    findings.push(...checkTransactionChronology(transactions, now));

    const duplicates = detectIntraSourceDuplicates(transactions);
    findings.push(
      statusOf(
        "duplicate-intra-source",
        "DUPLICATE",
        duplicates.length > 0 ? "FAIL" : "PASS",
        "BLOCKING",
        duplicates.length > 0
          ? duplicates.map((group) => `×${group.count} identical at rows [${group.indices.join(",")}]`)
          : ["no exact duplicate ledger rows"],
        duplicates.length > 0
          ? "identical ledger rows can be legitimate; quarantined for human review rather than silently trusted"
          : undefined,
      ),
    );

    const periodLabels =
      model.document?.facts?.map((fact) => fact.periodLabel) ??
      [];
    if (model.document) {
      findings.push(...checkPeriodConsistency(periodLabels));
    }

    if (input.integrityChecks !== undefined) {
      findings.push(...assessReconciliation(input.integrityChecks));
    }
    if (input.crossSource !== undefined) {
      findings.push(
        ...assessCrossSourceAgreement(
          {
            sourceName: model.source.sourceName,
            sha256: model.source.sha256,
            totals: model.totals,
          },
          input.crossSource,
          input.crossSourceTolerance,
        ),
      );
    }
    if (input.priorPeriodFacts !== undefined) {
      const currentFacts: PeriodFact[] =
        model.document?.facts?.map((fact) => ({
          measure: fact.measure,
          section: fact.section,
          value: fact.value,
        })) ?? [];
      findings.push(
        ...assessPriorPeriodConsistency(
          currentFacts,
          input.priorPeriodFacts,
          input.crossSourceTolerance,
        ),
      );
    }

    const blockingFindings = findings
      .filter((finding) => finding.status === "FAIL" && finding.severity === "BLOCKING")
      .map((finding) => finding.id);

    let state: TrustState;
    const stages: TrustState[] = ["RECEIVED", "IDENTIFIED", "VALIDATED"];

    if (blockingFindings.length > 0) {
      state = "QUARANTINED";
    } else {
      const crossCheckIds = ["chronology-date-format", "chronology-future-date", "duplicate-intra-source"];
      const crossChecked = findings.some(
        (finding) => crossCheckIds.includes(finding.id) && finding.status === "PASS",
      );
      const reconciliation = findings.find(
        (finding) => finding.id === "reconciliation-accounting-identities",
      );
      const reconciled = reconciliation?.status === "PASS";
      const hasUnverified = findings.some((finding) => finding.status === "UNVERIFIED");

      if (crossChecked) {
        stages.push("CROSS_CHECKED");
        state = "CROSS_CHECKED";
      } else {
        state = "VALIDATED";
      }
      if (reconciled) {
        stages.push("RECONCILED");
        state = "RECONCILED";
      }
      if (crossChecked && reconciled && !hasUnverified) {
        stages.push("TRUSTED");
        state = "TRUSTED";
      }
    }

    const limitations = findings
      .map((finding) => finding.limitation)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    return {
      state,
      stages,
      findings,
      blockingFindings,
      limitations,
      source: {
        sourceName: model.source.sourceName,
        sourceType: model.source.sourceType,
        sha256: model.source.sha256,
      },
      canonicalBinding: true,
    };
  }
}
