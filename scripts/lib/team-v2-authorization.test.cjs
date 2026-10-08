"use strict";
const assert = require("node:assert/strict");
const { validateAuthorization, hashPayload } = require("./team-v2-authorization.cjs");

const ctx = {
  workId: "WORK-0011",
  leaseId: "work-0011-team-v2-memory-reconciliation",
  targetBranch: "fix/autonomous-product-factory",
  targetSha: "a".repeat(40),
  planSha256: "b".repeat(64),
  now: "2026-10-08T20:00:00Z"
};

const auth = {
  schema: "team-v2.acceptance-authorization.v1",
  authorization_id: "ACCAUTH-0001",
  gate_id: "TEAM-V2-ACCEPTANCE",
  scope: {
    wave_id: "WAVE-ACCEPT-0001",
    work_id: ctx.workId,
    lease_id: ctx.leaseId,
    task_class: "MEMORY",
    max_worker_reservations: 1,
    max_candidate_failovers: 3
  },
  bindings: {
    plan_sha256: ctx.planSha256,
    lease_sha256: "c".repeat(64),
    target_branch: ctx.targetBranch,
    target_sha: ctx.targetSha,
    policy_sha256: "d".repeat(64)
  },
  expiry: { not_after: "2026-10-08T21:00:00Z" },
  consumed: false
};

assert.deepEqual(validateAuthorization(auth, ctx), []);
assert.equal(hashPayload(auth).length, 64);

const consumed = structuredClone(auth);
consumed.consumed = true;
assert.ok(validateAuthorization(consumed, ctx).some(x => x.code === "AUTHORIZATION_ALREADY_CONSUMED"));

const drift = structuredClone(auth);
drift.bindings.target_sha = "e".repeat(40);
assert.ok(validateAuthorization(drift, ctx).some(x => x.code === "AUTHORIZATION_TARGET_SHA_MISMATCH"));

const wrongWork = structuredClone(auth);
wrongWork.scope.work_id = "WORK-0010";
assert.ok(validateAuthorization(wrongWork, ctx).some(x => x.code === "AUTHORIZATION_WORK_MISMATCH"));

console.log("TEAM_V2_AUTHORIZATION_TEST=PASS");
