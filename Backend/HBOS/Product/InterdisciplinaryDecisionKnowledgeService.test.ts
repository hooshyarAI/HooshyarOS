import { InterdisciplinaryDecisionKnowledgeService } from "./InterdisciplinaryDecisionKnowledgeService";

describe("InterdisciplinaryDecisionKnowledgeService", () => {
  const knowledge = new InterdisciplinaryDecisionKnowledgeService();

  test("publishes a versioned catalogue spanning management finance and financial engineering", () => {
    const catalogue = knowledge.getCatalogue();
    const ids = catalogue.domains.map((domain) => domain.id);

    expect(catalogue.version).toBe("interdisciplinary-decision-knowledge-2026-10-10.v2");
    expect(catalogue.domainCount).toBeGreaterThanOrEqual(12);
    expect(ids).toContain("data-analytics-science");
    expect(ids).toContain("data-analytics-management-and-governance");
    expect(ids).toContain("financial-management-and-corporate-finance");
    expect(ids).toContain("quantitative-finance-and-financial-engineering");
    expect(ids).toContain("economics-and-econometrics");
    expect(ids).toContain("operations-research-and-optimization");
    expect(ids).toContain("behavioral-science-and-human-centered-design");
    expect(ids).toContain("organizational-and-people-analytics");
    expect(catalogue.references.some((source) => source.id === "NIST-AI-RMF")).toBe(true);
    expect(catalogue.references.some((source) => source.id === "GOOGLE-ML-MONITORING")).toBe(true);
    expect(catalogue.rules.some((rule) => rule.includes("baseline"))).toBe(true);
  });

  test("routes financial statement work to accounting and financial management knowledge", () => {
    const result = knowledge.composeForTask({
      task: "FINANCIAL_STATEMENT_ANALYSIS",
      evidenceAvailable: ["trial-balance.csv"]
    });

    expect(result.domainIds).toContain("accounting-financial-reporting");
    expect(result.domainIds).toContain("financial-management-and-corporate-finance");
    expect(result.domainIds).toContain("data-analytics-science");
    expect(result.domainIds).toContain("data-analytics-management-and-governance");
    expect(result.domainIds).toContain("risk-governance-and-regulatory-applicability");
    expect(result.domainIds).not.toContain("organizational-and-people-analytics");
    expect(result.reasoningContext).toContain("جمع بدهکار/بستانکار کل، درآمد/هزینه نیست");
    expect(result.contextComplete).toBe(false);
  });

  test("supports distinct financial-management and quantitative-engineering profiles", () => {
    const management = knowledge.composeForTask({
      task: "FINANCIAL_MANAGEMENT", jurisdiction: "IR", entityType: "corporate",
      evidenceAvailable: ["cash-flow", "budget"]
    });
    expect(management.domainIds).toContain("financial-management-and-corporate-finance");
    expect(management.domainIds).toContain("economics-and-econometrics");
    expect(management.domainIds).toContain("data-analytics-management-and-governance");

    const engineering = knowledge.composeForTask({
      task: "FINANCIAL_ENGINEERING", jurisdiction: "IR", entityType: "investment-firm",
      evidenceAvailable: ["market-prices"]
    });
    expect(engineering.domainIds).toContain("quantitative-finance-and-financial-engineering");
    expect(engineering.domainIds).toContain("operations-research-and-optimization");
    expect(engineering.domainIds).toContain("data-analytics-science");
  });

  test("uses task-specific knowledge rather than every discipline for every task", () => {
    const process = knowledge.composeForTask({task:"PROCESS_REDESIGN"});
    expect(process.domainIds).toContain("organizational-and-people-analytics");
    expect(process.domainIds).toContain("behavioral-science-and-human-centered-design");
    expect(process.domainIds).not.toContain("quantitative-finance-and-financial-engineering");

    const managementDecision = knowledge.composeForTask({task:"MANAGEMENT_DECISION"});
    expect(managementDecision.task).toBe("EXECUTIVE_DECISION");
    expect(managementDecision.domainIds).toContain("strategy-enterprise-performance-and-process");
  });

  test("keeps regulatory scope and missing evidence explicit", () => {
    const result = knowledge.composeForTask({task:"HR_ANALYTICS"});
    expect(result.contextComplete).toBe(false);
    expect(result.reasoningContext).toContain("incomplete");
    expect(result.reasoningContext).toContain("No evidence inventory supplied");
    expect(result.reasoningContext).toContain("human review");
  });

  test("unknown tasks fall back safely to a useful general profile", () => {
    expect(knowledge.composeForTask({task:"unknown-work"}).task).toBe("GENERAL");
  });
});
