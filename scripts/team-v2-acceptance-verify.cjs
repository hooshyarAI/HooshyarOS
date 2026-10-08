"use strict";

const REQUIRED = [
  "commit_sha", "workflow_run_id", "job_id", "start_sha", "target_sha",
  "worker_branch", "work_id", "lease_id", "task_class", "worker_model",
  "worker_provider", "qc_model", "qc_provider", "catalog_timestamp",
  "candidate_ranking", "attempt_count", "failure_reasons", "qc_result",
  "integration_sha", "promotion_sha", "registry_state"
];

function verifyAcceptanceEvidence(evidence) {
  const missing = REQUIRED.filter(key => evidence?.[key] === undefined || evidence?.[key] === null || evidence?.[key] === "");
  const violations = [];
  if (missing.length) violations.push({ code: "EVIDENCE_MISSING", fields: missing });
  if (!["PASS", "ACCEPTED"].includes(String(evidence?.qc_result || "").toUpperCase())) {
    violations.push({ code: "QC_NOT_PASSED", detail: String(evidence?.qc_result || "") });
  }
  if (!["PROMOTED"].includes(String(evidence?.registry_state || "").toUpperCase())) {
    violations.push({ code: "REGISTRY_NOT_PROMOTED", detail: String(evidence?.registry_state || "") });
  }
  if (evidence?.manual_intervention === true) {
    violations.push({ code: "MANUAL_INTERVENTION_PRESENT", detail: "acceptance must be clean" });
  }
  if (evidence?.worker_model && evidence?.qc_model && evidence.worker_model === evidence.qc_model) {
    violations.push({ code: "QC_SAME_MODEL", detail: evidence.worker_model });
  }
  if (evidence?.worker_provider && evidence?.qc_provider && evidence.worker_provider === evidence.qc_provider && evidence.acceptance_provider_diversity_required === true) {
    violations.push({ code: "QC_SAME_PROVIDER", detail: evidence.worker_provider });
  }
  return { accepted: violations.length === 0, violations };
}

module.exports = { REQUIRED, verifyAcceptanceEvidence };