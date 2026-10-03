HOOSHYAROS — END-TO-END INTELLIGENCE / REASONING / DECISION QUALITY REPAIR
==========================================================================

REPOSITORY
- Path: D:\HooshyarOS
- Branch: fix/autonomous-product-factory
- Start from the CURRENT HEAD. Reconcile git status and origin first.
- Model: deepseek/deepseek-flash
- DeepSeek V4.1 Flash only. Never use Pro.
- Use the Kilo default agent. Do not specify an alternate agent.

MISSION
The Windows installer is now working. Do NOT touch installer/productization work
unless a proven dependency makes it unavoidable.

The installed HooshyarOS UI is running, but the PRODUCT INTELLIGENCE itself is
currently weak/incomplete. The repair must make the platform behave according to
the governing charter, architecture, engines, decision logic and product
philosophy — not merely look better.

FIRST — GOVERNING RECONCILIATION
Read before editing:
- Master Charter
- Governance Charter / Commercial Contract
- Architecture Freeze V4/V4.1
- official engine definitions
- relevant product/decision/financial/workspace/offline contracts
- latest .kilo plans/reports
- current tests around financial insights, reports, assistant, decision support,
  analytics, resilience, impact, improvement, workspace and offline behavior.

Preserve the official engine architecture:
Reasoning
Governance
Executive Intelligence
Organizational Intelligence
Autonomous Operations

Do not create duplicate pseudo-engines, generic text-generation substitutes,
or parallel decision engines when an existing governed engine/service already
owns the capability.

NO REBUILDING COMPLETED WORK
Do not redo/revert:
- PDF/XLSX financial ingestion
- source trust implementation
- independent validation primitives
- Persian-first presentation layer
- offline snapshot functionality
- Windows installer / Inno Setup
- Android work
unless a CURRENT verified regression proves one is broken.

USE THE CURRENT USER OUTPUT AS A GOLDEN FAILURE CASE

The current interface/output showed these concrete problems:

1. The financial result exposes numbers but does not produce the expected
   managerial reasoning.
2. "نقاط قوت" is empty.
3. "نقاط ضعف" is effectively empty.
4. "ریسک‌ها" is effectively empty.
5. "فرصت‌ها و رشد" is empty.
6. "اقدامات پیشنهادی" is nearly empty.
7. The user asked:
   "برای رشد وتوسعه و افزایش تاب آوری چه پیشنهادی داری در سه سناریو بگو"
   but the answer repeated raw financial metrics instead of delivering three
   explicit decision scenarios.
8. The user asked:
   "مهم‌ترین ریسک مالی من چیست؟"
   but the system again returned the same generic metric bundle instead of
   identifying the evidence-backed risk drivers and explaining why they matter.
9. The visible value "32,129,418,000,000" differs from another displayed
   value "32,129,400,000,000". The canonical source/value binding must be traced
   and one authoritative value must be used consistently.
10. "ریسک بدهی 53.986%" is presented as if the ratio itself were a risk.
    A ratio is a fact/indicator; risk interpretation requires context,
    thresholds, trend, exposure, or another justified decision rule.
11. The page says "تحلیل موفق ... ۰ تراکنش ... وضعیت READY". This must be checked
    against the real meaning of READY. If no transaction records were extracted,
    the product must not imply successful transaction-level analysis.
12. Internal technical identifiers leak into normal user text:
    e.g. preTaxIncome, taxes, Revenue minus سود خالص.
13. A derived residual expense burden is shown as if it were useful accounting
    output although it is not an extracted accounting total.
14. Repeated identical questions produce effectively identical numeric context
    instead of context-aware answers.
15. The system claims "تحلیل جامع" while major semantic sections are empty.
16. The visible UI has advanced tools, but the actual answer path does not appear
    to activate the appropriate decision/reasoning/orchestration capabilities.

CORE PRODUCT RULE
The platform must move from:
    SOURCE -> NUMBERS -> GENERIC SUMMARY
to:
    USER INTENT
      -> CONTEXT / EVIDENCE
      -> CORRECT ENGINE / SERVICE ROUTING
      -> CANONICAL CALCULATION
      -> VALIDATION / RECONCILIATION
      -> REASONING
      -> INTERPRETATION
      -> OPTIONS / SCENARIOS
      -> DECISION CRITERIA
      -> ACTIONS
      -> FEEDBACK / FOLLOW-UP
      -> EVIDENCE + LIMITATIONS

A user asking a question must receive an answer to THAT QUESTION.

STAGE 1 — TRACE REAL REQUEST ROUTING
Audit the complete request path:
- chat input
- intent detection
- context selection
- source selection
- financial insight selection
- reasoning/orchestration
- decision support
- response composition
- UI rendering

For representative questions:
A. "مهم‌ترین ریسک مالی من چیست؟"
B. "برای رشد و توسعه و افزایش تاب‌آوری در سه سناریو پیشنهاد بده."
C. "این صورت مالی را تحلیل کن."
D. "چرا سود تغییر کرده؟"
E. "چه چیزی کم است؟"

Trace exactly which engines/services are invoked and which are NOT invoked.

Fix routing if the answer path is bypassing existing governed capabilities.

Do not invent an LLM-only fallback when deterministic/domain engines already provide
the required capability.

STAGE 2 — CANONICAL DATA / NUMERIC INTEGRITY
Audit the complete path from ingestion to presentation.

Ensure:
- one canonical source value per metric;
- same value everywhere unless explicitly showing a separately derived value;
- unit, currency and scale are preserved;
- no silent rounding changes create contradictions;
- extracted vs derived vs interpreted values remain distinct;
- missing data stays missing;
- zero transactions does not become implicit transaction analysis;
- READY / PARTIALLY_AVAILABLE / QUARANTINED / NOT_TESTABLE semantics are truthful.

Specifically investigate the income discrepancy:
32,129,418,000,000 vs 32,129,400,000,000.

Also verify:
- 53.986% debt ratio presentation;
- operating-profit reconciliation difference;
- pre-tax and net-profit validation gaps;
- cash-flow reconciliation;
- derived residual "Revenue minus net profit".

Do not "fix" discrepancies by rounding them away. Find the real source of the
difference.

STAGE 3 — FINANCIAL ANALYSIS QUALITY
The financial analysis must produce meaningful content when evidence supports it.

Populate, through existing governed logic/services:
- strengths
- weaknesses
- risks
- opportunities / growth
- management actions

Rules:
- every statement must be traceable to evidence or clearly labeled inference;
- no invented market/competitor/customer facts;
- no generic filler;
- no empty headings when enough evidence exists;
- if evidence is insufficient, explain exactly what is missing;
- financial ratios are indicators, not automatically risks;
- risk claims require an explicit evidence-based rationale.

Use trends and relationships already available:
- revenue growth
- gross-profit growth
- operating-profit behavior
- net-profit behavior
- debt growth vs asset/equity growth
- operating cash flow
- investing/financing cash flow
- liquidity indicators
- reconciliation issues
- data completeness/trust state

Turn these into concise managerial implications.

STAGE 4 — QUESTION-SPECIFIC REASONING
Make each user query drive a distinct answer structure.

For "مهم‌ترین ریسک مالی من چیست؟":
Return:
- key risk driver(s)
- evidence
- trend
- why it matters
- confidence / limitation
- what to monitor
- recommended action
Do not simply repeat the debt ratio.

For "چرا سود تغییر کرده؟":
Explain the contribution chain from revenue, gross margin, operating costs,
operating profit and other available drivers, while separating verified facts
from inference.

For "چه چیزی کم است؟":
Return data gaps, validation gaps and operational gaps separately.

For "تحلیل کن":
Return a coherent management-oriented synthesis, not a raw metric dump.

STAGE 5 — THREE-SCENARIO DECISION SUPPORT
For:
"برای رشد و توسعه و افزایش تاب‌آوری در سه سناریو پیشنهاد بده"

Use the existing governed decision/scenario capability if available.

Produce exactly three materially different scenarios, with clear labels and
logic, for example only if supported by the existing product semantics:
- محافظه‌کارانه
- متوازن
- تهاجمی

For each scenario include:
- objective
- main assumptions
- key actions
- expected operational/financial direction
- principal risks
- early-warning indicators
- decision criteria
- what additional evidence is required

Do not fabricate future numeric outcomes.
Do not silently predict markets, competitors or sales.
Where quantitative modeling is possible from available data, use the existing
engines and identify assumptions explicitly.

STAGE 6 — DECISION -> EXECUTION
Ensure an important recommendation can flow coherently into:
- decision
- responsible owner
- due date
- KPI
- target
- actual
- feedback
using existing governed organizational execution capabilities.

The UI must not show an execution card that contains placeholders such as
"مسئول: — | موعد: —" as though the execution plan were complete.

STAGE 7 — PERSIAN-FIRST USER SURFACE
Normal users should NOT see:
- preTaxIncome
- taxes
- balance-sheet-identity
- raw endpoint/engine names
- raw JSON
- internal class names
- raw English accounting debug text

Translate technical limitations into useful Persian language.

Technical evidence can remain available via progressive disclosure.

STAGE 8 — TRUST / VALIDATION / DUAL VALIDATION
Preserve current trust and dual-validation mechanisms.

For important outputs:
- show whether the result is evidence-backed;
- show reconciliation status;
- show independent validation status when genuinely available;
- never fabricate a second path;
- never use "validated" when the underlying path is not testable.

Do not overstate "confidence".

STAGE 9 — WORKSPACE / CONVERSATION CONTINUITY
A repeated question with the same context should still be interpreted against its
own intent.

History must preserve:
- question
- answer
- source/context
- relevant decision/action state

Avoid dumping the same underlying context object for every question.

STAGE 10 — TEST-DRIVEN GOLDEN CASES
Add focused regression tests for the actual observed failures.

At minimum create/extend tests for:
1. numeric canonical consistency;
2. empty analytical sections;
3. risk question semantic answer;
4. three-scenario question semantic answer;
5. why-profit-changed question;
6. data-gap question;
7. no false risk label from ratio alone;
8. no internal key leakage;
9. READY semantics with zero extracted transactions;
10. derived residual labeling;
11. trust + dual validation propagation;
12. decision -> execution continuity where supported.

Use real existing fixtures from the repository.
Do not fabricate a new financial dataset merely to make tests pass.

STAGE 11 — REAL END-TO-END VERIFICATION
After focused repairs:
- run focused tests first;
- run a representative end-to-end conversation test through the actual current
  runtime;
- use the available financial fixture(s), including the currently used 123.xlsx
  only if it exists in the repository/runtime environment;
- verify the actual rendered user-facing answer, not just backend objects.

IMPORTANT:
Do NOT spend time on a broad full-regression run until the representative
product behavior is demonstrably correct.

After product behavior is corrected, run the appropriate broader regression and
record any environment/load timeout honestly.

GOVERNANCE
- PLAN -> EXECUTE -> VERIFY -> CHECKPOINT.
- One feature -> one class -> one test -> one commit where practical.
- Preserve Architecture Freeze V4/V4.1.
- No silent architecture changes.
- No duplicate engine creation.
- Existing correct implementations must be reused.
- Do not weaken tests.
- Do not turn PARTIAL/BLOCKED/NOT_TESTABLE into PASS by wording.
- Do not claim productComplete unless evidence proves it.

FINAL DELIVERABLE
Create:
.kilo/plans/product-intelligence-quality-repair-report-2026-09-27.md

Report:
- root causes
- affected user journeys
- exact files changed
- exact commits
- focused tests
- end-to-end golden-case results
- remaining ACC/PARTIAL/BLOCKED items
- final LOCAL HEAD
- final ORIGIN HEAD
- git status

Commit and push only verified changes.

FINAL ACCEPTANCE CRITERIA
The platform must visibly demonstrate that:
1. Questions receive question-specific answers.
2. Financial analysis contains meaningful strengths/weaknesses/risks/opportunities
   when evidence supports them.
3. Three-scenario requests return three actual scenarios.
4. Risk questions explain risk drivers rather than merely restating ratios.
5. Numeric values are canonical and consistent.
6. Missing/invalid evidence is explicit.
7. Internal technical jargon is hidden from normal users.
8. Recommendations connect to decision and execution when supported.
9. Existing governed engines are actually used rather than bypassed.
10. The result reads like a decision-support platform, not a raw calculator/debug UI.
