/**
 * Stage 07-E - Scenario Engine
 *
 * Scenario stress testing and sensitivity analysis on top of the
 * canonical Monte Carlo simulator.
 *
 * IMPORTANT:
 * - All shocks are additive linear perturbations of the point forecast
 * - Elasticity = (delta mean / base mean) / (shockPercent / 100)
 *   (for shockPercent expressed as a percentage; +100 means +100%)
 * - Reuses simulate() from Stage 07-E; no duplicate RNG
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import { simulate } from "./MonteCarloSimulator";
import {
    SimulationInput,
    Scenario,
    ScenarioResult,
    SensitivityResult,
    SimulationStatistics
} from "./MonteCarloTypes";

/**
 * Run a base Monte Carlo simulation and apply each scenario as an
 * additive shock uniformly to every iteration.
 */
export function runScenarios(
    baseInput: SimulationInput,
    scenarios: ReadonlyArray<Scenario>
): ReadonlyArray<ScenarioResult> {
    const baseResult = simulate(baseInput);
    if (baseResult.status !== "calculated") {
        return Object.freeze([]);
    }
    const baseIterations = baseResult.iterations;
    const pointForecast = baseResult.pointForecast;

    const out: ScenarioResult[] = [];
    for (const sc of scenarios) {
        const shockedIterations = baseIterations.map(
            v => v + pointForecast * (sc.shockPercent / 100)
        );
        const stats = computeStatistics(shockedIterations);
        out.push(Object.freeze({
            scenarioName: sc.name,
            shockPercent: sc.shockPercent,
            statistics: stats,
            var95: stats.var95,
            cvar95: stats.cvar95
        }));
    }
    return Object.freeze(out);
}

/**
 * Sensitivity analysis: re-applies each shock to the base iterations
 * and computes elasticity with respect to the unshocked base mean.
 *
 * Elasticity = (delta mean / base mean) / (shockPercent / 100)
 *
 * Note: this avoids re-running simulate() per shock; it mutates the
 * base iteration set in-place by addition. The seeded RNG is therefore
 * consumed only once across the whole sensitivity sweep, which is the
 * correct behavior (the base distribution should not be redrawn per
 * shock level).
 */
export function sensitivityAnalysis(
    input: SimulationInput,
    shockRange: ReadonlyArray<number>
): SensitivityResult {
    const baseResult = simulate(input);
    if (baseResult.status !== "calculated") {
        return Object.freeze({
            baseValue: NaN,
            shockedValues: Object.freeze([]),
            elasticities: Object.freeze([])
        });
    }
    const baseValue = baseResult.statistics.mean;
    const pointForecast = baseResult.pointForecast;
    const baseIterations = baseResult.iterations;

    const sv: { shockPercent: number; mean: number; var95: number }[] = [];
    const el: { shockPercent: number; elasticity: number }[] = [];

    for (const shock of shockRange) {
        const shockedIterations = baseIterations.map(
            v => v + pointForecast * (shock / 100)
        );
        const stats = computeStatistics(shockedIterations);
        const mean = stats.mean;
        sv.push({
            shockPercent: shock,
            mean,
            var95: stats.var95
        });
        if (baseValue !== 0 && shock !== 0) {
            const deltaMean = mean - baseValue;
            const elasticity = (deltaMean / baseValue) / (shock / 100);
            el.push({ shockPercent: shock, elasticity });
        } else {
            el.push({ shockPercent: shock, elasticity: NaN });
        }
    }

    return Object.freeze({
        baseValue,
        shockedValues: Object.freeze(sv),
        elasticities: Object.freeze(el)
    });
}

/**
 * Compute VaR/CVaR/percentile statistics on a vector of iteration
 * values. Mirrors the internal helper used by MonteCarloSimulator.
 */
function computeStatistics(values: number[]): SimulationStatistics {
    const n = values.length;
    const sum = values.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;
    const min = Math.min(...values);
    const max = Math.max(...values);
    let sqDiff = 0;
    for (const v of values) {
        sqDiff += (v - mean) * (v - mean);
    }
    const variance = n > 1 ? sqDiff / (n - 1) : 0;
    const std = Math.sqrt(variance);

    const p5 = DescriptiveStatistics.percentile(values, 0.05);
    const p25 = DescriptiveStatistics.percentile(values, 0.25);
    const p50 = DescriptiveStatistics.percentile(values, 0.50);
    const p75 = DescriptiveStatistics.percentile(values, 0.75);
    const p95 = DescriptiveStatistics.percentile(values, 0.95);
    const p99 = DescriptiveStatistics.percentile(values, 0.99);

    const var95 = DescriptiveStatistics.percentile(values, 0.05);
    const var99 = DescriptiveStatistics.percentile(values, 0.01);

    let tailSum95 = 0, tailCount95 = 0;
    let tailSum99 = 0, tailCount99 = 0;
    for (const v of values) {
        if (v <= var95) { tailSum95 += v; tailCount95++; }
        if (v <= var99) { tailSum99 += v; tailCount99++; }
    }
    const cvar95 = tailCount95 === 0 ? var95 : tailSum95 / tailCount95;
    const cvar99 = tailCount99 === 0 ? var99 : tailSum99 / tailCount99;

    return Object.freeze({
        mean, std, min, max,
        p5, p25, p50, p75, p95, p99,
        expectedValue: mean,
        var95, cvar95, var99, cvar99
    });
}
