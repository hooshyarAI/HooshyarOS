/**
 * Stage 07-E - Monte Carlo Simulator
 *
 * Deterministic Monte Carlo simulation engine.
 *
 * METHOD:
 * - For each of `simulationCount` iterations:
 *   1. Draw a residual index uniformly using the seeded RNG
 *   2. simulated_value = pointForecast + drawn_residual + (optional) scenario_shock
 * - Compute summary statistics from the simulated distribution:
 *   - mean, std (sample), min, max
 *   - percentiles p5, p25, p50, p75, p95, p99 (Type-7 from Stage 07-A)
 *   - VaR_95 = 5th percentile (alpha = 0.05)
 *   - CVaR_95 = mean of values at or below VaR_95 (Expected Shortfall)
 *   - VaR_99 = 1st percentile
 *   - CVaR_99 = mean of values at or below VaR_99
 *
 * IMPORTANT:
 * - Reuses canonical Stage 07-A Type-7 percentile via DescriptiveStatistics
 * - Reuses canonical Stage 07-D.A ResidualSet semantics
 * - No fabricated confidence; status distinguishes unavailable /
 *   insufficient_data / invalid_request / calculated
 * - Tenant isolation enforced at the engine boundary
 * - All outputs frozen and reproducible
 */

import { DescriptiveStatistics } from "../Temporal/DescriptiveStatistics";
import { ResidualSet } from "./UncertaintyTypes";
import { SeededRNG_create } from "./SeededRNG";
import {
    SimulationInput,
    SimulationResult,
    SimulationStatistics,
    SimulationProvenance,
    ScenarioResult,
    Scenario
} from "./MonteCarloTypes";

/** Minimum number of residuals required for a simulation run */
const MIN_RESIDUALS = 2;

/** Canonical fixed timestamp for reproducibility (matches Stage 07-D) */
const CANONICAL_TIMESTAMP = "2026-01-01T00:00:00Z";

/**
 * Run a deterministic Monte Carlo simulation.
 */
export function simulate(input: SimulationInput): SimulationResult {
    // ===== Input validation =====
    if (!input) {
        return buildError("unavailable", "Input is undefined", "", "", 0, 0, 0);
    }

    const {
        tenantId,
        metricName,
        forecastingMethod,
        pointForecast,
        simulationCount,
        seed,
        residualSet,
        scenarios
    } = input;

    if (typeof tenantId !== "string" || tenantId.length === 0) {
        return buildError("invalid_request", "tenantId must be a non-empty string", tenantId || "", metricName || "", simulationCount, seed, 0);
    }
    if (typeof metricName !== "string" || metricName.length === 0) {
        return buildError("invalid_request", "metricName must be a non-empty string", tenantId, metricName || "", simulationCount, seed, 0);
    }
    if (!isFiniteValue(pointForecast)) {
        return buildError("invalid_request", `pointForecast must be a finite number, got ${pointForecast}`, tenantId, metricName, simulationCount, seed, 0);
    }
    if (!Number.isInteger(simulationCount) || simulationCount < 0) {
        return buildError("invalid_request", `simulationCount must be a non-negative integer, got ${simulationCount}`, tenantId, metricName, simulationCount, seed, 0);
    }
    if (!Number.isInteger(seed)) {
        return buildError("invalid_request", `seed must be a finite integer, got ${seed}`, tenantId, metricName, simulationCount, seed, 0);
    }
    if (!residualSet) {
        return buildError("insufficient_data", "residualSet is missing", tenantId, metricName, simulationCount, seed, 0);
    }

    // ===== Tenant isolation =====
    if (residualSet.tenantId !== tenantId) {
        return buildError(
            "invalid_request",
            `Tenant mismatch: residualSet.tenantId="${residualSet.tenantId}" != input.tenantId="${tenantId}"`,
            tenantId, metricName, simulationCount, seed, residualSet.observationCount
        );
    }

    // ===== Residual validation =====
    const residualValues: number[] = [];
    for (const r of residualSet.residuals) {
        if (isFiniteValue(r.residual)) {
            residualValues.push(r.residual);
        }
    }
    if (residualValues.length < MIN_RESIDUALS) {
        return buildError(
            "insufficient_data",
            `Need at least ${MIN_RESIDUALS} finite residuals, got ${residualValues.length}`,
            tenantId, metricName, simulationCount, seed, residualValues.length
        );
    }

    // ===== Zero-iteration fast path =====
    if (simulationCount === 0) {
        return buildError(
            "insufficient_data",
            `simulationCount is zero; nothing to simulate`,
            tenantId, metricName, simulationCount, seed, residualValues.length
        );
    }

    // ===== Run simulation =====
    const rng = SeededRNG_create(seed);
    const baseIterations: number[] = new Array(simulationCount);
    for (let i = 0; i < simulationCount; i++) {
        const idx = rng.nextInt(0, residualValues.length - 1);
        const drawn = residualValues[idx];
        baseIterations[i] = pointForecast + drawn;
    }

    const baseStatistics = computeStatistics(baseIterations);

    // ===== Run scenarios =====
    let scenarioResults: ScenarioResult[] = [];
    if (scenarios && scenarios.length > 0) {
        scenarioResults = scenarios.map((sc: Scenario) => {
            const shockedIterations = baseIterations.map(v => v + pointForecast * (sc.shockPercent / 100));
            const stats = computeStatistics(shockedIterations);
            return Object.freeze({
                scenarioName: sc.name,
                shockPercent: sc.shockPercent,
                statistics: stats,
                var95: stats.var95,
                cvar95: stats.cvar95
            });
        });
    }

    const provenance: SimulationProvenance = Object.freeze({
        source: "monte-carlo-simulator",
        tenant: tenantId,
        metric: metricName,
        method: forecastingMethod,
        seed,
        simulationCount,
        calculatedAt: CANONICAL_TIMESTAMP
    });

    return Object.freeze({
        status: "calculated" as const,
        tenantId,
        metricName,
        method: forecastingMethod,
        pointForecast,
        simulationCount,
        seed,
        residualCount: residualValues.length,
        iterations: Object.freeze(baseIterations),
        statistics: baseStatistics,
        scenarioResults: Object.freeze(scenarioResults),
        provenance
    });
}

// ===== Statistics helpers =====

/**
 * Compute mean, std, min, max, percentiles, VaR, and CVaR in a single
 * pass over the iteration array.
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

    // CVaR (Expected Shortfall): mean of values at or below the VaR threshold
    const cvar95 = computeCVaR(values, var95);
    const cvar99 = computeCVaR(values, var99);

    return Object.freeze({
        mean,
        std,
        min,
        max,
        p5,
        p25,
        p50,
        p75,
        p95,
        p99,
        expectedValue: mean,
        var95,
        cvar95,
        var99,
        cvar99
    });
}

/**
 * Mean of values <= threshold. Ties (==) are included so the
 * threshold value itself is part of the tail mean.
 */
function computeCVaR(values: number[], threshold: number): number {
    let sum = 0;
    let count = 0;
    for (const v of values) {
        if (v <= threshold) {
            sum += v;
            count++;
        }
    }
    if (count === 0) {
        return threshold;
    }
    return sum / count;
}

function buildError(
    status: "insufficient_data" | "invalid_request" | "unavailable",
    message: string,
    tenantId: string,
    metricName: string,
    simulationCount: number,
    seed: number,
    residualCount: number
): SimulationResult {
    return Object.freeze({
        status,
        tenantId,
        metricName,
        method: "",
        simulationCount,
        seed,
        residualCount,
        error: message
    });
}

function isFiniteValue(v: number): boolean {
    return typeof v === "number" && Number.isFinite(v) && !isNaN(v);
}
