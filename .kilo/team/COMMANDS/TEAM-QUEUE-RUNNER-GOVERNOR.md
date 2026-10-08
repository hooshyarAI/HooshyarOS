# TEAM QUEUE / RUNNER GOVERNOR

## Authority
The Team Manager / Mission Director owns GitHub Actions queue and runner governance.

## Mandatory pre-wave gate
Before accepting or launching a governed team wave:
1. Inspect active, queued and pending GitHub Actions runs.
2. Identify stale/duplicate CI and product-factory runs.
3. Preserve the single current governed Team V2 run.
4. Cancel obsolete runs using the GitHub Actions API with the repository GITHUB_TOKEN (actions: write).
5. Verify runner capacity is available for the governed wave.
6. Only then continue prepare -> qualification -> workers -> QC -> integration -> synthesis.

## Allowed cleanup scope
Obsolete runs from these legacy/high-noise workflows may be cancelled when they are not the current governed run:
- Final Product Factory
- Final Product Factory Trigger
- Autonomous CI Repair
- Autonomous Builder Audit
- Autonomous Builder Verification
- Autonomous Builder Validation
- HooshyarOS Validation
- HooshyarOS CI
- HooshyarOS Release Artifacts
- Android Release Verification
- Autonomous Platform Construction
- Autonomous Continuation Validation

Never cancel:
- the current HooshyarOS Autonomous Team Worker governed run
- a run explicitly marked as the current governed wave
- unrelated protected/production deployment workflows

## Operational policy
Queue cleanup is an execution-control responsibility, not a user responsibility.
No new team wave may be launched while an older governed wave is queued/running unless current mission state explicitly authorizes it.
