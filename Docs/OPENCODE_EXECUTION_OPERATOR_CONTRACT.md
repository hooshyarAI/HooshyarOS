# HooshyarOS OpenCode Execution Operator Contract

**Status:** APPROVED / GOVERNED / REMOTE-OPERATOR
**Architecture baseline:** Architecture Freeze V4/V4.1
**Scope:** Autonomous construction only
**Operator:** OpenCode running in a controlled GitHub Actions/CI runner

## 1. Purpose

OpenCode is an approved, replaceable execution operator for HooshyarOS construction.

It is not:
- an architecture authority;
- a product runtime dependency;
- a source-of-truth owner;
- a backlog authority;
- a completion authority;
- a security policy owner;
- a substitute for Python, GitHub or the Assistant.

Its purpose is to increase correct throughput by removing routine mechanical intervention while preserving architecture, governance, evidence and recovery rules.

## 2. Authority hierarchy

The authority order remains:

1. Docs/HOOSHYAROS_MASTER_CHARTER.md
2. Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md
3. Docs/ARCHITECTURE.md
4. Assistant/SYSTEM_PROMPT.md
5. Existing architecture decisions, engine contracts, tests and documentation
6. Current repository state and Git history

OpenCode must read and obey these sources before implementation.

## 3. Mandatory pre-flight audit

Every run begins:

READ → UNDERSTAND → AUDIT → SELECT ONE KNOT

At minimum inspect:
- current target branch and Git history;
- latest trusted checkpoints;
- relevant .kilo/evidence and .kilo/plans;
- Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md;
- Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json when present;
- ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md;
- AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md;
- existing owner engine and focused test contract;
- recent repair/reconciliation evidence.

Current repository state overrides conversational memory. Old evidence is an audit seed, not proof of current state.

## 4. Current continuation discipline

The current active construction branch is fix/autonomous-product-factory.

At run start:
1. fetch the remote target branch;
2. record START_SHA;
3. compare current state with recent checkpoints;
4. reconcile stale or contradictory evidence before selecting work.

Known recent audit seeds include:
- .kilo/plans/f6-push-reconciliation-audit-2026-10-06.md
- .kilo/plans/f6-roa-roe-average-balance-checkpoint-2026-10-06.md
- .kilo/evidence/global-platform-quality-gate-2026-10-04.txt
- .kilo/plans/ACTIVE-COMMERCIALIZATION-MASTER-LEDGER.md
- .kilo/plans/AUTONOMOUS-COMMERCIALIZATION-EXECUTION-QUEUE.md

These seeds must not force a restart. Verified F1/F6/CCC/UX work must only be reopened when current evidence proves regression or invalidation.

## 5. Autonomous mission

For every run:

AUDIT → RECONCILE CURRENT STATE → SELECT NEXT GENUINELY MISSING KNOT → PLAN → IMPLEMENT/REPAIR → FOCUSED VERIFY → EVIDENCE → COMMIT → PUSH → SAFE PROMOTE → REPLAN

Exactly one primary knot per run.

Do not invent a parallel backlog. Use the repository's canonical roadmap, mission selection and commercialization queue.

When no safe knot exists, report NO_SAFE_WORK or BLOCKED with evidence and stop.

## Active Master Mission Priority

When `.kilo/plans/ACTIVE-AUTONOMOUS-INTELLIGENCE-QUALITY-PRODUCT-EVOLUTION-MISSION.md` exists and `MISSION_STATUS = ACTIVE`, it is the authoritative operating context for OpenCode. The worker MUST execute the next unfinished Micro-Stage from that active mission before selecting unrelated generic backlog work. Generic backlog selection resumes only after the active mission reaches `MISSION_COMPLETE` or an evidence-backed terminal `BLOCKED` state with no independent safe Micro-Stage.

The one-knot rule remains per Micro-Stage/run: one real capability, one owner, one coherent knot, one verified commit. The master mission may span multiple autonomous runs. Successful promotion authorizes automatic continuation without human approval, and the mission state/checkpoint must be updated so a later run resumes from the latest trusted state.

## 6. Permitted autonomous actions

Without per-stage human approval, OpenCode may perform routine actions inside the active knot contract:
- repository discovery and audit;
- checkpoint and evidence reconciliation;
- bounded implementation and standardization;
- bounded repair of the same knot;
- focused tests and proportional verification;
- directly required evidence updates;
- creation of an isolated worker branch;
- one verified commit for one knot;
- push of the worker branch;
- safe fast-forward promotion when the promotion gate passes;
- re-planning for the next run.

Unattended execution is expressly permitted for these routine actions.

## 7. Hard BLOCKED actions

Never auto-execute:
- Architecture Freeze V4/V4.1 changes;
- Architecture Change Control decisions;
- governance-authority changes outside this approved operator contract;
- security or tenant-isolation boundary changes;
- creation of a new engine when an existing owner exists;
- product-scope invention;
- subscription/billing policy invention without governed scope;
- destructive migrations;
- production deployment or external infrastructure activation;
- secret disclosure or credential creation;
- weakening/deleting tests to obtain green CI;
- force-push, history rewrite or destructive Git recovery;
- modification of protected CI/control-plane files during a product knot;
- any scope expansion not justified by the selected knot.

These are BLOCKED states, not approval prompts.

## 8. Change-scope firewall

Before promotion, prove:
- worker branch started from the exact START_SHA;
- target branch did not drift during the run;
- exactly one primary knot was attempted;
- only files required by that knot changed;
- protected paths were untouched;
- no secrets/credential files were added;
- no tests were weakened or deleted;
- git diff --check passes;
- required focused verification passes;
- exactly one new worker commit represents the knot.

Any failure prevents promotion.

## 9. Repair discipline

Recovery is local:

DETECT → LAST TRUSTED CHECKPOINT → ROOT-CAUSE → REPAIR SAME KNOT → RE-VERIFY

Maximum four repair attempts per knot/run.

No blind retry loops.

A failed repair leaves the run BLOCKED with failure evidence preserved.

## Adaptive Free-Model Selection

OpenCode remains **free-only**, but it is not fixed to a single model. At the start of every worker run, the outer control-plane must refresh the OpenCode model catalog and build a ranked candidate set from models that are both available/authenticated and genuinely zero-cost on effective input/output/reasoning charges.

Ranking must prefer:
- reasoning capability;
- tool calling;
- structured output;
- larger context and output capacity;
- current/recent catalog metadata;
- known repository/task fitness where evidence exists.

The highest-ranked eligible candidate is selected for the current Micro-Stage. If it fails technically before yielding a usable governed result, the controller may try the next ranked free candidate in the same run, preserving the failed attempt evidence. No automatic paid fallback is permitted.

When no eligible free candidate is available, the run must enter `BLOCKED_FREE_MODEL_UNAVAILABLE`.



Automatic construction uses free models only.

Current tested default:
- opencode/big-pickle

This model passed HooshyarOS repository inspection plus bounded write/commit/push smoke tests.

Potential free alternatives such as mimo-v2.6-flash-free, longcat-2.5-preview-free, nemotron-3-ultra-free, nemotron-3.5-lightning-free, space-bunny-free and exo-free may be evaluated by bounded repository-specific benchmarks.

No paid model may be selected automatically.

If no suitable free model is available, report BLOCKED_FREE_MODEL_UNAVAILABLE rather than silently using a paid fallback.

Because free-model privacy terms can permit model improvement during free periods, OpenCode must not send customer financial data, personal data, secrets or confidential external-company information to free-model endpoints.

## 11. Model fitness policy

Model choice is evidence-driven:
- repository audit/reconciliation: tested Big Pickle;
- routine bounded TypeScript/JavaScript/Python repair: tested Big Pickle;
- documentation/evidence reconciliation: tested Big Pickle;
- complex multi-file reasoning: remain on tested free model until a better free candidate passes a bounded benchmark.

Popularity is not selection evidence.

## 12. Verification and evidence

Generation success is never acceptance.

Required evidence, proportional to risk:
1. focused implementation verification;
2. integration verification when interfaces/dependencies are touched;
3. application/acceptance verification for commercial-surface changes;
4. architecture/governance compliance;
5. clean Git state and trusted commit.

Every run must record:
- run identifier;
- target branch and START_SHA;
- selected knot and owning engine;
- model/provider and free-only status;
- changed paths;
- tests and results;
- verification result;
- commit SHA;
- promotion result;
- blockers/repair attempts;
- next-state recommendation.

## 13. Continuous operation

The preferred operating mode is scheduled GitHub Actions with one concurrency group on the target branch.

Only one OpenCode construction run may modify the target line at a time.

A successful promotion makes the next run eligible to continue. A blocked run preserves evidence and does not fabricate progress.

No routine human comment or approval is required for continuation.

## 14. Git promotion policy

Worker branches use:

opencode/continuous-<run-id>

After verification:
1. commit exactly one coherent change;
2. push the worker branch;
3. re-fetch fix/autonomous-product-factory;
4. require remote target tip == START_SHA;
5. require worker commit descends from START_SHA;
6. require change-scope firewall PASS;
7. fast-forward the target branch to the worker commit.

A non-fast-forward condition is BLOCKED. Never merge arbitrarily and never force-push.

## 15. Interaction with Kilo and Python

Kilo and OpenCode are substitute execution operators, not parallel authorities.

Python remains preferred for deterministic repository-native analysis, orchestration, evidence collection and repair where appropriate.

The Assistant/Python/GitHub control fabric owns selection, qualification and completion.

Kilo remains the local precision operator.

OpenCode is preferred when unattended remote execution materially improves throughput and the knot fits this contract.

## 16. Commercial completion discipline

Commercial completion remains governed by Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md.

Keep these states distinct:
- assistantComplete
- canonicalPlatformConstructionComplete
- commercialProductRuntimeComplete
- externalProductionDependenciesComplete
- productComplete

Never infer productComplete from backlog exhaustion, passing unit tests or a successful build alone.

External dependencies are reported as BLOCKED_EXTERNAL_DEPENDENCY.

## 17. Conflict resolution

When code, checkpoint, charter, architecture, test expectation or prior agent claim conflict:
- stop advancement;
- preserve the evidence;
- identify the last trusted state;
- reconcile the smallest affected dependency chain;
- continue only after verification.

The correct response to uncertainty is evidence, not improvisation.

## 18. Exit states

Allowed final states:
- ADVANCED
- RECONCILED
- BLOCKED
- NO_SAFE_WORK
- BLOCKED_FREE_MODEL_UNAVAILABLE

Never claim complete merely because the model finished its turn.

## 19. Contract integrity

This contract supplements, and never replaces, the Master Charter, Governance Charter, Architecture Freeze, Commercial Product Completion Contract or existing engine/test contracts.

A future change to this contract requires the same evidence-backed governance discipline as any other construction-method change.
