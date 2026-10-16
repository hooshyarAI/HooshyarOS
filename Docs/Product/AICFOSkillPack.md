# AI CFO Skill Pack

**Status:** PARTIAL / evidence-gated  
**Canonical selector:** `Backend/HBOS/Engines/KnowledgeEngine.ts`  
**Stable domain ID:** `ai-cfo-skill-pack`  
**Explicit selection signal:** `cfo-advisory`

## Architecture and ownership

This is a specialist skill pack registered in the existing KnowledgeEngine science catalogue. It is **not** a new engine, independent CFO agent, financial source of truth, or authorization authority. It preserves Architecture Freeze V4 and delegates calculations to their current canonical owners.

- **KnowledgeEngine:** selects domains from explicit machine-readable signals and returns each selected domain's owner, callable operations, readiness and limitations.
- **FinancialIntelligenceEngine:** financial calculations, liquidity and working-capital metrics, return and cost-of-capital calculations.
- **BudgetIntelligenceEngine:** explicit budget-versus-actual calculations and cost breakdown.
- **RiskIntelligenceEngine:** risk, sensitivity and scenario calculations.
- **FinancialStatementAnalysisService / AuditAnalyticsService:** analysis and control findings based on statement evidence.
- **Reasoning and Executive Intelligence:** remain the existing interpretation and executive-synthesis owners; this registry entry does not by itself prove automatic natural-language routing through every UI path.
- **Governance Engine:** retains policy, authorization, audit and consequential-action control.
- **Autonomous Operations Engine:** may follow through only through existing approved, governed workflows; this registration grants no execution permission.

## Skill coverage

| CFO skill | Existing operation owners |
|---|---|
| Financial performance and profitability | `FinancialIntelligenceEngine` |
| Working capital and liquidity | `FinancialIntelligenceEngine` |
| FP&A and budget variance | `BudgetIntelligenceEngine` |
| Cost-center/category variance | `BudgetIntelligenceEngine.analyzeCostBreakdown` |
| Scenario and sensitivity analysis | `RiskIntelligenceEngine` |
| Statement review and financial control indicators | `FinancialStatementAnalysisService`, `AuditAnalyticsService` |
| Capital allocation and investment appraisal | `FinancialIntelligenceEngine`, `RiskIntelligenceEngine`, existing `DecisionWorkbench` contracts |

## Selection and evidence contract

The existing `CognitiveOrchestrationService` maps its structured financial intents to CFO science signals, returns `scienceSelection` in the cognition result and supplies selected operations/limitations to the existing `IntelligenceEngine` reasoning context. This adds knowledge routing to the current brain; it does not add a sixth engine or execute a capability by declaration.

1. Use `cfo-advisory` for a structured CFO-style request; combine it with relevant signals such as `cash-flow`, `budget-planning`, `risk-assessment` or `internal-control`.
2. `planScienceSelection` returns the CFO pack and matched canonical domains; cross-cutting data-quality and reliability guardrails remain in the plan.
3. The pack remains **PARTIAL**. Selection is not execution, and a listed operation is not proof that an end-to-end CFO workflow is complete.
4. Distinguish verified actuals, estimates, assumptions and forecasts. Preserve source, reporting period, currency and limitations; stop or request review when those are inadequate.
5. Do not claim comprehensive compliance with current Iranian tax/accounting rules without maintained rule sources and dedicated tests. Do not trigger payments, transfers or other consequential financial actions without existing governance and authorization.
6. CFO selection is triggered by the existing structured financial intents (analysis, risk, profit change, product, scenarios, growth, resilience and data gaps). Proving every Persian/English natural-language phrasing and UI presentation remains an acceptance task; catalogue registration alone is not that proof.

## Verification

Focused tests: `Backend/HBOS/test/KnowledgeEngine.AICFOSkillPack.test.ts`

The tests cover stable registration, routing into existing financial/budget/risk/control domains, cross-cutting guardrails and fail-honest PARTIAL readiness.
