import { Engine } from "../Core/Engine";

export interface FinancialAnalysisInput {
    revenue: number;
    expenses: number;
    assets: number;
    liabilities: number;
}

export interface FinancialAnalysisResult {
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
    debtRatio: number;
    status: "READY" | "BLOCKED";
}

export interface CashFlowSeries {
    /** Cash flow at t=0 (typically negative for an initial investment). */
    initial: number;
    /** Periodic cash flows for t=1..n. */
    flows: readonly number[];
    /** Periodic discount rate as a decimal (e.g. 0.10 for 10%). */
    discountRate: number;
}

export interface NpvResult {
    npv: number;
    discountRate: number;
    periods: number;
    status: "READY" | "BLOCKED";
}

export interface IrrResult {
    irr: number;
    periods: number;
    converged: boolean;
    iterations: number;
    status: "READY" | "BLOCKED";
}

export interface PaybackResult {
    /** Plain payback period in years (NaN if never paid back within flows). */
    paybackPeriod: number;
    /** Discounted payback period in years (NaN if never paid back within flows). */
    discountedPaybackPeriod: number;
    /** Whether the project is fully paid back within the supplied flow horizon. */
    fullyRecovered: boolean;
    status: "READY" | "BLOCKED";
}

export class FinancialIntelligenceEngine implements Engine {
    name = "FinancialIntelligenceEngine";

    initialize(): { name: string; status: "READY"; health: "HEALTHY" } {
        return {
            name: this.name,
            status: "READY",
            health: "HEALTHY"
        };
    }

    health(): boolean {
        return true;
    }

    analyze(input: FinancialAnalysisInput): FinancialAnalysisResult {
        if (!input || !Number.isFinite(input.revenue) || !Number.isFinite(input.expenses) || !Number.isFinite(input.assets) || !Number.isFinite(input.liabilities) || input.assets < 0 || input.liabilities < 0) {
            return {
                revenue: 0,
                expenses: 0,
                profit: 0,
                profitMargin: 0,
                debtRatio: 0,
                status: "BLOCKED"
            };
        }

        const profit = input.revenue - input.expenses;
        const profitMargin = input.revenue === 0 ? 0 : profit / input.revenue;
        const debtRatio = input.assets === 0 ? 0 : input.liabilities / input.assets;
        return {
            revenue: input.revenue,
            expenses: input.expenses,
            profit,
            profitMargin,
            debtRatio,
            status: "READY"
        };
    }

    /**
     * 09-1.1 Net Present Value.
     * NPV = initial + sum(flow_t / (1+r)^t), t = 1..n
     * Returns BLOCKED for invalid inputs (non-finite, negative rate, empty flows).
     */
    npv(series: CashFlowSeries): NpvResult {
        if (!series || !Array.isArray(series.flows) || series.flows.length === 0) {
            return { npv: 0, discountRate: 0, periods: 0, status: "BLOCKED" };
        }
        if (!Number.isFinite(series.initial) || !Number.isFinite(series.discountRate) || series.discountRate < -0.999) {
            return { npv: 0, discountRate: 0, periods: 0, status: "BLOCKED" };
        }
        for (const f of series.flows) {
            if (!Number.isFinite(f)) {
                return { npv: 0, discountRate: 0, periods: 0, status: "BLOCKED" };
            }
        }
        const r = series.discountRate;
        let total = series.initial;
        for (let t = 0; t < series.flows.length; t += 1) {
            const cf = series.flows[t];
            const denom = Math.pow(1 + r, t + 1);
            if (denom === 0 || !Number.isFinite(denom)) {
                return { npv: 0, discountRate: r, periods: series.flows.length, status: "BLOCKED" };
            }
            total += cf / denom;
        }
        return { npv: total, discountRate: r, periods: series.flows.length, status: "READY" };
    }

    /**
     * 09-1.1 Internal Rate of Return via Newton-Raphson with bisection fallback.
     * Solves NPV(r) = 0. Returns BLOCKED on invalid input or non-convergence.
     */
    irr(series: { initial: number; flows: readonly number[] }): IrrResult {
        if (!series || !Array.isArray(series.flows) || series.flows.length === 0) {
            return { irr: 0, periods: 0, converged: false, iterations: 0, status: "BLOCKED" };
        }
        if (!Number.isFinite(series.initial)) {
            return { irr: 0, periods: 0, converged: false, iterations: 0, status: "BLOCKED" };
        }
        for (const f of series.flows) {
            if (!Number.isFinite(f)) {
                return { irr: 0, periods: 0, converged: false, iterations: 0, status: "BLOCKED" };
            }
        }

        const cashFlows: number[] = [series.initial, ...series.flows];
        const npvAt = (r: number): number => {
            let s = 0;
            for (let t = 0; t < cashFlows.length; t += 1) {
                s += cashFlows[t] / Math.pow(1 + r, t);
            }
            return s;
        };
        const dnpvAt = (r: number): number => {
            let s = 0;
            for (let t = 1; t < cashFlows.length; t += 1) {
                s -= t * cashFlows[t] / Math.pow(1 + r, t + 1);
            }
            return s;
        };

        const hasSignChange = (() => {
            let first = npvAt(-0.9999);
            let last = npvAt(10);
            if (!Number.isFinite(first) || !Number.isFinite(last)) return false;
            return first * last < 0;
        })();
        if (!hasSignChange) {
            return { irr: 0, periods: series.flows.length, converged: false, iterations: 0, status: "BLOCKED" };
        }

        const maxIter = 100;
        const tol = 1e-7;
        let r = 0.1;
        let converged = false;
        let iter = 0;
        for (iter = 0; iter < maxIter; iter += 1) {
            const f = npvAt(r);
            if (Math.abs(f) < tol) {
                converged = true;
                break;
            }
            const fp = dnpvAt(r);
            if (!Number.isFinite(fp) || Math.abs(fp) < 1e-12) {
                break;
            }
            const next = r - f / fp;
            if (!Number.isFinite(next) || next <= -0.9999) {
                break;
            }
            r = next;
        }

        // Bisection fallback if Newton-Raphson did not converge.
        if (!converged) {
            let lo = -0.999;
            let hi = 10;
            let fLo = npvAt(lo);
            let fHi = npvAt(hi);
            if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) {
                return { irr: 0, periods: series.flows.length, converged: false, iterations: iter, status: "BLOCKED" };
            }
            for (iter = 0; iter < 200; iter += 1) {
                const mid = (lo + hi) / 2;
                const fMid = npvAt(mid);
                if (!Number.isFinite(fMid)) break;
                if (Math.abs(fMid) < tol || (hi - lo) < tol) {
                    r = mid;
                    converged = true;
                    break;
                }
                if (fLo * fMid < 0) {
                    hi = mid;
                    fHi = fMid;
                } else {
                    lo = mid;
                    fLo = fMid;
                }
            }
        }

        if (!converged) {
            return { irr: 0, periods: series.flows.length, converged: false, iterations: iter, status: "BLOCKED" };
        }
        return { irr: r, periods: series.flows.length, converged: true, iterations: iter + 1, status: "READY" };
    }

    /**
     * 09-1.1 Payback period (plain + discounted).
     * Plain payback: t at which cumulative undiscounted cash flow first turns
     *   non-negative. Linear interpolation within the recovery year.
     * Discounted payback: same but using discounted cumulative cash flow.
     * Returns NaN for the period fields if the project is not recovered within
     *   the supplied flow horizon.
     */
    payback(series: CashFlowSeries): PaybackResult {
        if (!series || !Array.isArray(series.flows) || series.flows.length === 0) {
            return { paybackPeriod: NaN, discountedPaybackPeriod: NaN, fullyRecovered: false, status: "BLOCKED" };
        }
        if (!Number.isFinite(series.initial) || !Number.isFinite(series.discountRate)) {
            return { paybackPeriod: NaN, discountedPaybackPeriod: NaN, fullyRecovered: false, status: "BLOCKED" };
        }
        const r = series.discountRate;
        let cumulative = series.initial;
        let discCumulative = series.initial;
        let plainPeriod = NaN;
        let discPeriod = NaN;
        let fullyRecovered = false;

        for (let t = 0; t < series.flows.length; t += 1) {
            const cf = series.flows[t];
            if (!Number.isFinite(cf)) {
                return { paybackPeriod: NaN, discountedPaybackPeriod: NaN, fullyRecovered: false, status: "BLOCKED" };
            }
            const prevCum = cumulative;
            cumulative += cf;
            if (Number.isNaN(plainPeriod) && prevCum < 0 && cumulative >= 0 && cf !== 0) {
                const fraction = -prevCum / cf;
                plainPeriod = t + fraction;
            }
            const denom = Math.pow(1 + r, t + 1);
            if (!Number.isFinite(denom) || denom === 0) {
                return { paybackPeriod: NaN, discountedPaybackPeriod: NaN, fullyRecovered: false, status: "BLOCKED" };
            }
            const prevDisc = discCumulative;
            discCumulative += cf / denom;
            if (Number.isNaN(discPeriod) && prevDisc < 0 && discCumulative >= 0) {
                const discCf = cf / denom;
                if (discCf !== 0) {
                    discPeriod = t + (-prevDisc / discCf);
                }
            }
        }
        if (cumulative >= 0) fullyRecovered = true;
        return { paybackPeriod: plainPeriod, discountedPaybackPeriod: discPeriod, fullyRecovered, status: "READY" };
    }
}
