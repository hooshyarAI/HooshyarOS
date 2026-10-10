import { FinancialStandardsKnowledgeService } from "./FinancialStandardsKnowledgeService";

describe("FinancialStandardsKnowledgeService", () => {
  const knowledge = new FinancialStandardsKnowledgeService();

  test("publishes a dated source catalogue and distinguishes issued from effective standards", () => {
    const catalogue = knowledge.getCatalogue();
    const ids = catalogue.standardEntries.map((entry) => entry.id);

    expect(catalogue.version).toBe("financial-standards-2026-10-10.v3");
    expect(catalogue.snapshotDate).toBe("2026-10-10");
    expect(ids).toContain("IR-NAS-43");
    expect(ids).toContain("IR-NAS-44");
    expect(ids).toContain("IFRS-REQUIRED-2026");
    expect(ids).toContain("IFRS-18");
    expect(ids).toContain("ISA-240-REVISED");
    expect(ids).toContain("IESBA-HANDBOOK-2026");
    expect(catalogue.principles.accountingAndReporting.length).toBeGreaterThanOrEqual(10);
    expect(catalogue.principles.auditingAndAssurance.length).toBeGreaterThanOrEqual(8);
    expect(catalogue.principles.coverageDomains.length).toBeGreaterThanOrEqual(10);
    expect(catalogue.applicabilityRequired).toBe(true);
    expect(catalogue.iranianNationalStandardInventory.length).toBeGreaterThanOrEqual(45);
    expect(catalogue.iranianNationalStandardInventory.some((entry) => entry.number === 44 && entry.id === "IR-NAS-44")).toBe(true);
    expect(catalogue.iranianNationalStandardInventory.some((entry) => entry.id === "IR-NAS-03-OLD" && entry.lifecycleStatus === "REPORTED_WITHDRAWN")).toBe(true);
    expect(catalogue.internationalAccountingStandardIndex.some((entry) => entry.id === "IFRS 18" && entry.status === "ISSUED_NOT_YET_EFFECTIVE")).toBe(true);
    expect(catalogue.internationalAccountingStandardIndex.some((entry) => entry.id === "IAS 11" && entry.status === "SUPERSEDED_FOR_MAIN_SCOPE_BY_IFRS_15")).toBe(true);
    expect(catalogue.internationalAuditStandardIndex.some((entry) => entry.identifiers.includes("ISA 240"))).toBe(true);
    expect(catalogue.internationalAuditStandardIndex.some((entry) => entry.identifiers.includes("ISRE 2400 (Revised)"))).toBe(true);
    expect(catalogue.iranianAuditingStandardInventory.length).toBeGreaterThanOrEqual(35);
    expect(catalogue.iranianAuditingStandardInventory.some((entry) => entry.number === "700")).toBe(true);
    expect(catalogue.iranianOperationalAuditInventory).toHaveLength(1);
    expect(catalogue.iranianPublicSectorStandardInventory).toHaveLength(20);
    expect(catalogue.iranianSustainabilityDisclosureInventory.map((entry) => entry.id)).toContain("IR-SDS-01");
    expect(catalogue.iranianSustainabilityDisclosureInventory.every((entry) => entry.verificationStatus !== undefined)).toBe(true);
    expect(catalogue.iranianNationalStandardInventory.every((entry) => entry.verificationStatus !== undefined)).toBe(true);

    const ifrs18 = catalogue.standardEntries.find((entry) => entry.id === "IFRS-18");
    expect(ifrs18?.status).toBe("ISSUED_NOT_YET_EFFECTIVE");
    expect(ifrs18?.effectiveFrom).toContain("2027-01-01");

    const iranProfile = catalogue.standardEntries.find((entry) => entry.id === "IR-IFRS-JURISDICTION-PROFILE");
    expect(iranProfile?.status).toBe("LEGACY_PROFILE_REQUIRES_REFRESH");
    expect(iranProfile?.note).toContain("۱۵ دسامبر ۲۰۱۶");
  });

  test("requires jurisdiction, entity type and Iranian reporting-period context", () => {
    expect(knowledge.assessIranianApplicability(null).status).toBe("NEEDS_CONTEXT");
    expect(knowledge.assessIranianApplicability({
      jurisdiction: "IR", entityType: "", fiscalYearStartJalali: "1405-01-01"
    }).status).toBe("NEEDS_CONTEXT");
  });

  test("flags reported Iranian standards by period without declaring final applicability", () => {
    const older = knowledge.assessIranianApplicability({
      jurisdiction: "IR", entityType: "corporate", fiscalYearStartJalali: "1404-01-01"
    });
    expect(older.status).toBe("REVIEW_REQUIRED");
    expect(older.candidates.map((entry) => entry.id)).toContain("IR-NAS-43");
    expect(older.candidates.map((entry) => entry.id)).not.toContain("IR-NAS-44");
    expect(older.finalDeterminationAllowed).toBe(false);

    const current = knowledge.assessIranianApplicability({
      jurisdiction: "IR", entityType: "listed-company", fiscalYearStartJalali: "1405-01-01", isListed: true
    });
    expect(current.candidates.map((entry) => entry.id)).toContain("IR-NAS-44");
    expect(current.candidates.map((entry) => entry.id)).toContain("IR-NAS-15-REVISION-1404");
    expect(current.finalDeterminationAllowed).toBe(false);
  });
});
