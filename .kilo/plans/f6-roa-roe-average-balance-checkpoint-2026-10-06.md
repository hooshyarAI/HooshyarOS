QUALITY_CHECKPOINT_STAGE = 1
QUALITY_CHECKPOINT_ID = f6-roa-roe-average-balance
QUALITY_CHECKPOINT_DATE = 2026-10-06
QUALITY_CHECKPOINT_DESCRIPTION = F6 ROA/ROE average-balance methodology implementation and verification
STATUS = VERIFIED
ROOT_CAUSE = The original profitability() and duPont() methods only used ending balances. F6 requires AVERAGE_BALANCE when prior-period evidence exists for both current and prior assets/equity independently, with ENDING_BALANCE_FALLBACK otherwise. DuPont requires both average assets AND average equity.
EXACT_FILES =
- Backend/HBOS/Product/RatioAnalysisService.ts
- Backend/HBOS/test/RatioAnalysisService.test.ts
ROA_AVERAGE_EVIDENCE = Test "profitability uses average balances when prior statement is provided for ROA and ROE" passes: current totalAssets=300, prior totalAssets=100 => avgAssets=200, ROA=40/200=0.2, methodology=AVERAGE_BALANCE
ROA_FALLBACK_EVIDENCE = Test "profitability preserves ending-balance behavior when no prior statement provided" passes: no prior statement => ROA=60/300=0.2, methodology=ENDING_BALANCE_FALLBACK. Also test "profitability uses average for ROA when prior assets exist, ending for ROE when prior equity missing" shows ROA uses average when prior assets exist (0.3) even when ROE falls back.
ROE_AVERAGE_EVIDENCE = Test "profitability uses average balances for ROE when prior statement equity is provided" passes: current equity=180, prior equity=120 => avgEquity=150, ROE=30/150=0.2, methodology=AVERAGE_BALANCE
ROE_FALLBACK_EVIDENCE = Test "profitability uses average for ROA when prior assets exist, ending for ROE when prior equity missing" passes: prior equity missing => ROE=60/200=0.3 (ending equity), methodology=ENDING_BALANCE_FALLBACK
INDEPENDENT_BASIS_BEHAVIOR = Verified: ROA and ROE decisions are independent. When prior totalAssets exists but prior equity missing: ROA uses AVERAGE_BALANCE (0.3), ROE uses ENDING_BALANCE_FALLBACK (0.3). Methodology correctly reports ENDING_BALANCE_FALLBACK because not all ratios use average.
DUPONT_DIRECT_ROE_RECONCILIATION = Test "profitability DuPont reconciliation with average balances" passes: direct ROE=100/150=0.666..., DuPont ROE=0.1*2.5*(400/150)=0.666..., both methodology=AVERAGE_BALANCE, equal within tolerance.
123_XLSX_RESULT = Test "real benchmark from 123.xlsx uses average balances when prior statement provided" passes: endingAssets=32244256, priorAssets=14709294 => avgAssets=23476775, ROA=7250000/23476775≈0.308816; endingEquity=14836839, priorEquity=8749389 => avgEquity=11793114, ROE=7250000/11793114≈0.614766. Ending-balance ROA≈0.2248, ROE≈0.4886 are correctly NOT used.
CCC_REGRESSION_STATUS = NOT_REGRESSED - CCC is owned by FinancialIntelligenceEngine, not modified by F6. FinancialWorkingCapitalIntegration tests fail due to pre-existing FinancialDecisionNarrativeService.ts issues (F1), not F6.
UX_REGRESSION_STATUS = NOT_ASSESSED - Unified UX tests not run as part of F6. F6 is backend ratio methodology only.
CHART_AUDIT_STATUS = NOT_ASSESSED - Chart visualization not part of F6.
REMAINING_GAPS = None for F6. All acceptance criteria verified.