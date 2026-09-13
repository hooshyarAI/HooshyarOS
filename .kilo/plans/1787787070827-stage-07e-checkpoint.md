# Stage 07-E Checkpoint

**Stage**: 07-E (Monte Carlo / Scenario Risk)
**Status**: VERIFIED
**Date**: 2026-09-03
**Branch**: fix/autonomous-product-factory
**Previous commit**: bb35a08d (Stage 07-D)

---

## SCOPE

Deterministic Monte Carlo simulation and scenario stress testing on top
of the Stage 07-D uncertainty foundation. Reuses the canonical Type-7
percentile (Stage 07-A `DescriptiveStatistics`) and the residual set
contract (Stage 07-D.A `ResidualSet`).

**Stage 07-E does NOT replace, modify, or duplicate Stage 07-D
capabilities.** It is a new knot that consumes the Stage 07-D residual
foundation.

---

## IMPLEMENTATION SUMMARY

Files created:

- `Backend/HBOS/Uncertainty/SeededRNG.ts`
- `Backend/HBOS/Uncertainty/MonteCarloTypes.ts`
- `Backend/HBOS/Uncertainty/MonteCarloSimulator.ts`
- `Backend/HBOS/Uncertainty/ScenarioEngine.ts`
- `Backend/HBOS/Uncertainty/index.ts` (extended; existing exports preserved)
- `Backend/HBOS/test/MonteCarlo.07-E.test.ts`
- `.kilo/plans/1787787070827-stage-07e-checkpoint.md` (this checkpoint)

---

## TEST RESULTS

**New file**: `HBOS/test/MonteCarlo.07-E.test.ts`
- Test Suites: 1 passed
- **Tests: 26 passed, 26 total**

Coverage breakdown:
- SeededRNG (5 tests): reproducibility, invalid-seed rejection, nextInt,
  nextNormal marginal sanity
- Simulator with known residual vectors (5 tests): constant zero,
  two-value, determinism, byte-identical across runs, distinct seeds
- Edge cases (7 tests): zero sims, empty residuals, fewer than
  MIN_RESIDUALS, non-finite forecast, very large shock, tenant mismatch,
  missing residualSet
- VaR / CVaR semantics (4 tests): Type-7 quantile + tail-mean
  semantics on 5-iteration residual set, constant-residual case,
  coverage mirrors left-tail mass for sampling-with-replacement,
  VaR_99 monotonicity
- Scenario stress (2 tests): positive/negative shock shifts, scenario
  engine parity
- Sensitivity (2 tests): linear mean change with zero residuals,
  non-NaN elasticities
- Provenance (1 test): required fields + canonical timestamp

**Regression suite** (all green):
- TemporalData.07-A.test.ts
- Baselines.07-B.test.ts
- Forecasting.07-C.A.test.ts
- Forecasting.07-C.B.test.ts
- Backtest.07-C.C.test.ts
- ModelSelection.07-C.D.test.ts
- Uncertainty.07-D.A.test.ts
- PredictionInterval.07-D.B.test.ts
- Calibration.07-D.C.test.ts
- Phase06I.test.ts
- Phase06H.test.ts
- Phase05C-B.test.ts
- MonteCarlo.07-E.test.ts (new)

**Tests: 417 passed, 417 total (17 suites including the new one)**

---

## MATHEMATICAL CONVENTIONS

- **Percentiles**: Type-7 (Hyndman & Fan). Reused from
  `DescriptiveStatistics.percentile`. No duplicate percentile code.
- **RNG**: Mulberry32 (32-bit state, public domain). Deterministic;
  invalid seeds (NaN, Infinity, -Infinity, non-integers) are rejected
  with a structured error.
- **Normal samples**: Box-Muller standard form. One sample per call;
  the second uniform-derived value is discarded.
- **VaR**: VaR_alpha = alpha-quantile of the simulated distribution.
  VaR_95 = 5th percentile, VaR_99 = 1st percentile.
- **CVaR (Expected Shortfall)**: mean of all simulated values at or
  below the VaR threshold (inclusive of the threshold value itself so
  ties are part of the tail mean). When all iterations equal the
  threshold (e.g., zero residuals), CVaR == VaR == point forecast.
- **Scenario shocks**: additive linear perturbations of the point
  forecast. `shockPercent = -50` means subtract 50% of the point
  forecast from every iteration.
- **Elasticity**: `(delta mean / base mean) / (shockPercent / 100)`.
  For constant residuals, elasticity = 1.0 by construction.

---

## HAND-VERIFIED MATH

1. **Constant zero residuals, pointForecast=100** -> all iterations =
   100, VaR_95 = CVaR_95 = 100, std = 0.
2. **Residuals [-5, 5]** -> every iteration is either pointForecast-5
   or pointForecast+5; ~50/50 split across many draws.
3. **Constant residuals, large -90% shock** on pointForecast=100 ->
   scenario mean = 10 (matches manual calc: 100 + 100*(-90/100)).
4. **Constant residuals, +20% shock** -> scenario mean = 120; -30%
   shock -> scenario mean = 70.
5. **Sensitivity at +50% shock, constant residuals** ->
   elasticity = (50 / 100) / (50/100) = 1.0 exactly.
6. **VaR_99 <= VaR_95**: deeper quantile is always more extreme for
   loss semantics; verified with multi-residual vector.

---

## ASSUMPTIONS

- Residuals are treated as exchangeable (no autocorrelation modeled);
  this is consistent with the Stage 07-D.A residual set semantics.
- Scenario shocks are linear additive perturbations of the point
  forecast; no multiplicative-only shocks, no state-dependent shocks.
- The residual empirical distribution is representative of forecast
  error; consumers must satisfy the Stage 07-D.A calibration contract
  before trusting Monte Carlo outputs.
- No covariance structure between metrics is modeled (single-metric
  Monte Carlo; multi-metric copulas are a future stage).

---

## SECURITY / TENANT EVIDENCE

- Tenant isolation enforced at the engine boundary: `simulate()`
  rejects `input.tenantId !== residualSet.tenantId` with
  `status = "invalid_request"` (test C6).
- Non-finite point forecast is rejected (test C4).
- Missing residual set is rejected with `insufficient_data` or
  `invalid_request` depending on the failure mode (test C7).
- All result objects are `Object.freeze`'d before return; iteration
  arrays are frozen as well.

---

## PROVENANCE FIELDS

`SimulationProvenance` records:

- `source = "monte-carlo-simulator"`
- `tenant`
- `metric`
- `method` (forecasting method name)
- `seed`
- `simulationCount`
- `calculatedAt = "2026-01-01T00:00:00Z"` (canonical fixed timestamp,
  matches Stage 07-D.A/B/C convention for reproducibility assertions)

---

## LIMITATIONS

- Residuals are sampled **with replacement**. When the residual set
  has discrete mass at the boundary (e.g., [-10,-10,0,10,10]),
  coverage at VaR_95 mirrors the left-tail mass of the residual
  empirical distribution (not the nominal 5%). This is documented in
  the test (D3) with explicit math.
- No covariance / copula modeling between multiple metrics.
- No autocorrelation structure in the residual draws (residuals are
  i.i.d. samples from the empirical distribution).
- Box-Muller discards one sample per call (acceptable for Monte
  Carlo; the marginals are still exact Gaussian).
- Sensitivity analysis reuses the same RNG draw across shock levels;
  this is the correct behavior (the base distribution should not be
  redrawn per shock level), but consumers must not interpret each
  `shockedValues` entry as a fresh Monte Carlo run.

---

## PRODUCTION DEFECTS FOUND AND FIXED

1. **MIN_RESIDUALS mismatch**: the original `MIN_RESIDUALS = 3`
   threshold conflicted with the Stage 07-E spec test for a
   2-residual distribution (`[-5, 5]`). Lowered to `2` so a
   two-point distribution is supported while still rejecting empty
   or single-residual inputs. Production behavior updated;
   corresponding test C3 was rewritten to use a 1-residual vector.

2. **TypeScript readonly assignment**: the first draft of
   `ScenarioEngine.runScenarios` had a return-type / local-array
   mismatch. Resolved by declaring the local array as
   `ScenarioResult[]` (mutable) and the function return type as
   `ReadonlyArray<ScenarioResult>` (frozen).

3. **PowerShell here-string quoting collision** when generating
   TypeScript files (apostrophe in `don'"'"'t`). Resolved by
   inlining the strings and replacing in-place where necessary.

---

## RE-AUDIT RESULT

- All 26 new tests pass.
- All 12 regression suites still pass (417/417 total).
- `tsc --noEmit` reports **no new errors** in any Stage 07-E file.
  Pre-existing errors in `templates/Engine.template.ts` and
  `Core/EngineDependencyVerifier.ts` are unrelated to Stage 07-E
  and were present before this stage began.
- No modifications to Stage 07-A/B/C/D code.
- No architecture, security, or governance changes.

---

## COMMIT SHA

_Filled in after commit._
