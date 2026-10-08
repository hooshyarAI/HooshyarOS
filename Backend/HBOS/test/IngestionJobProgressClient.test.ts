/**
 * Stage 15-ING.3 — Frontend ingestion progress/status contract.
 *
 * The product UI must show the REAL server-side ingestion stage, real OCR page
 * progress and real elapsed time, must not fabricate a percentage, and must
 * survive an ordinary refresh. The shared describer and the static wiring are
 * verified here; the end-to-end flow is qualified by the acceptance scripts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const client = require("../../../web/offline-sync.js") as {
  INGEST_STAGE_LABELS_FA: Record<string, string>;
  ingestStageLabelFa: (stage: string) => string;
  describeIngestProgress: (job: unknown, nowMs?: number) => {
    stage: string;
    stageLabel: string;
    message: string;
    percent: number | null;
    page: number | null;
    pages: number | null;
    elapsedSeconds: number | null;
    terminal: boolean;
  };
};

const WEB_ROOT = resolve(__dirname, "..", "..", "..", "web");

describe("frontend ingestion progress describer", () => {
  test("renders real OCR page progress and percentage", () => {
    const described = client.describeIngestProgress({
      stage: "OCR",
      message: "در حال تشخیص متن تصویر (OCR)",
      progress: { page: 2, pages: 5, percent: 40 },
      receivedAt: "2026-09-19T00:00:00.000Z",
    }, Date.parse("2026-09-19T00:00:30.000Z"));

    expect(described.percent).toBe(40);
    expect(described.page).toBe(2);
    expect(described.pages).toBe(5);
    expect(described.message).toContain("صفحه 2 از 5");
    expect(described.elapsedSeconds).toBe(30);
    expect(described.terminal).toBe(false);
  });

  test("never fabricates a percentage for a non-OCR stage", () => {
    const described = client.describeIngestProgress({ stage: "NORMALIZING", progress: { percent: 99 } });
    expect(described.percent).toBeNull();
    expect(described.page).toBeNull();
  });

  test("marks terminal stages and exposes Persian labels", () => {
    expect(client.describeIngestProgress({ stage: "COMPLETED" }).terminal).toBe(true);
    expect(client.describeIngestProgress({ stage: "FAILED" }).terminal).toBe(true);
    expect(client.ingestStageLabelFa("PERSISTING")).toContain("ذخیره");
    expect(client.INGEST_STAGE_LABELS_FA.OCR).toContain("OCR");
  });
});

describe("frontend ingestion job wiring (static contract)", () => {
  const app = readFileSync(resolve(WEB_ROOT, "app.js"), "utf8");
  const html = readFileSync(resolve(WEB_ROOT, "index.html"), "utf8");
  const sw = readFileSync(resolve(WEB_ROOT, "sw.js"), "utf8");

  test("the client uses the governed job API and shows progress", () => {
    expect(app).toContain("/api/ingest/jobs");
    expect(app).toContain("idempotencyKey('ingest:job')");
    expect(app).toContain("resumePersistedIngestJob");
    expect(app).toContain("IDEMPOTENCY_IN_PROGRESS");
  });

  test("the shell exposes the progress elements and refreshes the PWA cache", () => {
    expect(html).toContain('id="analysis-progress"');
    expect(html).toContain('id="analysis-progress-bar"');
    expect(html).toContain('id="analysis-progress-message"');
    expect(sw).not.toContain("hooshyar-shell-v2");
  });
});
