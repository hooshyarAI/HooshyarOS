/**
 * Stage 08-F.3 — Configurable Resource Policy.
 *
 * Supporting module under the canonical FinancialDataIngestionAdapter.
 * This module is NOT a new Engine. It re-exports the existing
 * `SpreadsheetIngestionConfig` + `DEFAULT_SPREADSHEET_CONFIG` and adds
 * explicit, human-auditable annotations so every numeric limit is
 * classified as either PROPOSED_POLICY (engineering proposal pending
 * empirical verification) or VERIFIED_CONTROL (measured / contractual).
 *
 * The policy values themselves are NOT changed here — only annotated.
 * This preserves the frozen XLSX security controls from 08-D.1 and the
 * 37/24-test invariants from prior stages.
 */

export type PolicyClassification = "PROPOSED_POLICY" | "VERIFIED_CONTROL";

/**
 * Annotated numeric limit: a value plus an honest classification plus
 * a short rationale. The rationale is the single line a reviewer needs
 * to know WHY a limit is annotated this way.
 */
export interface AnnotatedLimit {
  readonly value: number;
  readonly classification: PolicyClassification;
  readonly rationale: string;
}

/**
 * Annotated view of `SpreadsheetIngestionConfig`. Each field mirrors a
 * numeric limit from the original config and adds classification +
 * rationale. The shape is intentionally explicit (no Map / dynamic keys)
 * so reviewers can audit at a glance.
 */
export interface AnnotatedSpreadsheetPolicy {
  readonly xlsMaxSizeBytes: AnnotatedLimit;
  readonly xlsParseBudgetMs: AnnotatedLimit;
  readonly xlsxMaxSizeBytes: AnnotatedLimit;
  readonly xlsxZipEntryLimitBytes: AnnotatedLimit;
  readonly xlsxTotalUncompressedLimitBytes: AnnotatedLimit;
}

export {
  DEFAULT_SPREADSHEET_CONFIG,
  type SpreadsheetIngestionConfig,
} from "./FinancialDataIngestionAdapter";

/**
 * Build an annotated policy view from a SpreadsheetIngestionConfig.
 * The classification labels reflect current knowledge:
 *
 *   - XLSX zip-entry and total-uncompressed limits are VERIFIED_CONTROL:
 *     they were deliberately chosen as the CWE-409 decompression-bomb
 *     defenses in 08-D.1 and MUST NOT be weakened.
 *   - XLSX max-size, XLS max-size and XLS parse-budget are PROPOSED_POLICY:
 *     they are engineering defaults pending empirical verification on
 *     real tenant workloads. They are clearly labeled so reviewers and
 *     future stages know what may be tuned.
 */
export function createAnnotatedPolicy(
  config: import("./FinancialDataIngestionAdapter").SpreadsheetIngestionConfig,
): AnnotatedSpreadsheetPolicy {
  return {
    xlsMaxSizeBytes: {
      value: config.xlsMaxSizeBytes,
      classification: "PROPOSED_POLICY",
      rationale: "XLS not yet supported; placeholder limit pending dependency resolution",
    },
    xlsParseBudgetMs: {
      value: config.xlsParseBudgetMs,
      classification: "PROPOSED_POLICY",
      rationale: "XLS not yet supported; placeholder budget pending dependency resolution",
    },
    xlsxMaxSizeBytes: {
      value: config.xlsxMaxSizeBytes,
      classification: "PROPOSED_POLICY",
      rationale: "Initial 5 MB default; adjust per tenant workload evidence",
    },
    xlsxZipEntryLimitBytes: {
      value: config.xlsxZipEntryLimitBytes,
      classification: "VERIFIED_CONTROL",
      rationale: "CWE-409 decompression-bomb defense from 08-D.1; do not weaken",
    },
    xlsxTotalUncompressedLimitBytes: {
      value: config.xlsxTotalUncompressedLimitBytes,
      classification: "VERIFIED_CONTROL",
      rationale: "CWE-409 decompression-bomb defense from 08-D.1; do not weaken",
    },
  };
}
