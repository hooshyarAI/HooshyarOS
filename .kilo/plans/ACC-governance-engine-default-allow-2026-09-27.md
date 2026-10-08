# ACC ITEM — `GovernanceEngine` FAIL-OPEN DEFAULT (NO POLICY MATCHED ⇒ ALLOW)

Status: **REQUIRES_ARCHITECTURE_CHANGE_CONTROL**
Date: 2026-09-27
Branch: `fix/autonomous-product-factory`
HEAD at authoring: `6c0742da`
Model: `deepseek/deepseek-flash` (no Pro model)
Author: Kilo (bounded execution layer) — no code change made for this item

## CURRENT STATE
`Backend/HBOS/Engines/GovernanceEngine.ts::determineOutcome` (lines 303–329) resolves an
action as `ALLOWED` when **no governance policy matched** the request:

```
// No policies matched - action is allowed by default
if (effects.length === 0) {
  return this.buildAllowedResult(traceId, inputHash, request);
}
```

The engine holds `private policies: GovernancePolicy[] = []` (line 137). On a fresh boot, or
whenever the installed policy set does not match a request, the default outcome is ALLOW
(fail-open). DENY and REVIEW_REQUIRED only apply when a matching policy produced that effect.

## CONFLICTING IMPLEMENTATION / CONSUMERS
- The engine's own tests (`GovernanceEngine.test.ts`, `GovernanceEngine.06-F.test.ts`,
  `GovernanceEngine.phase-11-1.6.test.ts`) pin concrete outcomes; the fail-open default is
  implicitly part of the verified contract.
- `AutonomousOperationsEngine` and the commercial runtime consume governance decisions; a
  change of default affects the whole decision surface.
- The default is a **security posture** ("deny by default" vs "allow unless denied"), which is
  an architectural decision owned by the Governance Charter, not by an execution operator.

## ARCHITECTURAL IMPACT
- FAIL-OPEN is a genuine governance/security concern: an action with no installed policy is
  permitted rather than deferred to review or denied.
- Changing the default to DENY or REVIEW_REQUIRED is a behavior change to a **frozen engine
  contract** and would cascade to every consumer and test that assumes ALLOWED on no match.
- Whether the correct posture is DENY, REVIEW_REQUIRED, or explicit "no applicable policy"
  labelling is a governance decision, not an implementation convenience.

## PROPOSED TARGET (for governance decision — not executed)
1. Introduce an explicit, governed default posture (recommended: `REVIEW_REQUIRED` for
   privileged/decision actions and `DENY` for destructive/financial actions), configured by
   the Governance Charter rather than hard-coded.
2. Distinguish "no policy installed/matched" from "policy allowed" in the result so audits can
   tell fail-open from explicit approval.
3. Keep `buildAllowedResult` reachable only when an explicit ALLOW policy matched.

## MIGRATION RISK
- Medium–High: touches `GovernanceEngine.ts` and at least three governance test suites plus
  every consumer that relies on the no-match ALLOW path; requires a policy bundle to be
  installed so legitimate actions are not newly blocked.

## TESTS REQUIRED BEFORE ACCEPTANCE
- New test: no matching policy ⇒ the configured default posture (not silent ALLOW).
- New test: an explicit ALLOW policy still yields ALLOWED.
- Reconfirmation of `GovernanceEngine.test.ts`, `GovernanceEngine.06-F.test.ts`,
  `GovernanceEngine.phase-11-1.6.test.ts`.
- Integration: the commercial runtime's privileged actions still succeed under the installed
  governance policy bundle.

## REASON ACC IS REQUIRED
This changes the default governance **posture** of a frozen engine and its verified contract
surface. It must not be changed silently by the bounded execution operator.

## DECISION
No change performed. Preserved for Architecture Change Control. Construction continues with
safe non-ACC work (already: additive trust assessment, two-path independent validation).
