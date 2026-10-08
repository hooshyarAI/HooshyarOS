"use strict";
const assert = require("node:assert/strict");
const { verifyAcceptanceEvidence } = require("./team-v2-acceptance-verify.cjs");
const base = {
  commit_sha:"a", workflow_run_id:1, job_id:2, start_sha:"b", target_sha:"c",
  worker_branch:"branch", work_id:"WORK-0011", lease_id:"work-0011-team-v2-memory-reconciliation",
  task_class:"MEMORY", worker_model:"p/m1", worker_provider:"p", qc_model:"q/m2", qc_provider:"q",
  catalog_timestamp:"2026-10-08T20:00:00Z", candidate_ranking:[{rank:1}], attempt_count:1, failure_reasons:[],
  qc_result:"PASS", integration_sha:"d", promotion_sha:"e", registry_state:"PROMOTED", manual_intervention:false
};
assert.equal(verifyAcceptanceEvidence(base).accepted, true);
const missing={...base}; delete missing.promotion_sha;
assert.equal(verifyAcceptanceEvidence(missing).accepted, false);
const same={...base, qc_provider:"p"};
assert.ok(verifyAcceptanceEvidence({...same, acceptance_provider_diversity_required:true}).violations.some(x=>x.code==="QC_SAME_PROVIDER"));
const manual={...base, manual_intervention:true};
assert.ok(verifyAcceptanceEvidence(manual).violations.some(x=>x.code==="MANUAL_INTERVENTION_PRESENT"));
console.log("TEAM_V2_ACCEPTANCE_VERIFY_TEST=PASS");