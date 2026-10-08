/**
 * Stage 07-E - Monte Carlo / Scenario Risk Types
 *
 * Contract types for deterministic Monte Carlo simulation and
 * scenario stress testing.
 *
 * IMPORTANT:
 * - No fabricated confidence
 * - Status distinguishes unavailable / calculated / insufficient_data /
 *   invalid_request
 * - Tenant isolation enforced at the engine boundary
 * - All outputs are immutable (Object.freeze)
 */

export interface Scenario {
    readonly name: string;
    readonly description: string;
    /** Additive shock as a percentage (e.g., -50 = -50%, 25 = +25%) */
    readonly shockPercent: number;
    /** Step at which the shock is applied (1-based; default = 1) */
    readonly appliedAt: number;
}

export interface SimulationInput {
    readonly tenantId: string;
    readonly metricName: string;
    readonly forecastingMethod: string;
    /** Point forecast from the forecasting engine */
    readonly pointForecast: number;
    /** Number of Monte Carlo iterations */
    readonly simulationCount: number;
    /** Deterministic seed (must be a finite integer) */
    readonly seed: number;
    /** Calibration residual set from Stage 07-D.A */
    readonly residualSet: ResidualSetLike;
    /** Optional scenario stresses (applied after residual draw) */
    readonly scenarios?: ReadonlyArray<Scenario>;
}

/**
 * Minimal subset of ResidualSet used by the simulator.
 * Defined structurally so we don'"'"'t have to import the heavier
 * UncertaintyTypes module here.
 */
export interface ResidualSetLike {
    readonly tenantId: string;
    readonly metricName: string;
    readonly method: string;
    readonly observationCount: number;
    readonly finiteResidualCount: number;
    readonly residuals: ReadonlyArray<{ readonly residual: number }>;
}

export interface SimulationStatistics {
    readonly mean: number;
    readonly std: number;
    readonly min: number;
    readonly max: number;
    readonly p5: number;
    readonly p25: number;
    readonly p50: number;
    readonly p75: number;
    readonly p95: number;
    readonly p99: number;
    readonly expectedValue: number;
    /** Value-at-Risk at alpha = 0.05 (5th percentile) */
    readonly var95: number;
    /** Conditional VaR / Expected Shortfall at alpha = 0.05 */
    readonly cvar95: number;
    /** Value-at-Risk at alpha = 0.01 (1st percentile) */
    readonly var99: number;
    /** Conditional VaR / Expected Shortfall at alpha = 0.01 */
    readonly cvar99: number;
}

export interface ScenarioResult {
    readonly scenarioName: string;
    readonly shockPercent: number;
    readonly statistics: SimulationStatistics;
    readonly var95: number;
    readonly cvar95: number;
}

export interface SensitivityResult {
    readonly baseValue: number;
    readonly shockedValues: ReadonlyArray<{
        readonly shockPercent: number;
        readonly mean: number;
        readonly var95: number;
    }>;
    readonly elasticities: ReadonlyArray<{
        readonly shockPercent: number;
        readonly elasticity: number;
    }>;
}

export interface SimulationProvenance {
    readonly source: string;
    readonly tenant: string;
    readonly metric: string;
    readonly method: string;
    readonly seed: number;
    readonly simulationCount: number;
    readonly calculatedAt: string;
}

export type SimulationStatus =
    | "calculated"
    | "insufficient_data"
    | "invalid_request"
    | "unavailable";

export type SimulationResult =
    | {
          readonly status: "calculated";
          readonly tenantId: string;
          readonly metricName: string;
          readonly method: string;
          readonly pointForecast: number;
          readonly simulationCount: number;
          readonly seed: number;
          readonly residualCount: number;
          readonly iterations: ReadonlyArray<number>;
          readonly statistics: SimulationStatistics;
          readonly scenarioResults: ReadonlyArray<ScenarioResult>;
          readonly provenance: SimulationProvenance;
      }
    | {
          readonly status: "insufficient_data" | "invalid_request" | "unavailable";
          readonly tenantId: string;
          readonly metricName: string;
          readonly method: string;
          readonly simulationCount: number;
          readonly seed: number;
          readonly residualCount: number;
          readonly error: string;
      };
