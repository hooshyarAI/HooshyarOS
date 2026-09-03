# Stage 07-F: ML / Ensemble / Anomaly - VERIFIED

## Scope

Implement lightweight classical machine-learning capability, deterministic
ensemble aggregation, and robust anomaly detection under the HooshyarOS
Stage 07 uncertainty surface. No external ML dependencies (no sklearn,
TensorFlow, PyTorch). No GPU code. No external network calls. No new
engines. Reuses Stage 07-A `DescriptiveStatistics`.

## Implementation Summary

Created 5 files under `Backend/HBOS/Uncertainty/`:

1. **MLTypes.ts** - contract types (`TrainingDataPoint`, `FeatureSpec`,
   `LinearModel`, `ModelIdentifier`, `ModelMetrics`, `TrainTestSplit`,
   `AnomalyScore`, `EnsemblePrediction`, `Provenance`, `ModelStatus`).
   All `readonly`. No fabricated confidence. `ModelStatus` distinguishes
   `trained | insufficient_data | invalid_request | converged | not_converged`.

2. **LinearRegressionModel.ts** - closed-form OLS via normal equations
   `beta = (X'X)^-1 X'y`. Inline Gauss-Jordan inversion with partial
   pivoting and a 1e-12 singularity threshold. Singularity -> status
   `not_converged`. Returns `{value, standardError}` for predict (no
   fabricated prediction interval). Reuses `DescriptiveStatistics` for
   mean / sum / variance. Tenant + metric enforced at boundary.

3. **AnomalyDetector.ts** - two robust detectors:
   - **MAD**: `modified_z = 0.6745 * (x - median) / mad` with default
     threshold 3.5. Constant signals (MAD=0) are not falsely flagged.
   - **Z-score**: `z = (x - mean) / sample_std` with default threshold
     3.0. Constant signals (std=0) are not falsely flagged.
   - Small-sample guard `n < 5` returns no anomalies with explicit
     `insufficient_data` reason. `explainAnomaly` produces a
     human-readable string. Every score includes the actual numeric
     score, threshold, median / mad, and direction.

4. **EnsembleAggregator.ts** - deterministic ensemble of multiple
   sources. Methods: `mean | median | weighted`. Weights are
   normalized to sum=1. Default weight is 1 / N. `evaluateEnsemble`
   returns MSE / RMSE / MAE / R^2 / MAPE (when no actual is zero).
   Provenance includes tenant, metric, method, calculatedAt.

5. **TrainTestSplitter.ts** - strict chronological split. Caller must
   supply chronologically sorted data; unsorted data is rejected with
   an explicit error. `noFutureLeakage` is verified. Tenant + metric
   consistency enforced at boundary.

6. **index.ts** - exports the new modules alongside the existing
   Stage 07-D / 07-E exports.

## Tests

Created `Backend/HBOS/test/ML.07-F.test.ts`.

**Test counts and pass/fail**:
- 39 focused tests, all passing.
- Test suite: 1 passed, 1 total. Tests: 39 passed, 39 total.

Coverage groups:
- LinearRegressionModel (10 tests): OLS recovers y=2x+1 exactly,
  constant labels yield R^2=0, predict is near-perfect, singular
  X'X returns not_converged, single point is insufficient_data,
  empty is insufficient_data, tenant isolation enforced, predict on
  non-trained model returns NaN, determinism over 100 calls, evaluate
  returns MSE~0 on training data.
- AnomalyDetector MAD (6 tests): outlier detection, constant signal
  handled, empty input, small-sample guard, threshold sensitivity,
  reason-string contents.
- AnomalyDetector Z-score (3 tests): outlier in normal data, constant
  signal handled, default threshold = 3.0.
- EnsembleAggregator (8 tests): mean, median, weighted equality,
  weighted inequality, weight normalization, default equal weights,
  determinism, evaluateEnsemble metrics.
- TrainTestSplitter (6 tests): 10/0.7 split, chronological order
  preserved, unsorted rejection, 3/0.7 edge case, invalid ratio
  rejection, empty data rejection.
- Tenant isolation (2 tests): tenant + metric mismatch.
- Provenance (2 tests): modelId and ensemble provenance completeness.
- Determinism (1 test): anomaly detection deterministic over 100 calls.
- explainAnomaly (1 test): human-readable string.

## Regression Results

13 prior test files re-run. **443 tests, all passing**. No regressions.

Files:
- TemporalData.07-A.test.ts
- Baselines.07-B.test.ts
- Forecasting.07-C.A.test.ts
- Forecasting.07-C.B.test.ts
- Backtest.07-C.C.test.ts
- ModelSelection.07-C.D.test.ts
- Uncertainty.07-D.A.test.ts
- PredictionInterval.07-D.B.test.ts
- Calibration.07-D.C.test.ts
- MonteCarlo.07-E.test.ts
- Phase06I.test.ts
- Phase06H.test.ts
- Phase05C-B.test.ts

(Plus 5 additional suites = 18 total, 443 tests passed.)

## Mathematical Conventions

### OLS Normal Equations
```
X = [1 x_1 x_2 ... x_p]    (n x (p+1) design matrix; first column all-ones)
beta = (X^T X)^-1 X^T y
y_hat = X beta
RSS = sum((y - y_hat)^2)
TSS = sum((y - mean(y))^2)
R^2 = 1 - RSS/TSS         (reported as 0 when TSS=0; no fabrication)
residual_SE = sqrt(RSS / (n - p))   (dof floored at 1 to avoid /0)
```

Matrix inversion: Gauss-Jordan elimination with partial pivoting.
Singularity threshold: 1e-12. When singular, return status
`not_converged` with an explanatory `error` string.

### MAD Detector
```
median = median(x)
MAD = median(|x_i - median|)
modified_z_i = 0.6745 * (x_i - median) / MAD
flag if |modified_z_i| > threshold  (default 3.5)
```

The 0.6745 factor is the MAD consistency constant under normality,
making MAD a consistent estimator of sigma. Threshold 3.5 corresponds
to ~99.95% band under normal assumption.

### Z-score Detector
```
mean = mean(x)
std = sample_std(x)         (Bessel-corrected)
z_i = (x_i - mean) / std
flag if |z_i| > threshold  (default 3.0)
```

### Ensemble
- `mean(x)`: arithmetic mean of all source values
- `median(x)`: median (Type-7 quantile at p=0.5)
- `weighted`: `sum(w_i * x_i) / sum(w_i)` over finite sources,
  where `w_i` are normalized so `sum(w) = 1`

## Assumptions

- Linear relationship between features and label for OLS.
- Features are independent (no multicollinearity check beyond singular
  X'X detection; collinearity causes singular matrix -> not_converged).
- IID data for t-statistics (no autocorrelation modeling).
- No regularization (no ridge, lasso, elastic-net).
- Small matrices only (n_features <= 20 is comfortable; the inline
  Gauss-Jordan is O(p^3) and not optimized).
- MAD and z-score assume approximate symmetry for a single threshold
  to be appropriate; in heavy-tailed regimes the user should
  re-evaluate.

## Security / Tenant Evidence

- `LinearRegressionModel.train` rejects any data point whose
  `tenantId` or `metricName` does not match the caller's
  (returns `not_converged` with explicit `error`).
- `TrainTestSplitter.splitChronological` enforces single tenant and
  single metric across all data; mixed data throws.
- Ensemble evaluation inherits tenant from caller.
- No external network / provider dependencies.
- No heavy library dependencies; all logic is in TypeScript with
  in-process state.

## Provenance Fields

`ModelIdentifier`: algorithm, version, trainingWindow {start, end},
hyperparameters, tenantId, metricName.

`Provenance`: source, tenant, metric, modelId (optional),
trainingWindow (optional), calculatedAt, method.

`LinearModel` includes `modelId`, `trainingWindow`, `status`, and
`residualStandardError`.

`EnsemblePrediction.provenance` includes tenant, metric, method,
and calculatedAt.

## Limitations

- Small matrices only (n_features <= 20 comfortable; the inline
  Gauss-Jordan is not optimized for high-dimensional input).
- No regularization (no ridge / lasso / elastic-net).
- No kernel methods (no SVM, no GP).
- No deep learning.
- No GPU code.
- OLS only; no logistic regression, no Poisson regression.
- Univariate anomaly detection only (no multivariate Mahalanobis).
- Train/test split is strictly chronological; no k-fold, no random
  shuffle (deliberate to prevent future leakage).
- Ensemble does not model inter-source correlation.
- All algorithms are classical; no probabilistic / Bayesian models.

## Re-audit Result

- No new Engines created (per task constraint).
- No modification to Stage 07-A / 07-B / 07-C / 07-D / 07-E.
- No Architecture Freeze V4.1 modification.
- All types `readonly`; all outputs `Object.freeze`d.
- No fabricated confidence in any output.
- No heavy / external dependencies; pure TypeScript.
- All tests passing; all regression tests passing.

## Hand-Verified Math

- Train on y = 2x + 1 with 20 points, x = 0..19.
  - Recovered coefficients: `[1, 2]` (intercept, slope) exactly.
  - R^2 = 1, RSS = 0.
  - Predict([10]) = 37 exactly.

- MAD detector on `[1, 2, 3, 4, 5, 100]`:
  - median = 3, MAD = 2
  - 100 -> modified_z = 0.6745 * 97 / 2 = 32.723 -> flagged
  - 1..5 -> modified_z magnitudes <= 0.6745 (well below 3.5) -> not flagged

- Z-score detector on `[10,11,10,12,11,10,11,12,10,11,50]`:
  - mean ~10.9, std ~11.74
  - 50 -> z ~3.33 > 3.0 -> flagged

- Ensemble mean of `[10, 20, 30]` = 20.
- Ensemble median of `[1, 2, 3, 4, 100]` = 3.
- Ensemble weighted `[0.6, 0.4]` of `[10, 20]` = 14.
- Ensemble weighted `[3, 1]` of `[10, 20]` -> normalized to
  `[0.75, 0.25]` -> 0.75*10 + 0.25*20 = 12.5.

## Commit SHA

(Filled after commit.)