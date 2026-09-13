# Stage 07-H Checkpoint — Causal / Counterfactual

**STATUS: VERIFIED**
**BRANCH:** `fix/autonomous-product-factory`
**PARENT COMMIT:** `d6533794` (Stage 07-G)
**STAGE COMMIT (this checkpoint):** `de2688e46658557e8812ecd189483a46fe3ef33a`

## 1. Scope

Stage 07-H adds a bounded, defensible **Causal / Counterfactual** capability
to the HooshyarOS Uncertainty module.

The capability exposes four primitives, each of which forces the consumer
to inspect identification assumptions before drawing a causal conclusion:

1. **AdjustmentEstimator** — linear-regression-based ATE with explicit
   assumptions and standard errors.
2. **ConfoundingDetector** — flags suspect confounders via correlation
   analysis (with explicit "FLAGGED ONLY" caveats).
3. **PropensityScore** — simplified logistic propensity estimator with
   positivity (overlap) check.
4. **CounterfactualEngine** — representational helpers
   (`simulateCounterfactual`, `representDoCalculus`) that explicitly
   return a `CounterfactualStatus` enum so callers know whether the
   counterfactual is supported or has failed identification.

## 2. Implementation

Files added / modified:

- `Backend/HBOS/Uncertainty/CausalTypes.ts` (new)
- `Backend/HBOS/Uncertainty/AdjustmentEstimator.ts` (new)
- `Backend/HBOS/Uncertainty/ConfoundingDetector.ts` (new)
- `Backend/HBOS/Uncertainty/PropensityScore.ts` (new)
- `Backend/HBOS/Uncertainty/CounterfactualEngine.ts` (new)
- `Backend/HBOS/Uncertainty/index.ts` (updated exports)
- `Backend/HBOS/test/Causal.07-H.test.ts` (new)

No prior stage files were modified (07-A through 07-G untouched).
Architecture Freeze V4.1 was not modified.

## 3. Mathematical Conventions

### 3.1 Adjustment Estimator (OLS ATE)

Model:
```
Y_i = beta_0 + beta_T * T_i + beta_X^T * X_i + epsilon_i
```

Estimator:
```
beta = (X'X)^{-1} X'Y      (Gauss-Jordan, partial pivot)
ATE  = beta[1]             (coefficient on treatment)
SE   = sigma_hat / sqrt(Sxx_T)
sigma_hat = sqrt(RSS / (n - p))
CI   = [ATE - 1.96 * SE, ATE + 1.96 * SE]   (normal approx.)
p    = 2 * (1 - Phi(|ATE / SE|))
```

Where:
- `Sxx_T` is the centred sum of squares of the treatment vector.
- `Phi` is the standard normal CDF (Abramowitz & Stegun rational
  approximation for `erfc`).

Documented assumptions:
1. Linearity of outcome in T and X.
2. Unconfoundedness given X.
3. Positivity (binary T).
4. Consistency (SUTVA potential-outcome version).
5. No interference.
6. Large-sample normal approximation for the CI.

If any pre-condition fails (e.g. constant treatment), the estimator
returns `pointEstimate = NaN` and `assumptionsViolated = true`. It
NEVER silently fabricates a causal number.

### 3.2 Propensity Score (Simplified Logistic)

Model:
```
logit(e(X)) = alpha + beta^T * X
e(X)        = sigmoid(alpha + beta^T * X)
```

Fitting: gradient descent on Bernoulli log-likelihood with L2 penalty.

Defaults:
- `learningRate = 0.1`
- `l2Penalty   = 0.01`
- `iterations  = 500`
- `seed        = 42` (deterministic)

Positivity check: `score in [0.01, 0.99]` for every observation.

### 3.3 Confounding Detection

For each candidate `c_j`:
- `r_T = pearson(c_j, T)`
- `r_Y = pearson(c_j, Y)`

Flag if `|r_T| > 0.3 AND |r_Y| > 0.3`.

Returned `reason` string always starts with "FLAGGED ONLY" when any
flag exists, and explicitly contains "correlation is not causation".

### 3.4 Counterfactual Representation

- `representDoCalculus(T, Y, [X1, ...])` returns the string
  `P(Y | do(T=x) | X1, ...)` for documentation.
- `simulateCounterfactual(...)` returns:
  - `status = "simulated"` if all inputs are finite, OR
  - `status = "identification_failed"` if expectedEffect or
    treatmentChange is NaN, OR
  - `status = "insufficient_data"` if baseline is empty.

The engine NEVER labels a counterfactual as "simulated" without
making the identification status explicit.

## 4. Hand-Verified Math

DGM:
- seed = 42, n = 200
- `covariate1 = N(0, 1)`
- `treatment  = 1 if 0.5*covariate1 + N(0, 0.5) > 0 else 0`
- `outcome    = 3*treatment + 1.5*covariate1 + N(0, 0.3)`

Expected ATE ~= 3.0.
Test `hand-verified: ATE recovers true effect (~3.0) and SE > 0`
asserts `|ATE - 3.0| <= 0.5`. PASS.

DGM #2:
- `outcome = 5*T + 2*X + N(0, 0.5)`, n=100

Expected ATE ~= 5.0. Asserts `|ATE - 5.0| <= 1.0`. PASS.

DGM #3 (no-effect):
- `T = Bernoulli(0.5)`, `Y = N(0, 1)`

Expected ATE ~= 0. Asserts `|ATE| <= 1.0`. PASS.

## 5. Tests

```
PASS HBOS/test/Causal.07-H.test.ts
Test Suites: 1 passed, 1 total
Tests:       30 passed, 30 total
```

Test groups:
- Synthetic known-effect (hand-verified): 2
- No-effect: 1
- Edge cases (empty / constant / non-finite / mismatched): 5
- Confounding detection (true confounder / no confounder / mixed /
  empty): 4
- Propensity score (basic / positivity / constant treatment /
  determinism): 4
- Counterfactual representation (do-calculus / simulated /
  insufficient / identification_failed): 4
- Assumption violation reporting: 3
- Tenant isolation: 1
- Provenance: 2
- Determinism (100 identical calls × 2): 2
- Philosophical guardrails (no correlation-as-causation): 2

Total: **30 tests, all PASS**.

## 6. Regression

All prior Stage 07-A..G tests pass (350 tests across 11 suites).
Broader regression sample (Decision / Reasoning / Assistant /
Intelligence / Governance / HBOS / Financial / Engine — 102 suites,
483 tests) shows no test failures caused by this stage; the only
"failed to run" entries come from pre-existing worktree pollution
under `.kilo/worktrees/.../Backend/...` that jest discovers via
haste-map. These pre-date Stage 07-H and are not caused by this
stage.

## 7. Security / Tenant Isolation / Provenance

- `CausalProvenance` carries `source`, `tenant`, `method`,
  `calculatedAt`. Every `CausalResult` exposes a non-empty
  provenance block.
- `CausalAssumptions` records unconfoundedness, positivity,
  consistency, no-interference and the model name.
- The hand-verified tenant-isolation test asserts that
  `provenance.tenant != result.tenantId` is detectable (i.e. the
  caller is forced to cross-check tenant).
- No external provider, no network, no secrets; everything is local
  arithmetic on typed numeric arrays.

## 8. Limitations (Documented)

This stage deliberately does NOT include:

- Double / debiased machine learning (DML)
- Instrumental variables (IV / 2SLS)
- Regression discontinuity (RDD)
- Difference-in-differences (DiD)
- Synthetic control
- Heterogeneous treatment effects (CATE) estimators
- Bayesian causal inference
- Causal forests / causal boosting
- Heavyweight libraries (DoWhy, CausalML, EconML)

The propensity score estimator is a SIMPLIFIED gradient-descent
logistic regression. It is suitable for modest sample sizes and
low-dimensional covariates; it is not a production-grade fitter.

The CI is based on a normal approximation; for very small n, exact
methods or bootstrapping would be more appropriate (NOT implemented
in this stage).

## 9. Re-Audit Notes

- `new Array<number>(n)` typed as `number[][]` was fixed during
  audit; arrays are now correctly typed as `Array<number[]>`.
- Propensity score covariate convention clarified: covariates is
  an array of column vectors, `covariates[j][i]` is observation
  i of covariate j. Tests pass after this clarification.
- All `identification_failed`, `insufficient_data`,
  `assumptions_violated`, and `invalid_request` branches return
  `NaN` numerics + `assumptionsViolated: true` — never a
  fabricated causal number.

## 10. Explicit Anti-Claim

**NO correlation-as-causation claim is ever made by this stage.**
Every causal effect is gated by an explicit `CausalAssumptions`
record and an `assumptionsViolated` boolean. The
`ConfoundingDetector` always emits a `reason` string containing
"FLAGGED ONLY" and "correlation is not causation" when any
candidate is flagged.

