# WORK-0006 — Team V2 Performance Evaluation
## PRE-GATE BASELINE

STATUS = PRE_GATE_ONLY
GATE_RESULT = NOT_YET_ADJUDICATED
SOURCE = Wave 10 run 37743827267 + current control-plane evidence
NO_INFERENCE_FROM_WAVE_0011 = TRUE

## Measured baseline from Wave 10

- Worker leases: 12
- Successful worker jobs: 11
- Worker validation failure: 1
- Worker success rate: 11/12 = 91.7%
- Independent QC job: PASS
- Original Integrator job: FAIL due controlled target drift
- Recovery workflow: executed and preserved evidence
- Product implementation in the audit wave: correctly NONE
- Duplicate uncontrolled worker write-scope collisions: none identified in the V1 audit layout
- Architecture-governance worker failure: mechanical Markdown trailing-whitespace validation defect; evidence report itself was preserved
- Benchmark/quality evidence exposed material false-green and evidence-binding gaps; these are quality findings, not proof of worker dishonesty
- Real product advancement in this audit wave: intentionally 0 by mission design; the wave objective was reconciliation/audit

## Provisional Team V2 metrics

| Metric | Baseline | Confidence |
|---|---|---|
| Correct Throughput | 11 successful governed audit outputs / 12 leases | MEASURED |
| Worker Failure Isolation | 1 worker failed without invalidating 11 independent workers | MEASURED |
| Independent QC Acceptance | QC job PASS | MEASURED |
| Integration Conflict Rate | 1 wave-level integration block caused by controlled target drift | MEASURED |
| Recovery Capability | controlled recovery path executed/preserved evidence | MEASURED |
| Duplicate Work Rate | 0 observed within the disjoint V1 audit write model | PROVISIONAL |
| Regression Rate | not yet a Team-V2 performance metric from this wave | NOT_MEASURED |
| False-Green Rate | material harness false-greens discovered in quality/benchmark audits | MEASURED_FINDING, not aggregate numeric rate |
| Memory Accuracy | V2 memory was not yet operational during Wave 10 | NOT_MEASURED |
| Decision Reuse Rate | V2 decision registry was not yet operational during Wave 10 | NOT_MEASURED |
| Real Product Advancement | 0 by intentional reconciliation-only constraint | MEASURED |

## What this baseline proves

1. The worker-pool mechanism can execute multiple isolated audit leases concurrently.
2. Independent worker success can survive one worker-level failure.
3. Independent QC exists and can pass even when the original Integrator blocks.
4. Recovery is valuable and evidence-preserving.
5. The main remaining V2 question is not whether workers can run; it is whether Mission Director + Planner + Memory/Editor actually improve prioritization, deduplication, traceability, recovery and correct throughput.

## What this baseline does NOT prove

- It does not prove WAVE-0011 success.
- It does not prove Team Organization V2 acceptance.
- It does not prove memory backfill correctness.
- It does not prove automatic next-wave planning correctness.
- It does not prove product completion.
- It does not authorize WORK-0007.

## Gate A acceptance criteria for final adjudication

After WAVE-0011 closes, independently calculate:

- Correct Throughput
- Evidence Quality
- Duplicate Work Rate
- Regression Rate
- False-Green Rate
- Worker Failure Recovery Rate
- MTTR
- QC Acceptance Rate
- Integration Conflict Rate
- Real Product Advancement
- Blocked Work Age
- Decision Reuse Rate
- Memory Accuracy

Then return exactly one:

TEAM_V2_ACCEPTED
TEAM_V2_ACCEPTED_WITH_CONTROLLED_GAPS
TEAM_V2_BLOCKED

Final Gate A must consume actual WAVE-0011 evidence plus this preserved baseline; it must not erase or overwrite historical failure evidence.
