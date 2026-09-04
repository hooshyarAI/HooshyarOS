import { Engine } from "../Core/Engine";

export interface RiskInitializationResult { status: "READY"; }
export interface RiskAssessmentResult { probability: number; impact: number; score: number; status: "READY" | "BLOCKED"; }

/**
 * 09-1.7 1-D sensitivity result for a single input variable.
 * `deltaPct` is the fractional perturbation (e.g. -0.10 = -10%).
 */
export interface SensitivityEntry {
    variable: string;
    deltaPct: number;
    baseValue: number;
    newValue: number;
    baseOutput: number;
    newOutput: number;
    absoluteChange: number;
    elasticOutput: number;
}

export interface SensitivityResult {
    baseOutput: number;
    entries: SensitivityEntry[];
    status: "READY" | "BLOCKED";
}

export class RiskIntelligenceEngine implements Engine {
    name = "RiskIntelligenceEngine";

    initialize(): RiskInitializationResult {
        return { status: "READY" };
    }

    health(): boolean { return true; }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return { id: "platform.risk-intelligence", capability: "implement Risk Intelligence", targetEngine: "Risk Intelligence Engine" };
    }

    assess(probability: number, impact: number): RiskAssessmentResult {
        if (!Number.isFinite(probability) || !Number.isFinite(impact) || probability < 0 || probability > 1 || impact < 0) {
            return { probability: 0, impact: 0, score: 0, status: "BLOCKED" };
        }
        return { probability, impact, score: probability * impact, status: "READY" };
    }

    /**
     * 09-1.7 One-dimensional sensitivity analysis.
     *
     * Perturbs each named input by each deltaPct (e.g. -0.20, -0.10, +0.10, +0.20)
     * and re-evaluates the model function. Returns base output and per-entry
     * absolute + elastic change.
     *
     * The model is supplied as a pure function. The engine does NOT execute
     * user code with side effects; the function is called only with the
     * provided numeric values.
     */
    sensitivity(input: {
        base: Readonly<Record<string, number>>;
        deltas: readonly number[];
        model: (params: Readonly<Record<string, number>>) => number;
    }): SensitivityResult {
        if (!input || !input.base || !Array.isArray(input.deltas) || typeof input.model !== "function") {
            return { baseOutput: 0, entries: [], status: "BLOCKED" };
        }
        for (const v of Object.values(input.base)) {
            if (!Number.isFinite(v)) {
                return { baseOutput: 0, entries: [], status: "BLOCKED" };
            }
        }
        const baseOutput = input.model(input.base);
        if (!Number.isFinite(baseOutput)) {
            return { baseOutput: 0, entries: [], status: "BLOCKED" };
        }
        const entries: SensitivityEntry[] = [];
        for (const variable of Object.keys(input.base)) {
            const baseVal = input.base[variable];
            for (const deltaPct of input.deltas) {
                if (!Number.isFinite(deltaPct)) continue;
                const newVal = baseVal * (1 + deltaPct);
                if (!Number.isFinite(newVal)) continue;
                const perturbed: Record<string, number> = { ...input.base, [variable]: newVal };
                const newOutput = input.model(perturbed);
                if (!Number.isFinite(newOutput)) continue;
                const absChange = newOutput - baseOutput;
                const elastic = baseOutput === 0 ? 0 : (absChange / baseOutput) / deltaPct;
                entries.push({
                    variable,
                    deltaPct,
                    baseValue: baseVal,
                    newValue: newVal,
                    baseOutput,
                    newOutput,
                    absoluteChange: absChange,
                    elasticOutput: elastic
                });
            }
        }
        return { baseOutput, entries, status: "READY" };
    }

    /**
     * 09-1.7 N-D (multi-variable) tornado.
     * For each variable, evaluates the model at base, base-up, and base-down
     * and reports the resulting output range. Sorts by descending range.
     */
    tornado(input: {
        base: Readonly<Record<string, number>>;
        deltaPct: number;
        model: (params: Readonly<Record<string, number>>) => number;
    }): { baseOutput: number; variable: string; downOutput: number; upOutput: number; range: number }[] {
        if (!input || !input.base || typeof input.model !== "function" ||
            !Number.isFinite(input.deltaPct)) {
            return [];
        }
        const baseOutput = input.model(input.base);
        if (!Number.isFinite(baseOutput)) return [];
        const result: { baseOutput: number; variable: string; downOutput: number; upOutput: number; range: number }[] = [];
        for (const variable of Object.keys(input.base)) {
            const baseVal = input.base[variable];
            const down: Record<string, number> = { ...input.base, [variable]: baseVal * (1 - input.deltaPct) };
            const up: Record<string, number> = { ...input.base, [variable]: baseVal * (1 + input.deltaPct) };
            const dOut = input.model(down);
            const uOut = input.model(up);
            if (!Number.isFinite(dOut) || !Number.isFinite(uOut)) continue;
            result.push({ baseOutput, variable, downOutput: dOut, upOutput: uOut, range: Math.abs(uOut - dOut) });
        }
        result.sort((a, b) => b.range - a.range);
        return result;
    }

    /**
     * 09-1.8 Scenario analysis.
     */
    scenario(input: {
        base: Readonly<Record<string, number>>;
        scenarios: ReadonlyArray<{ name: string; params: Readonly<Record<string, number>> }>;
        model: (params: Readonly<Record<string, number>>) => number;
    }): { baseOutput: number; entries: { name: string; output: number; delta: number; pctChange: number; status: "READY" | "BLOCKED" }[]; status: "READY" | "BLOCKED" } {
        if (!input || !input.base || !Array.isArray(input.scenarios) || typeof input.model !== "function") {
            return { baseOutput: 0, entries: [], status: "BLOCKED" };
        }
        for (const v of Object.values(input.base)) {
            if (!Number.isFinite(v)) {
                return { baseOutput: 0, entries: [], status: "BLOCKED" };
            }
        }
        const baseOutput = input.model(input.base);
        if (!Number.isFinite(baseOutput)) {
            return { baseOutput: 0, entries: [], status: "BLOCKED" };
        }
        const entries: { name: string; output: number; delta: number; pctChange: number; status: "READY" | "BLOCKED" }[] = [];
        for (const sc of input.scenarios) {
            if (!sc || typeof sc.name !== "string" || !sc.params) {
                entries.push({ name: String(sc?.name ?? "unknown"), output: 0, delta: 0, pctChange: 0, status: "BLOCKED" });
                continue;
            }
            for (const v of Object.values(sc.params)) {
                if (!Number.isFinite(v)) {
                    entries.push({ name: sc.name, output: 0, delta: 0, pctChange: 0, status: "BLOCKED" });
                    continue;
                }
            }
            try {
                const out = input.model(sc.params);
                if (!Number.isFinite(out)) {
                    entries.push({ name: sc.name, output: 0, delta: 0, pctChange: 0, status: "BLOCKED" });
                    continue;
                }
                entries.push({
                    name: sc.name,
                    output: out,
                    delta: out - baseOutput,
                    pctChange: baseOutput === 0 ? 0 : (out - baseOutput) / baseOutput,
                    status: "READY"
                });
            } catch {
                entries.push({ name: sc.name, output: 0, delta: 0, pctChange: 0, status: "BLOCKED" });
            }
        }
        return { baseOutput, entries, status: "READY" };
    }
    /**
     * 09-2.1 Monte Carlo simulation.
     *
     * Samples `iterations` parameter sets. For each parameter, a uniform or
     * normal distribution is specified by `min`/`max` (uniform) OR `mean`/
     * `stdDev` (normal). A seeded PRNG (mulberry32) is used to make results
     * deterministic for the same seed.
     */
    monteCarlo(input: {
        base: Readonly<Record<string, number>>;
        variables: ReadonlyArray<{
            name: string;
            distribution: "uniform" | "normal";
            min?: number; max?: number;
            mean?: number; stdDev?: number;
        }>;
        model: (params: Readonly<Record<string, number>>) => number;
        iterations: number;
        seed: number;
    }): { seed: number; iterations: number; samples: number; mean: number; stdDev: number; min: number; max: number; median: number; status: "READY" | "BLOCKED" } {
        if (!input || !input.base || !Array.isArray(input.variables) || typeof input.model !== "function" ||
            !Number.isFinite(input.iterations) || input.iterations <= 0 || !Number.isFinite(input.seed)) {
            return { seed: 0, iterations: 0, samples: 0, mean: 0, stdDev: 0, min: 0, max: 0, median: 0, status: "BLOCKED" };
        }
        for (const v of input.variables) {
            if (!v || typeof v.name !== "string") {
                return { seed: input.seed, iterations: input.iterations, samples: 0, mean: 0, stdDev: 0, min: 0, max: 0, median: 0, status: "BLOCKED" };
            }
            if (v.distribution === "uniform") {
                if (!Number.isFinite(v.min) || !Number.isFinite(v.max) || v.min > v.max) {
                    return { seed: input.seed, iterations: input.iterations, samples: 0, mean: 0, stdDev: 0, min: 0, max: 0, median: 0, status: "BLOCKED" };
                }
            } else if (v.distribution === "normal") {
                if (!Number.isFinite(v.mean) || !Number.isFinite(v.stdDev) || v.stdDev < 0) {
                    return { seed: input.seed, iterations: input.iterations, samples: 0, mean: 0, stdDev: 0, min: 0, max: 0, median: 0, status: "BLOCKED" };
                }
            } else {
                return { seed: input.seed, iterations: input.iterations, samples: 0, mean: 0, stdDev: 0, min: 0, max: 0, median: 0, status: "BLOCKED" };
            }
        }
        // mulberry32 PRNG
        let s = (input.seed >>> 0) || 1;
        const rand = (): number => {
            s |= 0; s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        // Box-Muller for normal
        const normal = (mean: number, stdDev: number): number => {
            const u1 = Math.max(rand(), 1e-12);
            const u2 = rand();
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            return mean + stdDev * z;
        };
        const outputs: number[] = [];
        for (let i = 0; i < input.iterations; i += 1) {
            const params: Record<string, number> = { ...input.base };
            for (const v of input.variables) {
                if (v.distribution === "uniform") {
                    params[v.name] = v.min! + rand() * (v.max! - v.min!);
                } else {
                    params[v.name] = normal(v.mean!, v.stdDev!);
                }
            }
            const out = input.model(params);
            if (!Number.isFinite(out)) continue;
            outputs.push(out);
        }
        if (outputs.length === 0) {
            return { seed: input.seed, iterations: input.iterations, samples: 0, mean: 0, stdDev: 0, min: 0, max: 0, median: 0, status: "BLOCKED" };
        }
        const mean = outputs.reduce((a, b) => a + b, 0) / outputs.length;
        const variance = outputs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / outputs.length;
        const stdDev = Math.sqrt(variance);
        const sorted = [...outputs].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[(sorted.length - 1) / 2];
        return { seed: input.seed, iterations: input.iterations, samples: outputs.length, mean, stdDev, min, max, median, status: "READY" };
    }

    /**
     * 09-2.2 Historical simulation VaR and CVaR.
     * VaR_alpha = -quantile(returns, 1 - alpha) of the loss distribution.
     * CVaR_alpha = E[loss | loss >= VaR_alpha] (expected shortfall).
     */
    valueAtRisk(input: { returns: readonly number[]; alpha: number }): { var: number; cvar: number; alpha: number; status: "READY" | "BLOCKED" } {
        if (!Array.isArray(input.returns) || input.returns.length === 0 ||
            !Number.isFinite(input.alpha) || input.alpha <= 0 || input.alpha >= 1) {
            return { var: 0, cvar: 0, alpha: 0, status: "BLOCKED" };
        }
        for (const r of input.returns) {
            if (!Number.isFinite(r)) {
                return { var: 0, cvar: 0, alpha: input.alpha, status: "BLOCKED" };
            }
        }
        const sorted = [...input.returns].sort((a, b) => a - b);
        const idx = Math.floor((1 - input.alpha) * sorted.length);
        const varReturn = sorted[Math.min(idx, sorted.length - 1)];
        const var95 = -varReturn;
        // CVaR: average of returns <= varReturn
        const tail = sorted.filter(r => r <= varReturn);
        const cvarReturn = tail.length === 0 ? varReturn : tail.reduce((a, b) => a + b, 0) / tail.length;
        const cvar = -cvarReturn;
        return { var: var95, cvar, alpha: input.alpha, status: "READY" };
    }}
