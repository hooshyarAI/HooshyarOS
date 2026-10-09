"use strict";
const assert = require("node:assert/strict");
const { admissionViolations, workIdFromLeaseId } = require("./team-v2-dispatch-authority.cjs");

const base = () => ({
  gate: { gate_id: "TEAM-V2-ACCEPTANCE", status: "RELEASED", hold_after_pass: false },
  plan: { wave_status: "READY", leases: [{
    id: "work-0011-team-v2-memory-reconciliation",
    role: "Team V2 Memory & Evidence Reconciliation",
    focus: "memory reconciliation",
    owner: "MEMORY_EDITOR",
    mode: "AUDIT",
    task_class: "MEMORY",
    write_scope: [".kilo/team/memory/", ".kilo/team/results/work-0011-team-v2-memory-reconciliation/", ".kilo/team/results/work-0006-team-performance-evaluation/PRE-GATE-BASELINE.md"],
    dependencies: []
  }]},
  registry: { items: [{ id: "WORK-0011", status: "READY", readiness: "READY", execution_attempts: [] }] }
});

assert.equal(workIdFromLeaseId("work-0011-team-v2-memory-reconciliation"), "WORK-0011");
assert.equal(admissionViolations(base()).length, 0);

{
  const f=base(); f.gate={gate_id:"TEAM-V2-ACCEPTANCE",status:"ARMED",hold_after_pass:true};
  assert.ok(admissionViolations(f).some(v=>v.code==="ACCEPTANCE_AUTHORIZATION_REQUIRED"));
}
{
  const f=base(); delete f.plan.leases[0].role; delete f.plan.leases[0].focus;
  const codes=admissionViolations(f).map(v=>v.code);
  assert.ok(codes.includes("MISSING_ROLE")); assert.ok(codes.includes("MISSING_FOCUS"));
}
{
  const f=base(); f.registry.items[0].readiness="";
  assert.ok(admissionViolations(f).some(v=>v.code==="REGISTRY_NOT_READY"));
}
{
  const f=base(); f.registry.items[0].execution_attempts=[{state:"EXECUTED_UNPROMOTED",promoted:false}];
  assert.ok(admissionViolations(f).some(v=>v.code==="UNRESOLVED_PRIOR_ATTEMPT"));
}
{
  const f=base();
  f.plan.wave_status="DRAFT";
  f.registry.items[0].readiness="";
  const codes=admissionViolations(f).map(v=>v.code);
  assert.ok(codes.includes("PLAN_NOT_READY"));
  assert.ok(codes.includes("REGISTRY_NOT_READY"));
}
console.log("TEAM_DISPATCH_AUTHORITY_TEST=PASS");
