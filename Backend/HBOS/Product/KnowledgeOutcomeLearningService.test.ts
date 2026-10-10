import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { KnowledgeOutcomeLearningService, KnowledgeOutcomeInput } from "./KnowledgeOutcomeLearningService";

const outcome = (overrides: Partial<KnowledgeOutcomeInput> = {}): KnowledgeOutcomeInput => ({
  task: "FINANCIAL_MANAGEMENT",
  knowledgeVersion: "interdisciplinary-decision-knowledge-2026-10-10.v2",
  methodId: "cashflow.baseline",
  metricCode: "cashflow.forecast",
  predictedValue: 1000,
  actualValue: 900,
  unit: "IRR",
  observedAt: "2026-10-09T12:00:00.000Z",
  sourceEvidenceRef: "sha256:0123456789abcdef",
  ...overrides,
});

describe("KnowledgeOutcomeLearningService", () => {
  let persistence: SQLitePersistenceStore;
  let learning: KnowledgeOutcomeLearningService;

  beforeEach(() => {
    persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    learning = new KnowledgeOutcomeLearningService(persistence);
  });

  afterEach(() => {
    persistence.close();
  });

  test("persists measured outcomes and summarizes forecast error", async () => {
    const one = await learning.recordOutcome("tenant-a", outcome());
    const two = await learning.recordOutcome("tenant-a", outcome({
      predictedValue: 1000,
      actualValue: 1100,
      observedAt: "2026-10-10T09:00:00.000Z",
    }));

    expect(one.recorded).toBe(true);
    expect(two.retainedRecords).toBe(2);
    expect(one.automaticPromotionAllowed).toBe(false);

    const summary = await learning.summarize("tenant-a", { task: "FINANCIAL_MANAGEMENT" });
    expect(summary.tenantScoped).toBe(true);
    expect(summary.totalRetainedRecords).toBe(2);
    expect(summary.filteredRecordCount).toBe(2);
    expect(summary.automaticPromotionAllowed).toBe(false);
    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0]).toMatchObject({
      task: "FINANCIAL_MANAGEMENT",
      methodId: "cashflow.baseline",
      metricCode: "cashflow.forecast",
      sampleCount: 2,
      meanAbsoluteError: 100,
      meanBias: 0,
      reviewStatus: "COLLECTING_EVIDENCE",
      automaticPromotionAllowed: false,
    });
    expect(summary.groups[0].rootMeanSquaredError).toBe(100);
  });

  test("isolates learning outcomes by tenant", async () => {
    await learning.recordOutcome("tenant-a", outcome());
    await learning.recordOutcome("tenant-b", outcome({ actualValue: 1200 }));

    expect((await learning.summarize("tenant-a")).totalRetainedRecords).toBe(1);
    expect((await learning.summarize("tenant-b")).totalRetainedRecords).toBe(1);
    expect((await learning.summarize("tenant-c")).totalRetainedRecords).toBe(0);
  });

  test("signals only a candidate for human review after the evidence threshold", async () => {
    for (let index = 0; index < 10; index += 1) {
      await learning.recordOutcome("tenant-a", outcome({
        predictedValue: 100 + index,
        actualValue: 105 + index,
        observedAt: new Date(Date.parse("2026-10-01T00:00:00.000Z") + index * 86_400_000).toISOString(),
      }));
    }

    const summary = await learning.summarize("tenant-a");
    expect(summary.minimumSamplesForHumanReview).toBe(10);
    expect(summary.groups[0].sampleCount).toBe(10);
    expect(summary.groups[0].reviewStatus).toBe("HUMAN_REVIEW_CANDIDATE");
    expect(summary.groups[0].automaticPromotionAllowed).toBe(false);
  });

  test("rejects unknown task names, non-finite metrics and missing evidence references", async () => {
    await expect(learning.recordOutcome("tenant-a", outcome({ task: "MAGIC" })))
      .rejects.toThrow("knowledge-outcome-task-invalid");
    await expect(learning.recordOutcome("tenant-a", outcome({ predictedValue: Number.NaN })))
      .rejects.toThrow("knowledge-outcome-predicted-value-invalid");
    await expect(learning.recordOutcome("tenant-a", outcome({ sourceEvidenceRef: " " })))
      .rejects.toThrow("knowledge-outcome-source-evidence-ref-invalid");
    await expect(learning.recordOutcome(" ", outcome()))
      .rejects.toThrow("knowledge-outcome-tenant-required");
  });
});
