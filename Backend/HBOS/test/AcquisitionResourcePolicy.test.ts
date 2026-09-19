/**
 * Stage 08-F.3 — Configurable Resource Policy focused tests.
 */
import {
  createAnnotatedPolicy,
  DEFAULT_SPREADSHEET_CONFIG,
  type AnnotatedSpreadsheetPolicy,
} from "../Product/AcquisitionResourcePolicy";

describe("AcquisitionResourcePolicy (Stage 08-F.3)", () => {
  test("createAnnotatedPolicy exposes all five limits", () => {
    const policy: AnnotatedSpreadsheetPolicy = createAnnotatedPolicy(DEFAULT_SPREADSHEET_CONFIG);
    expect(policy.xlsxMaxSizeBytes.value).toBe(DEFAULT_SPREADSHEET_CONFIG.xlsxMaxSizeBytes);
    expect(policy.xlsMaxSizeBytes.value).toBe(DEFAULT_SPREADSHEET_CONFIG.xlsMaxSizeBytes);
    expect(policy.xlsParseBudgetMs.value).toBe(DEFAULT_SPREADSHEET_CONFIG.xlsParseBudgetMs);
    expect(policy.xlsxZipEntryLimitBytes.value).toBe(
      DEFAULT_SPREADSHEET_CONFIG.xlsxZipEntryLimitBytes,
    );
    expect(policy.xlsxTotalUncompressedLimitBytes.value).toBe(
      DEFAULT_SPREADSHEET_CONFIG.xlsxTotalUncompressedLimitBytes,
    );
  });

  test("XLSX zip-entry and total-uncompressed limits are VERIFIED_CONTROL", () => {
    const policy = createAnnotatedPolicy(DEFAULT_SPREADSHEET_CONFIG);
    expect(policy.xlsxZipEntryLimitBytes.classification).toBe("VERIFIED_CONTROL");
    expect(policy.xlsxTotalUncompressedLimitBytes.classification).toBe("VERIFIED_CONTROL");
  });

  test("XLSX max-size is PROPOSED_POLICY", () => {
    const policy = createAnnotatedPolicy(DEFAULT_SPREADSHEET_CONFIG);
    expect(policy.xlsxMaxSizeBytes.classification).toBe("PROPOSED_POLICY");
  });

  test("XLS limits are PROPOSED_POLICY (XLS is blocked)", () => {
    const policy = createAnnotatedPolicy(DEFAULT_SPREADSHEET_CONFIG);
    expect(policy.xlsMaxSizeBytes.classification).toBe("PROPOSED_POLICY");
    expect(policy.xlsParseBudgetMs.classification).toBe("PROPOSED_POLICY");
  });

  test("every limit carries a non-empty rationale", () => {
    const policy = createAnnotatedPolicy(DEFAULT_SPREADSHEET_CONFIG);
    for (const limit of Object.values(policy)) {
      expect(typeof limit.rationale).toBe("string");
      expect(limit.rationale.length).toBeGreaterThan(0);
    }
  });

  test("respects overrides from caller", () => {
    const policy = createAnnotatedPolicy({
      ...DEFAULT_SPREADSHEET_CONFIG,
      xlsxMaxSizeBytes: 1,
    });
    expect(policy.xlsxMaxSizeBytes.value).toBe(1);
  });
});
