import { Engine } from "../Core/Engine";

export interface BudgetAnalysisInput { planned: number; actual: number; }
export interface BudgetAnalysisResult { planned: number; actual: number; variance: number; utilization: number; status: "READY" | "BLOCKED"; }

export type CostVarianceStatus = "WITHIN_BUDGET" | "OVER_BUDGET" | "UNDER_BUDGET" | "UNBUDGETED_SPEND";

export interface BudgetCostLineInput {
    readonly lineId: string;
    readonly costCenterId: string;
    readonly category: string;
    readonly currency: string;
    readonly planned: number;
    readonly actual: number;
}

export interface CostVarianceSummary {
    readonly planned: number;
    readonly actual: number;
    /** Positive means above plan; negative means below plan. */
    readonly variance: number;
    /** Null when a zero planned amount makes a ratio undefined. */
    readonly utilization: number | null;
    /** Percentage, not a fraction. Null when planned is zero. */
    readonly variancePercent: number | null;
    readonly status: CostVarianceStatus;
}

export interface BudgetCostLineResult extends BudgetCostLineInput, CostVarianceSummary {}

export interface CostVarianceGroup extends CostVarianceSummary {
    readonly key: string;
    readonly lineCount: number;
}

export type BudgetCostBreakdownResult =
    | {
        readonly status: "READY";
        readonly currency: string;
        readonly total: CostVarianceGroup;
        readonly byCostCenter: readonly CostVarianceGroup[];
        readonly byCategory: readonly CostVarianceGroup[];
        readonly lines: readonly BudgetCostLineResult[];
    }
    | {
        readonly status: "BLOCKED";
        readonly reason: string;
    };

export interface BudgetCostBreakdownInput {
    readonly lines: readonly BudgetCostLineInput[];
}

interface NormalizedCostLine {
    readonly lineId: string;
    readonly costCenterId: string;
    readonly category: string;
    readonly currency: string;
    readonly planned: number;
    readonly actual: number;
}

export class BudgetIntelligenceEngine implements Engine {
    name = "BudgetIntelligenceEngine";
    initialize(): void {}
    health(): boolean { return true; }
    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return { id: "platform.budget-intelligence", capability: "implement Budget Intelligence", targetEngine: "Budget Intelligence Engine" };
    }
    analyze(input: BudgetAnalysisInput): BudgetAnalysisResult {
        if (!Number.isFinite(input?.planned) || !Number.isFinite(input?.actual) || input.planned < 0 || input.actual < 0) {
            return { planned: 0, actual: 0, variance: 0, utilization: 0, status: "BLOCKED" };
        }
        return {
            planned: input.planned,
            actual: input.actual,
            variance: input.actual - input.planned,
            utilization: input.planned === 0 ? 0 : input.actual / input.planned,
            status: "READY"
        };
    }


    /**
     * Compare planned and actual costs by cost center and category.
     * All lines must use one explicit currency; no exchange conversion occurs.
     * This is variance analysis, not product costing or activity-based costing.
     */
    analyzeCostBreakdown(input: BudgetCostBreakdownInput): BudgetCostBreakdownResult {
        const blocked = (reason: string): BudgetCostBreakdownResult => ({ status: "BLOCKED", reason });
        if (!input || !Array.isArray(input.lines) || input.lines.length === 0) {
            return blocked("COST_LINES_REQUIRED");
        }

        const normalized: NormalizedCostLine[] = [];
        const lineIds = new Set<string>();
        let currency: string | undefined;
        for (const raw of input.lines as readonly BudgetCostLineInput[]) {
            if (!raw || typeof raw !== "object") return blocked("COST_LINE_INVALID");
            if (typeof raw.lineId !== "string" || !raw.lineId.trim()) return blocked("COST_LINE_ID_REQUIRED");
            const lineId = raw.lineId.trim();
            if (lineIds.has(lineId)) return blocked("COST_LINE_ID_DUPLICATE");
            lineIds.add(lineId);

            if (typeof raw.costCenterId !== "string" || !raw.costCenterId.trim()) return blocked("COST_CENTER_REQUIRED");
            if (typeof raw.category !== "string" || !raw.category.trim()) return blocked("COST_CATEGORY_REQUIRED");
            if (typeof raw.currency !== "string" || !raw.currency.trim()) return blocked("CURRENCY_REQUIRED");
            if (typeof raw.planned !== "number" || !Number.isFinite(raw.planned) || raw.planned < 0 ||
                typeof raw.actual !== "number" || !Number.isFinite(raw.actual) || raw.actual < 0) {
                return blocked("COST_AMOUNT_INVALID");
            }

            const lineCurrency = raw.currency.trim().toUpperCase();
            if (currency === undefined) currency = lineCurrency;
            else if (lineCurrency !== currency) return blocked("MIXED_CURRENCIES_NOT_SUPPORTED");

            normalized.push({
                lineId,
                costCenterId: raw.costCenterId.trim(),
                category: raw.category.trim(),
                currency: lineCurrency,
                planned: raw.planned,
                actual: raw.actual
            });
        }

        const summarize = (planned: number, actual: number): CostVarianceSummary => ({
            planned,
            actual,
            variance: actual - planned,
            utilization: planned > 0 ? actual / planned : null,
            variancePercent: planned > 0 ? ((actual - planned) / planned) * 100 : null,
            status: planned === 0 && actual > 0
                ? "UNBUDGETED_SPEND"
                : actual > planned
                    ? "OVER_BUDGET"
                    : actual < planned
                        ? "UNDER_BUDGET"
                        : "WITHIN_BUDGET"
        });

        type Aggregate = { planned: number; actual: number; lineCount: number };
        const add = (target: Map<string, Aggregate>, key: string, line: NormalizedCostLine): boolean => {
            const current = target.get(key) ?? { planned: 0, actual: 0, lineCount: 0 };
            const planned = current.planned + line.planned;
            const actual = current.actual + line.actual;
            if (!Number.isFinite(planned) || !Number.isFinite(actual)) return false;
            target.set(key, { planned, actual, lineCount: current.lineCount + 1 });
            return true;
        };

        const centers = new Map<string, Aggregate>();
        const categories = new Map<string, Aggregate>();
        const results: BudgetCostLineResult[] = [];
        let totalPlanned = 0;
        let totalActual = 0;

        for (const line of normalized) {
            totalPlanned += line.planned;
            totalActual += line.actual;
            if (!Number.isFinite(totalPlanned) || !Number.isFinite(totalActual)) return blocked("COST_TOTAL_OVERFLOW");
            if (!add(centers, line.costCenterId, line)) return blocked("COST_TOTAL_OVERFLOW");
            if (!add(categories, line.category, line)) return blocked("COST_TOTAL_OVERFLOW");
            results.push(Object.freeze({ ...line, ...summarize(line.planned, line.actual) }));
        }

        const toGroups = (groups: Map<string, Aggregate>): CostVarianceGroup[] =>
            [...groups.entries()]
                .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
                .map(([key, value]) => Object.freeze({
                    key,
                    lineCount: value.lineCount,
                    ...summarize(value.planned, value.actual)
                }));

        return Object.freeze({
            status: "READY",
            currency: currency!,
            total: Object.freeze({
                key: "TOTAL",
                lineCount: normalized.length,
                ...summarize(totalPlanned, totalActual)
            }),
            byCostCenter: Object.freeze(toGroups(centers)),
            byCategory: Object.freeze(toGroups(categories)),
            lines: Object.freeze(results)
        });
    }

    // Canonical evidence-compatible alias. The capability contract owns one
    // deterministic analysis operation; callers do not need a second budget
    // calculation implementation.
    analyzeBudget(input: BudgetAnalysisInput): BudgetAnalysisResult {
        return this.analyze(input);
    }
}
