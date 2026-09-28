/**
 * Focused contract tests for the income-tax / pre-tax-profit reconciliation.
 *
 * The real Persian income statement prints a pre-tax line and an income-tax
 * expense that may be split across detail rows ("سال جاری" / "سال‌های قبل").
 * These tests prove the canonical extraction preserves both, maps them onto the
 * existing `RatioStatement` contract, and reconciles PRE-TAX − TAX = NET PROFIT
 * through the existing statement-insight integrity control. Nothing is
 * fabricated: absent evidence stays absent.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialDataIngestionAdapter } from "../Product/FinancialDataIngestionAdapter";
import { FinancialAnalyticsService } from "../Product/FinancialAnalyticsService";
import {
  buildFinancialDocumentUnderstanding,
  deriveAnalysisInput,
  derivePriorStatement,
  matchStatementMeasure,
} from "../Product/FinancialDocumentUnderstanding";
import { composeFinancialStatementInsight } from "../Product/FinancialStatementInsight";

const M = 1_000_000;

const findRealXlsx = (): string | undefined => {
  if (process.env.HOOSHYAR_REAL_XLSX) return process.env.HOOSHYAR_REAL_XLSX;
  const desktop = "C:\\Users\\avalipour\\Desktop";
  try {
    for (const entry of readdirSync(desktop, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = `${desktop}\\${entry.name}\\123.xlsx`;
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // No Desktop access: the real-file test stays skipped.
  }
  return undefined;
};

const REAL_XLSX = findRealXlsx();

const INCOME_ROWS: string[][] = [
  ["صورت سود و زیان"],
  ["(ارقام به میلیون ریال)"],
  ["شرح", "1405", "1404"],
  ["درآمد عملیاتی", "1000", "800"],
  ["بهای تمام شده کالای فروش رفته", "-600", "-500"],
  ["سود ناخالص", "400", "300"],
  ["هزینه های فروش، اداری و عمومی", "-100", "-90"],
  ["سود (زیان) عملیاتی", "300", "210"],
  ["هزینه های مالی", "-20", "-30"],
  ["سود(زیان) عملیات در حال تداوم قبل از مالیات", "280", "180"],
  ["هزینه مالیات بر درآمد:", ""],
  ["سال جاری", "-70", "-50"],
  ["سال های قبل", "-10", "-5"],
  ["سود(زیان) خالص", "200", "125"],
];

const buildInsight = (rows: string[][]) => {
  const document = buildFinancialDocumentUnderstanding([{ rows, positioned: true }]);
  const derived = deriveAnalysisInput(document);
  const prior = derivePriorStatement(document);
  const analytics = new FinancialAnalyticsService().execute({ tenantId: "t1", statement: derived.statement, priorStatement: prior });
  const insight = composeFinancialStatementInsight({ document, derived, prior, analytics });
  return { document, derived, insight };
};

describe("income-tax extraction contract", () => {
  test("maps the real pre-tax and income-tax header labels", () => {
    expect(matchStatementMeasure("سود(زیان) عملیات در حال تداوم قبل از مالیات")).toBe("PRE_TAX_INCOME");
    expect(matchStatementMeasure("سود زیان عملیات در حال تداوم قبل از مالیات")).toBe("PRE_TAX_INCOME");
    expect(matchStatementMeasure("هزینه مالیات بر درآمد")).toBe("TAX");
    expect(matchStatementMeasure("هزینه مالیات بر درآمد:")).toBe("TAX");
  });

  test("aggregates a split tax block and maps taxes/preTaxIncome onto the statement", () => {
    const { derived, insight } = buildInsight(INCOME_ROWS);
    expect(derived.statement.preTaxIncome).toBe(280 * M);
    expect(derived.statement.taxes).toBe(80 * M);
    expect(derived.statement.netIncome).toBe(200 * M);

    const identity = insight.integrity.find((check) => check.id === "net-profit-identity");
    expect(identity?.status).toBe("RECONCILED");
    expect(identity?.difference).toBe(0);
  });

  test("does not fold an unrelated row into the tax block", () => {
    const rows: string[][] = [
      ["صورت سود و زیان"],
      ["(ارقام به میلیون ریال)"],
      ["شرح", "1405", "1404"],
      ["درآمد عملیاتی", "1000", "800"],
      ["سود(زیان) عملیات در حال تداوم قبل از مالیات", "280", "180"],
      ["هزینه مالیات بر درآمد:", ""],
      ["سال جاری", "-70", "-50"],
      ["سود(زیان) خالص", "200", "125"],
    ];
    const { derived } = buildInsight(rows);
    // Only "سال جاری" is a tax detail; the net-profit row is not folded in.
    expect(derived.statement.taxes).toBe(70 * M);
  });

  test("leaves taxes absent when the source has no income-tax evidence", () => {
    const { derived, insight } = buildInsight([
      ["صورت سود و زیان"],
      ["(ارقام به میلیون ریال)"],
      ["شرح", "1405", "1404"],
      ["درآمد عملیاتی", "1000", "800"],
      ["سود(زیان) خالص", "200", "125"],
    ]);
    expect(derived.statement.taxes).toBeUndefined();
    const identity = insight.integrity.find((check) => check.id === "net-profit-identity");
    expect(identity?.status).toBe("NOT_TESTABLE");
  });
});

(REAL_XLSX && existsSync(REAL_XLSX) ? describe : describe.skip)("real 123.xlsx tax/profit reconciliation", () => {
  test("preserves the real pre-tax and tax lines and reconciles net profit", async () => {
    const store = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const adapter = new FinancialDataIngestionAdapter(store);
    const result = await adapter.ingestXlsx("real-tenant", "123.xlsx", readFileSync(REAL_XLSX as string));
    const document = result.model.document!;
    const derived = deriveAnalysisInput(document);
    const prior = derivePriorStatement(document);
    const analytics = new FinancialAnalyticsService().execute({ tenantId: "real-tenant", statement: derived.statement, priorStatement: prior });
    const insight = composeFinancialStatementInsight({ document, derived, prior, analytics });

    // Exact source lines (million Rial): pre-tax 8,762,226; current-year tax
    // 752,445 + prior-years tax 759,781 = 1,512,226; net 7,250,000.
    expect(derived.statement.preTaxIncome).toBe(8_762_226 * M);
    expect(derived.statement.taxes).toBe(1_512_226 * M);
    expect(derived.statement.netIncome).toBe(7_250_000 * M);

    const identity = insight.integrity.find((check) => check.id === "net-profit-identity");
    expect(identity?.status).toBe("RECONCILED");
    expect(identity?.difference).toBe(0);
    store.close();
  });
});
