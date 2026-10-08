"use strict";
const assert = require("node:assert/strict");
const { evaluateGate } = require("./team-v2-gate.cjs");

const ctx = {
  workId: "WORK-0011",
  leaseId: "work-0011-team-v2-memory-reconciliation",
  targetBranch: "fix/autonomous-product-factory",
  targetSha: "a".repeat(40),
  planSha256: "b".repeat(64),
  now: "2026-10-08T20:00:00Z"
};

const gate = { gate_id: "TEAM-V2-ACCEPTANCE", status: "ARMED", hold_after_pass: true };

assert.equal(evaluateGate(gate, null, ctx).code, "ACCEPTANCE_AUTHORIZATION_REQUIRED");

const auth = {
  authorization_id: "ACCAUTH-0001",
  scope: { wave_id: "WAVE-ACCEPT-0001", work_id: "WORK-0011", lease_id: ctx.leaseId, max_worker_reservations: 1 },
  bindings: { target_branch: ctx.targetBranch, target_sha: ctx.targetSha, plan_sha256: ctx.planSha256 },
  expiry: { not_after: "2026-10-08T21:00:00Z" },
  consumed: false
};
assert.equal(evaluateGate(gate, auth, ctx).decision, "ADMIT_ACCEPTANCE");
auth.consumed = true;
assert.equal(evaluateGate(gate, auth, ctx).code, "AUTHORIZATION_ALREADY_CONSUMED");

const drift = { ...auth, consumed: false, bindings: { ...auth.bindings, target_sha: "c".repeat(40) } };
assert.equal(evaluateGate(gate, drift, ctx).code, "AUTHORIZATION_BINDING_MISMATCH");

assert.equal(evaluateGate({ gate_id: "TEAM-V2-ACCEPTANCE", status: "RELEASED", hold_after_pass: false }, null, ctx).decision, "ALLOW_NORMAL");
console.log("TEAM_V2_GATE_TEST=PASS");
