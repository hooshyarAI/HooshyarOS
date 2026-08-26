# Cline Agent Repair Drill

This is an isolated, non-production defect used only to prove the `ASSISTANT_REPAIR_MISSION_V1` execution loop.

## Mission
1. Run `node qa/agent-repair-drill/repair-target.cjs` and observe the controlled failure.
2. Diagnose the defect. The intended behavior is `net = revenue + expense`, where expense is negative in this fixture; the current implementation is intentionally wrong.
3. Make the smallest coherent repair in `qa/agent-repair-drill/repair-target.cjs`.
4. Re-run `node qa/agent-repair-drill/repair-target.cjs` and require exit code 0.
5. Run `npm test -- --runInBand`.
6. Run `npm run product:factory` and require `FINAL_PRODUCT_FACTORY ... stage: COMPLETE ... ok: true`.
7. Create `.hooshyar/agent-repair-success.json` with type `ASSISTANT_REPAIR_MISSION_V1_RESULT`, status `PASS`, the current commit SHA, a unique missionId, the finding and root cause, `repair.changedFiles >= 1`, `regression.status = PASS`, and `factoryAcceptance.status = PASS`.
8. Run `npm run product:agent:evidence` and require `status: PASS`.

Do not change production architecture or weaken tests for this drill. The drill is successful only when the repair is a real edit, regression passes, the commercial factory passes, and the evidence validator accepts the current commit.
