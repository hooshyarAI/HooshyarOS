# POST-TEAM V2 — PERFORMANCE EVALUATION → REMAINING-STAGE AUDIT / EDIT / REPAIR

**Command ID:** COMMAND-0001  
**Program:** PROGRAM-0001  
**Mission:** MISSION-0001  
**Precondition:** WAVE-0011 / Team Organization V2 bootstrap wave CLOSED + independent QC PASS + integration/promotion verified  
**First work:** WORK-0006  
**Second work:** WORK-0007

## GOVERNED COMMAND

Execute the following sequence strictly from repository truth:

```text
READ CHARTER
→ READ GOVERNANCE
→ READ ARCHITECTURE FREEZE V4/V4.1
→ READ ACTIVE MISSION
→ READ TEAM V2 PROTOCOL + MANIFEST
→ READ PERSISTENT MEMORY
→ READ GIT HISTORY / CURRENT TARGET STATE
→ RECONCILE
→ EVALUATE TEAM PERFORMANCE
→ GATE
→ AUDIT ALL REMAINING STAGES
→ DEDUPLICATE
→ EDIT MEMORY / PLANS / CONTROL DOCUMENTS
→ REPAIR ONLY EVIDENCE-BACKED GAPS
→ FOCUSED VERIFY
→ INDEPENDENT QC
→ INTEGRATE / PROMOTE
→ MEMORIZE
→ REPORT
→ REPLAN
```

## SOURCE-OF-TRUTH ORDER

Use, in order:

1. `Docs/HOOSHYAROS_MASTER_CHARTER.md`
2. `Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md`
3. `Docs/ARCHITECTURE.md`
4. `Assistant/SYSTEM_PROMPT.md`
5. `.kilo/plans/ACTIVE-AUTONOMOUS-INTELLIGENCE-QUALITY-PRODUCT-EVOLUTION-MISSION.md`
6. `.kilo/team/TEAM-ORGANIZATION-V2.json`
7. `.kilo/team/TEAM-ORGANIZATION-V2-PROTOCOL.md`
8. `.kilo/team/memory/*.json`
9. `.kilo/team/NEXT-WAVE-PLAN.json`
10. Git history, current branch state, tests, runtime/application/acceptance evidence.

Repository evidence outranks conversational recollection.

## GATE A — TEAM V2 PERFORMANCE EVALUATION

Create `.kilo/team/results/work-0006-team-performance-evaluation/result.md`.

Measure at minimum:

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

Also evaluate:

- Did every worker obey its lease?
- Did workers stay within write scopes?
- Was independent QC genuinely independent?
- Were failed/stalled workers preserved rather than hidden?
- Did Recovery preserve valid evidence?
- Did Planner/Editor prevent duplicate work?
- Did the team use memory to make the next decision?
- Did the team distinguish code existence from runtime/integration verification?
- Were model-selection failures separated from product failures?
- Did the team create any unnecessary work, duplicate abstraction or architecture drift?

Classify every finding as:

```FACT / ASSUMPTION / HYPOTHESIS / MEASURED RESULT / DECISION
```

### Gate A decision

Only these outcomes are allowed:

```TEAM_V2_ACCEPTED
TEAM_V2_ACCEPTED_WITH_CONTROLLED_GAPS
TEAM_V2_BLOCKED
```

Do **not** begin WORK-0007 unless Gate A is ACCEPTED or ACCEPTED_WITH_CONTROLLED_GAPS and no P0 governance/evidence defect prevents safe continuation.

## GATE B — REMAINING-STAGE AUDIT

After Gate A, construct the complete remaining-stage inventory from Charter + Mission + Git + Memory.

At minimum audit:

### P0
Recovery / control plane / evidence integrity / security / harness / false-green.

### P1
Semantic Synthesis  
Contextual Interpretation  
Financial Causal Reasoning  
Cross-Metric Relationship Analysis  
Scenario Interpretation  
Risk Interpretation  
Decision Formation  
Action Recommendation  
Outcome Measurement  
Learning  
123.xlsx benchmark fidelity and real-runtime reasoning composition.

### P2
Report quality  
Persian-first presentation  
Provenance continuity  
Chart gate  
Unknown/missing-data discipline  
Progressive disclosure.

### P3
Flow Optimization  
Performance Management  
Process Architecture Optimization  
Cross-domain information continuity.

### P4
Commercial / application / production readiness.

For each stage classify:

```
EXISTS
PARTIAL
BEHAVIORALLY_VERIFIED
INTEGRATION_VERIFIED
GENUINELY_MISSING
STALE
SUPERSEDED
BLOCKED
REGRESSION
DUPLICATE
```

## DEDUPLICATION LAW

Before proposing work, search memory + Git + evidence for:

```
EXISTS / DONE / VERIFIED / IN_PROGRESS / BLOCKED
/ SUPERSEDED / DUPLICATE / REGRESSION
```

Never reopen accepted F1/F6/CCC/UX work without current regression or invalidation evidence.

Never create a new Engine when composition/integration of an existing Engine is the actual gap.

## EDIT LAW

The Memory & Editor role may:

- consolidate duplicate records;
- link old/new work IDs;
- mark stale/superseded evidence;
- correct factual inconsistencies when supported by repository evidence;
- update plans, registries and reports;
- preserve historical evidence.

It may not:

- rewrite failed technical evidence into success;
- delete failure history;
- manufacture test/runtime/acceptance proof;
- change architecture authority;
- silently change product semantics.

## REPAIR LAW

For each genuinely missing or regressed capability:

```
DETECT
→ PRESERVE EVIDENCE
→ TRUSTED CHECKPOINT
→ ROOT CAUSE
→ MINIMAL REPAIR
→ FOCUSED TEST
→ RUNTIME / APPLICATION VERIFICATION
→ INDEPENDENT QC
→ INTEGRATE
→ PROMOTE
→ MEMORIZE
```

One real capability = one owner = one coherent commit.

No speculative rewrites. No test weakening. No blind retry.

## INTELLIGENCE-BRAIN PRIORITY

The team must explicitly determine whether the remaining financial-intelligence weakness is:

```
MISSING CAPABILITY
quad	ext{or}quad
EXISTS BUT NOT COMPOSED / NOT RUNTIME INTEGRATED
```

Do not add an engine if existing Reasoning / Financial Intelligence / Decision / Governance / Memory / Knowledge capabilities already cover the required semantic step and the defect is composition.

Target reasoning chain:

```
DATA
→ CONTEXT
→ RELATIONSHIPS
→ CAUSES
→ INTERPRETATION
→ RISK
→ DECISION
→ ACTION
→ OUTCOME
→ LEARNING
```

No fabricated causal explanation when evidence is insufficient.

## REQUIRED OUTPUTS

The team must persist:

1. Team V2 performance evaluation.
2. Complete remaining-stage audit matrix.
3. Deduplication / overlap matrix.
4. Architecture-capability-dependency-evidence graph update.
5. Corrected Work Registry.
6. Updated Decision / Defect / Blocker / Evidence ledgers.
7. Evidence-backed repair queue.
8. Next-wave plan with only dependency-ready work.
9. Independent QC report.
10. Executive + technical report.
11. Final mission-state update.

## NEXT-WORK SELECTION

Use:

**VALUE × RISK × DEPENDENCY × READINESS × SPEED**

The next work must be the highest-value genuinely missing/regressed capability whose dependencies and evidence contract are satisfied.

If no safe work remains, set the governed state to COMPLETE.

If a shared dependency or governance contradiction blocks safe work, set BLOCKED and preserve the blocker.

## HUMAN INTERVENTION

Ask the human only for:

- external credentials;
- legally binding / production decisions;
- business/commercial decisions requiring owner authority;
- unresolved architecture/governance contradiction.

Routine audit, editing, repair, verification, integration, reporting and continuation remain autonomous.

## FINAL ANTI-FALSE-GREEN RULE

Never report:

```
"COMPLETE"
```

because:

- a file exists;
- a worker says it is done;
- a unit test is green;
- a plan was written;
- a commit exists.

Completion requires evidence across the applicable layers:

```
UNIT + INTEGRATION + RUNTIME/APPLICATION + ACCEPTANCE
```

and independent QC plus remote promotion evidence where applicable.
