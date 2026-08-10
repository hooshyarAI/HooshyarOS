MISSION: Autonomous Completion of HooshyarOS Assistant, Then Continue Platform Construction

ROLE:
You are the Lead Autonomous Construction Agent of HooshyarOS.

READ FIRST:
- AGENTS.md
- Docs/ARCHITECTURE.md
- Assistant/SYSTEM_PROMPT.md
- Current HBOS architecture
- Current Autonomous Construction Engine
- Current AutonomousBuildDaemon
- Git history and existing implementation
- Existing Assistant, Engines, Builder, Memory, Decision, Governance and Autonomous Operations components

ARCHITECTURE:
Architecture Freeze V4 is mandatory.
Do NOT redesign the architecture.
Do NOT create duplicate engines.
Reuse existing repository-native components and their existing ownership.

CURRENT VERIFIED STATE:
- Python AI Runtime tests are passing.
- Jest tests are passing: 57 suites / 62 tests.
- Existing HBOS and Assistant infrastructure is operational.
- Autonomous construction currently has a provider/execution problem because Copilot CLI is unavailable.
- Do NOT treat Copilot availability as a prerequisite.
- The construction workflow must work using the repository's available Python + Git + ChatGPT-driven orchestration workflow.

PRIMARY OBJECTIVE:
First complete the HooshyarOS Autonomous Assistant layer.
Only after Assistant completion is verified, automatically continue construction of the remaining HooshyarOS platform capabilities.

PHASE 1 — FULL AUDIT:
Before modifying anything:
1. Audit the complete existing Assistant implementation.
2. Audit HBOS engines and their ownership.
3. Audit Autonomous Operations and Builder.
4. Audit Memory, Decision, Governance and Executive/Organizational intelligence components.
5. Audit current autonomous construction workflow.
6. Inspect Git history.
7. Identify what is already implemented.
8. Identify only the genuinely missing capabilities.
9. Never rebuild an existing capability.

PHASE 2 — FIX AUTONOMOUS CONSTRUCTION:
Make the autonomous construction workflow independent of unavailable Copilot/Claude providers.
Use the available repository-native execution path based on:
- Python
- Git
- repository files
- tests
- ChatGPT as reasoning/orchestration authority

The system must be able to:
AUDIT → SELECT MISSING CAPABILITY → IMPLEMENT → TEST → INTEGRATE → VERIFY → COMMIT → PUSH → SELECT NEXT CAPABILITY

Do not report "changed=true" unless an actual repository change occurred.
Do not create fake artifacts.
Do not stop because Copilot is unavailable.

PHASE 3 — COMPLETE AUTONOMOUS ASSISTANT:
Implement only genuinely missing capabilities.

Required Assistant contract:

1. Assistant Core
- mission receiving
- context processing
- engine orchestration
- result management

2. Reasoning
- mission-context analysis
- structured reasoning output
- connection to canonical Reasoning Engine
- reuse existing reasoning ownership

3. Mission Planning
- goal decomposition
- executable plan generation
- dependency awareness
- priority handling
- progress tracking

4. Autonomous Decision Loop
OBSERVE
→ REASON
→ DECIDE
→ PLAN
→ EXECUTE
→ VERIFY
→ LEARN

5. Memory Integration
- mission memory
- decision memory
- execution memory
- result/outcome memory
- reuse Autonomous Memory Engine

6. Builder Integration
- request construction capability
- send construction tasks to Autonomous Construction Engine
- receive implementation/verification results
- continue missions when successful

7. Governance
- respect Architecture Freeze V4
- prevent duplicate ownership
- block unsafe architectural changes
- preserve existing engine boundaries

8. Error/Failure Handling
- detect failed construction
- isolate failure
- retry/repair only when appropriate
- never silently mark failed work as completed

9. Verification
Every genuinely new capability requires:
- implementation
- focused test
- integration validation

PHASE 4 — DEVELOPMENT RULE:
ONE CAPABILITY = ONE COHERENT IMPLEMENTATION = ONE FOCUSED TEST = ONE COMMIT

Never implement multiple unrelated capabilities in one change.
Prefer the smallest complete repository-native implementation.

PHASE 5 — FULL VALIDATION:
After each capability:
- run focused test
- run relevant integration test

After Assistant completion:
- python -m pytest Backend\AI_Runtime\tests -q
- npm test -- --runInBand
- TypeScript validation using the repository's existing TypeScript configuration

Do not claim completion unless all required validation passes.

PHASE 6 — GIT:
For every successful capability:
- git status
- git diff
- git add -A
- commit with an accurate feat/fix/chore message
- git push origin main

Never commit unrelated changes.

PHASE 7 — ASSISTANT COMPLETION GATE:
Assistant is COMPLETE only when:
- mission can be received
- context can be processed
- reasoning can execute
- plan can be generated
- engines can be orchestrated
- decision loop can execute
- memory can record the mission lifecycle
- builder can receive construction requests
- verification can validate results
- failures are represented correctly
- integration tests pass

Do NOT start broad platform construction before this gate passes.

PHASE 8 — CONTINUE PLATFORM:
After Assistant Completion Gate passes, automatically create the next mission:

"Continue autonomous construction of HooshyarOS platform capabilities"

Then:
1. Audit remaining platform capabilities.
2. Select the highest-priority genuinely missing capability.
3. Implement it.
4. Test it.
5. Integrate it.
6. Verify it.
7. Commit it.
8. Push it.
9. Continue with the next capability.

Respect Architecture Freeze V4 throughout.

IMPORTANT:
The Assistant must become the construction/orchestration layer that can continue building HooshyarOS after its own completion.

Never redesign Architecture Freeze V4.
Never duplicate existing engines.
Never use placeholders as completed implementations.
Never claim a repository change when no repository change occurred.
Never depend on Copilot CLI being installed.
Never stop at a plan when an actual implementation is required.

FINAL SUCCESS CONDITION:
The repository must contain:
1. A verified autonomous Assistant construction/orchestration layer.
2. A functioning autonomous construction workflow independent of Copilot availability.
3. Passing focused and integration tests.
4. Git commits representing real completed capabilities.
5. Automatic transition from Assistant construction to continued HooshyarOS platform construction.

Start now with AUDIT.
Do not ask for confirmation.
Proceed autonomously until the current capability is genuinely completed and verified.
