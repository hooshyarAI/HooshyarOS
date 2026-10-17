# HooshyarOS Engineering Memory — Current Operating Rules

## Governing authority
- Follow `Docs/HOOSHYAROS_MASTER_CHARTER.md`, `Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md`, `Docs/ARCHITECTURE.md` (Freeze V4.1), and the active mission/checkpoint. Repository evidence is authoritative; chat memory supplements it.
- Preserve the five canonical intelligence engines and existing ownership. No sixth engine, duplicate domain owner, or redesign without the formal approved change process.
- Every capability/change requires design, implementation, focused test, review, evidence, and commit. One gap/owner/change/test/evidence/verification at a time.

## Operating constraints
- Avoid broad repeated scans, redundant reports, blind retries, and asking the owner to repeat known preferences. Resume from the latest trusted checkpoint and run delta audits only when new evidence warrants them.
- Keep Kilo as a bounded local operator for this cycle. Do not start OpenCode, Team V2, or worker dispatch, even where older mission fields describe a historical bootstrap step.
- Never change `main`, force-push, weaken security/tenant isolation, or weaken the fail-closed financial classification gate. Do not modify `FinancialDataIngestionAdapter` absent explicit evidence and approval.
- Do not build the final Windows installer or sync the user's PC with GitHub until all remaining audits/edits are complete, focused and integration tests have evidence, independent QC is done, and every required qualification-matrix cell is PASS.

## Current recovery state (2026-10-17)
- Phase 00 charter/memory/architecture reconciliation is checkpointed in `Docs/HOOSHYAROS_POST_RECOVERY_AUDIT_RECONCILIATION_2026-10-16.md` on branch `audit/post-recovery-reconciliation-2026-10-16`.
- Draft PR #142 / commit `e85c9a1e34f90d1ed623530e2acb03dfaa2c5e75` adjusts three acceptance fixtures to pass explicit revenue/expenses and correct expected profit. Runtime/Jest acceptance has NOT yet been executed; do not mark the fix or release verified.
- The baseline science registry has 33 domains: 22 PARTIAL, 11 REGISTERED_ONLY, 0 EXECUTABLE. Selection metadata does not prove full cognition/runtime integration; do not add domains merely to hit 50.
- Evolution remains unverified: `Backend/AI_Runtime/evolution/evolution_engine.py` is a placeholder echo, not a proven closed loop.
- `Docs/Product/PRODUCT_QUALIFICATION_MATRIX.json` remains `productComplete=false`; Windows packaging is blocked.

## Required next sequence
1. Verify PR #142's three focused acceptance paths and record real CI/runtime evidence; preserve the fail-closed API contract.
2. Continue evidence-backed audits/repairs for science-to-cognition integration and evolution/metacognition, then remaining integration/security/performance/reporting/product qualification gates.
3. Run independent QC and require every qualification-matrix cell to PASS.
4. Only after all audits/edits and gates pass, plan the final Windows build; only after that may local PC and GitHub be deliberately synchronized.
5. Benchmark identical non-confidential test cases against DeepSeek and Claude, preserving outputs and a fair scoring rubric.
