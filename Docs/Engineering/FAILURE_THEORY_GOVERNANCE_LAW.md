# HooshyarOS Failure-Theory Governance Law

Status: **GOVERNING / FAIL-CLOSED**

## Purpose

HooshyarOS MUST treat failure as a first-class object in every material computation, analysis and decision. A result is not considered reliable merely because the calculation completed, the analysis produced text, or a decision rule returned an answer.

The platform must explicitly model what can fail, how likely failure is, how severe its consequence is, how exposed the system is, how uncertain the estimate is, how detectable the failure would be, and how reversible the consequence is.

## Mandatory laws

1. **Failure-first law** — Before a material computation, analysis or decision is accepted, identify its material failure modes and the consequences of being wrong.
2. **Uncertainty law** — Material numeric inputs MUST carry uncertainty/bounds when the source or measurement warrants them. A point estimate MUST NOT be presented as certainty when the underlying evidence is uncertain.
3. **Error-propagation law** — Computations MUST propagate material input uncertainty into an output bound or explicitly report that the bound is unavailable. Hidden precision is not evidence of accuracy.
4. **Worst-case law** — Decisions MUST evaluate an upper-bound/downside case in addition to expected loss. A favorable expected value cannot override an unacceptable downside.
5. **Sensitivity law** — Material decisions SHOULD identify which assumptions or inputs most affect the conclusion. If a small plausible change reverses the decision, the result is unstable and MUST be marked accordingly.
6. **Detectability law** — Failure modes that are difficult to detect after deployment receive higher operational priority than equally severe failures that are immediately observable.
7. **Reversibility law** — When two options have comparable expected value, prefer the option with lower irreversible downside and a safer rollback/recovery path.
8. **Confidence law** — Evidence confidence is a decision input, not decoration. Low-confidence evidence cannot silently produce a high-confidence conclusion.
9. **Contradiction law** — Contradictory evidence, missing critical evidence, or an invalid uncertainty bound MUST produce `BLOCKED` rather than a fabricated conclusion.
10. **Risk-budget law** — Every material decision MUST be evaluated against an explicit risk budget supplied by the owning capability. The platform MUST NOT invent a universal business risk threshold.
11. **Mitigation law** — When risk is material but reducible, the preferred action is mitigation followed by re-analysis, not blind acceptance or automatic rejection.
12. **Fail-closed decision law** — If the worst-case downside exceeds the owning risk budget, or required evidence is missing/contradictory, the decision MUST be `BLOCKED` or `REJECTED` according to the owning contract.
13. **Evidence hierarchy law** — Observed runtime/black-box evidence outranks integration evidence, which outranks unit evidence, which outranks source/documentation evidence. Failure-theory calculations cannot promote weak evidence into strong evidence.
14. **Independent verification law** — The component that performs a computation, analysis or decision MUST NOT be the sole authority for declaring the resulting risk assessment verified when an independent deterministic observation is available.
15. **Repair feedback law** — Observed failures MUST feed the canonical repair/recovery loop. Repeated failure increases recurrence exposure and MUST affect prioritization.
16. **No false precision law** — Risk scores, probabilities and confidence values MUST retain their provenance and scale. A normalized number without a defined meaning is not a valid risk assessment.
17. **Proportionality law** — Verification depth and failure analysis effort MUST scale with severity, business impact, recurrence, uncertainty, exposure and irreversibility.
18. **Decision traceability law** — Material decisions MUST preserve the assumptions, failure modes, uncertainty, expected loss, worst-case loss, risk budget, mitigation and evidence used to reach the decision.

## Canonical evaluation model

For a material option:

```text
EXPECTED_LOSS = P(failure) × IMPACT × EXPOSURE
WORST_CASE_LOSS = P_upper × IMPACT_upper × EXPOSURE_upper
UNCERTAINTY_PREMIUM = WORST_CASE_LOSS − EXPECTED_LOSS
```

The platform MUST keep the two quantities separate. The expected loss answers **"what is the expected downside?"**; the worst-case bound answers **"what downside remains plausible under the declared uncertainty?"**.

A decision is stable only when its conclusion remains valid under the declared uncertainty range and sensitivity analysis. Otherwise it is `UNSTABLE` and must be mitigated, re-measured or blocked according to the owning contract.

For computation, the platform should propagate interval/bound information where practical:

```text
INPUT BOUNDS → COMPUTATION → OUTPUT BOUNDS → SENSITIVITY → ACCEPT / FLAG / BLOCK
```

For analysis:

```text
OBSERVATIONS → FAILURE MODES → CONFIDENCE → COUNTERFACTUAL / WORST CASE
→ SENSITIVITY → CONCLUSION + LIMITATIONS
```

For decisions:

```text
OPTIONS → EXPECTED LOSS → WORST CASE → REVERSIBILITY → DETECTABILITY
→ RISK BUDGET → MITIGATION → DECISION → TRACEABLE EVIDENCE
```

## Operational status semantics

- `SAFE` — evidence and uncertainty support the conclusion within the owning risk budget.
- `MITIGATE` — material risk exists but a bounded mitigation can reduce it before acceptance.
- `UNSTABLE` — plausible uncertainty can change the conclusion; more evidence or a safer option is required.
- `REJECTED` — the option violates a non-negotiable constraint or exceeds an explicit hard risk boundary.
- `BLOCKED` — required evidence, bounds, provenance or independent verification is unavailable or contradictory.

Failure theory is therefore not a separate advisory feature. It is a mandatory control layer for trustworthy calculation, analysis, repair and decision-making across HooshyarOS.
