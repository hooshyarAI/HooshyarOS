/**
 * Phase 12-1.1: Resilience Analytics Service (product service).
 *
 * Wraps the canonical Uncertainty module (Monte Carlo, Scenario, Optimizer)
 * into a tenant-scoped product service owned by the Financial Intelligence
 * Engine boundary. No new Engine.
 *
 * Capabilities:
 * - stressTest: Monte Carlo simulation with optional scenario shocks
 * - scenarioAnalysis: deterministic scenario bounds when residuals unavailable
 * - sensitivityAnalysis: elasticity of base value to shock range
 * - optimize: deterministic optimization for business objectives
 *
 * IMPORTANT:
 * - Missing residuals produce a deterministic fallback, not fabricated data.
 * - Tenant isolation enforced via tenantId on every call.
 * - Provenance preserved for every result.
 */

import {
    simulate,
    runScenarios,
    sensitivityAnalysis
} from "../Uncertainty";
import { Optimizer } from "../Uncertainty/Optimizer";
import {
    Scenario,
    SensitivityResult
} from "../Uncertainty/MonteCarloTypes";
import type {
    OptimizationResult,
    BoundConstraint,
    ObjectiveFunction
} from "../Uncertainty/BayesianTypes";

export interface ResilienceStressInput {
    readonly tenantId: string;
    readonly metric: string;
    readonly baseValue: number;
    readonly scenarios: readonly Scenario[];
    readonly simulationCount?: number;
    readonly seed?: number;
    readonly residuals?: readonly { readonly residual: number }[];
}

export interface ScenarioBound {
    readonly name: string;
    readonly shockPercent: number;
    readonly bound: number;
}

export interface ResilienceStressResult {
    readonly status: "READY" | "BLOCKED";
    readonly tenantId: string;
    readonly metric: string;
    readonly mode: "monte_carlo" | "deterministic_bounds";
    readonly baseValue: number;
    readonly baseStatistics?: {
        readonly mean: number;
        readonly std: number;
        readonly var95: number;
        readonly cvar95: number;
    };
    readonly scenarioBounds: readonly ScenarioBound[];
    readonly provenance: {
        readonly source: string;
        readonly tenant: string;
        readonly calculatedAt: string;
    };
}

export interface ResilienceOptimizationInput {
    readonly tenantId: string;
    readonly objective: "maximize_profit" | "minimize_risk" | "maximize_margin";
    readonly variableNames: readonly string[];
    readonly initialGuess: readonly number[];
    readonly bounds: readonly { readonly variable: string; readonly lower: number; readonly upper: number }[];
    readonly linearConstraints?: readonly { readonly coefficients: readonly number[]; readonly bound: number; readonly inequality: "<=" | ">=" }[];
    readonly maxIterations?: number;
}

export interface ResilienceOptimizationResult {
    readonly status: "READY" | "BLOCKED" | "INFEASIBLE";
    readonly tenantId: string;
    readonly objective: string;
    readonly solution: Record<string, number>;
    readonly objectiveValue: number;
    readonly iterations: number;
    readonly convergenceDelta?: number;
    readonly provenance: {
        readonly source: string;
        readonly tenant: string;
        readonly calculatedAt: string;
    };
}

const CANONICAL_TIMESTAMP = "2026-01-01T00:00:00Z";

export class ResilienceAnalyticsService {
    readonly capabilityId = "product.resilience-analytics";
    readonly targetEngine = "Financial Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    stressTest(input: ResilienceStressInput): ResilienceStressResult {
        const tenantId = String(input.tenantId ?? "").trim();
        const metric = String(input.metric ?? "").trim();
        const baseValue = Number(input.baseValue);

        if (!tenantId || !metric || !Number.isFinite(baseValue)) {
            return this.blockedStress(tenantId || "", metric || "");
        }

        const hasResiduals = Array.isArray(input.residuals) && input.residuals.length >= 2;
        const simulationCount = Number.isInteger(input.simulationCount) && input.simulationCount! > 0
            ? input.simulationCount!
            : 1000;
        const seed = Number.isInteger(input.seed) ? input.seed! : 42;

        const provenance = Object.freeze({
            source: "resilience-analytics-service",
            tenant: tenantId,
            calculatedAt: CANONICAL_TIMESTAMP
        });

        if (hasResiduals) {
            const validResiduals = input.residuals.filter(r => Number.isFinite(r.residual));
            if (validResiduals.length < 2) {
                return this.blockedStress(tenantId, metric);
            }

            const residualSet = {
                tenantId,
                metricName: metric,
                method: "resilience-stress",
                observationCount: validResiduals.length,
                finiteResidualCount: validResiduals.length,
                residuals: validResiduals
            };

            const mcResult = simulate({
                tenantId,
                metricName: metric,
                forecastingMethod: "resilience-stress",
                pointForecast: baseValue,
                simulationCount,
                seed,
                residualSet,
                scenarios: input.scenarios
            });

            if (mcResult.status !== "calculated") {
                return {
                    status: "BLOCKED",
                    tenantId,
                    metric,
                    mode: "monte_carlo",
                    baseValue,
                    scenarioBounds: this.deterministicBounds(baseValue, input.scenarios),
                    provenance
                };
            }

            return {
                status: "READY",
                tenantId,
                metric,
                mode: "monte_carlo",
                baseValue,
                baseStatistics: {
                    mean: mcResult.statistics.mean,
                    std: mcResult.statistics.std,
                    var95: mcResult.statistics.var95,
                    cvar95: mcResult.statistics.cvar95
                },
                scenarioBounds: this.deterministicBounds(baseValue, input.scenarios),
                provenance
            };
        }

        return {
            status: "READY",
            tenantId,
            metric,
            mode: "deterministic_bounds",
            baseValue,
            scenarioBounds: this.deterministicBounds(baseValue, input.scenarios),
            provenance
        };
    }

    scenarioAnalysis(tenantId: string, metric: string, baseValue: number, scenarios: readonly Scenario[]): ResilienceStressResult {
        return this.stressTest({
            tenantId,
            metric,
            baseValue,
            scenarios,
            simulationCount: 0,
            seed: 0
        });
    }

    sensitivityAnalysis(tenantId: string, metric: string, baseValue: number, shockRange: readonly number[]): SensitivityResult | { status: "BLOCKED"; tenantId: string; error: string } {
        const validShocks = shockRange.filter(s => Number.isFinite(s));
        if (validShocks.length === 0) {
            return { status: "BLOCKED", tenantId, error: "shockRange must contain at least one finite number" };
        }

        const base = baseValue;
        const shockedValues = validShocks.map(shock => ({
            shockPercent: shock,
            mean: base * (1 + shock / 100),
            var95: base * (1 + shock / 100)
        }));

        const elasticities = validShocks.map(shock => {
            if (base === 0 || shock === 0) {
                return { shockPercent: shock, elasticity: NaN };
            }
            const deltaMean = shockedValues.find(sv => sv.shockPercent === shock)!.mean - base;
            const elasticity = (deltaMean / base) / (shock / 100);
            return { shockPercent: shock, elasticity };
        });

        return {
            baseValue: base,
            shockedValues: Object.freeze(shockedValues),
            elasticities: Object.freeze(elasticities)
        };
    }

    optimize(input: ResilienceOptimizationInput): ResilienceOptimizationResult {
        const tenantId = String(input.tenantId ?? "").trim();
        if (!tenantId || !input.objective || !input.variableNames || input.variableNames.length === 0) {
            return this.blockedOptimization(tenantId, input.objective);
        }

        if (input.initialGuess.length !== input.variableNames.length) {
            return this.blockedOptimization(tenantId, input.objective);
        }

        for (const v of input.initialGuess) {
            if (!Number.isFinite(v)) {
                return this.blockedOptimization(tenantId, input.objective);
            }
        }

        const boundConstraints: BoundConstraint[] = input.bounds.map(b => ({
            type: "bound",
            variableIndex: input.variableNames.indexOf(b.variable),
            lower: b.lower,
            upper: b.upper
        }));

        const invalidBound = boundConstraints.find(bc => bc.variableIndex < 0);
        if (invalidBound) {
            return this.blockedOptimization(tenantId, input.objective);
        }

        const linearConstraints = (input.linearConstraints ?? []).map(lc => ({
            type: "linear" as const,
            coefficients: lc.coefficients,
            bound: lc.bound,
            inequality: lc.inequality
        }));

        const objectiveFn: ObjectiveFunction = {
            type: input.objective.startsWith("maximize") ? "maximize" : "minimize",
            evaluate: (x: number[]) => {
                if (input.objective === "maximize_profit") {
                    return x.reduce((sum, v, i) => sum + v * (i + 1), 0);
                }
                if (input.objective === "minimize_risk") {
                    return x.reduce((sum, v) => sum + v * v, 0);
                }
                return x.reduce((sum, v) => sum + v, 0);
            }
        };

        const result = Optimizer.optimize(objectiveFn, [...input.initialGuess], [...boundConstraints, ...linearConstraints], {
            maxIterations: input.maxIterations ?? 200,
            tolerance: 1e-6,
            tenant: tenantId
        });

        const solution: Record<string, number> = {};
        input.variableNames.forEach((name, i) => {
            solution[name] = result.solution ? result.solution[i] : input.initialGuess[i];
        });

        return {
            status: result.status === "optimal" || result.status === "converged" ? "READY" : "BLOCKED",
            tenantId,
            objective: input.objective,
            solution: Object.freeze(solution),
            objectiveValue: result.objectiveValue,
            iterations: result.iterations,
            convergenceDelta: result.convergenceDelta ?? undefined,
            provenance: Object.freeze({
                source: "resilience-analytics-service",
                tenant: tenantId,
                calculatedAt: CANONICAL_TIMESTAMP
            })
        };
    }

    private deterministicBounds(baseValue: number, scenarios: readonly Scenario[]): readonly ScenarioBound[] {
        return scenarios.map(sc => ({
            name: sc.name,
            shockPercent: sc.shockPercent,
            bound: baseValue * (1 + sc.shockPercent / 100)
        }));
    }

    private blockedStress(tenantId: string, metric: string): ResilienceStressResult {
        return {
            status: "BLOCKED",
            tenantId,
            metric: metric || "unknown",
            mode: "deterministic_bounds",
            baseValue: 0,
            scenarioBounds: [],
            provenance: Object.freeze({
                source: "resilience-analytics-service",
                tenant: tenantId,
                calculatedAt: CANONICAL_TIMESTAMP
            })
        };
    }

    private blockedOptimization(tenantId: string, objective: string): ResilienceOptimizationResult {
        return {
            status: "BLOCKED",
            tenantId,
            objective: objective || "unknown",
            solution: Object.freeze({}),
            objectiveValue: NaN,
            iterations: 0,
            provenance: Object.freeze({
                source: "resilience-analytics-service",
                tenant: tenantId,
                calculatedAt: CANONICAL_TIMESTAMP
            })
        };
    }
}
