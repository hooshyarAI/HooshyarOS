"use strict";
const assert = require("node:assert/strict");
const { validateWork, workIdFromLeaseId } = require("./team-v2-admission.cjs");

const lease = {
  id: "work-0011-team-v2-memory-reconciliation",
  role: "Team V2 Memory & Evidence Reconciliation",
  focus: "memory reconciliation",
  owner: "MEMORY_EDITOR",
  mode: "AUDIT",
  write_scope: [".kilo/team/memory/", ".kilo/team/results/work-0011-team-v2-memory-reconciliation/"],
  dependencies: []
};
const base = {
  plan: { wave_status: "READY", leases: [lease] },
  registry: { items: [{ id: "WORK-0011", status: "READY", readiness: "READY", execution_attempts: [] }] },
  workId: "WORK-0011",
  leaseId: lease.id
};

assert.equal(workIdFromLeaseId(lease.id), "WORK-0011");
assert.deepEqual(validateWork(base), []);

const missing = structuredClone(base);
delete missing.plan.leases[0].role;
delete missing.plan.leases[0].focus;
const codes = validateWork(missing).map(x => x.code);
assert.ok(codes.includes("MISSING_ROLE"));
assert.ok(codes.includes("MISSING_FOCUS"));

const unresolved = structuredClone(base);
unresolved.registry.items[0].execution_attempts = [{ state: "EXECUTED_UNPROMOTED", promoted: false }];
assert.ok(validateWork(unresolved).some(x => x.code === "UNRESOLVED_PRIOR_ATTEMPT"));

const badReadiness = structuredClone(base);
badReadiness.registry.items[0].readiness = "";
assert.ok(validateWork(badReadiness).some(x => x.code === "REGISTRY_NOT_READY"));

const mismatch = structuredClone(base);
mismatch.workId = "WORK-0010";
assert.ok(validateWork(mismatch).some(x => x.code === "LEASE_ID_WORK_ID_MISMATCH"));

console.log("TEAM_V2_ADMISSION_TEST=PASS");
