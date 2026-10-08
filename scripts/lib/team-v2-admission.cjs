"use strict";

const VALID_MODES = new Set(["AUDIT", "IMPLEMENT", "REVIEW", "VERIFY"]);
const TERMINAL_ATTEMPT_STATES = new Set(["PROMOTED", "SUPERSEDED", "ABANDONED_ADJUDICATED", "DUPLICATE", "INVALID"]);

function workIdFromLeaseId(id) {
  const m = /^work-([0-9]{4})(?:-|$)/.exec(String(id || ""));
  return m ? `WORK-${m[1]}` : null;
}

function norm(path) {
  return String(path || "").trim().replace(/^\.\//, "").replace(/\\/g, "/").replace(/\*.*$/, "").replace(/\/$/, "");
}

function overlaps(a, b) {
  const aa = norm(a), bb = norm(b);
  return Boolean(aa && bb) && (aa === bb || aa.startsWith(`${bb}/`) || bb.startsWith(`${aa}/`));
}

function deriveTaskClass(lease) {
  const role = String(lease?.role || "").toUpperCase();
  const focus = String(lease?.focus || "").toUpperCase();
  const owner = String(lease?.owner || "").toUpperCase();
  const text = role + " " + focus + " " + owner;
  if (text.includes("MEMORY") || owner.includes("EDITOR")) return "MEMORY";
  if (text.includes("QC") || owner.includes("EVALUATOR")) return "QC";
  if (text.includes("REPAIR")) return "REPAIR";
  if (text.includes("PLAN") || owner.includes("PLANNER")) return "PLAN";
  if (text.includes("VERIFY")) return "VERIFY";
  if (text.includes("REVIEW")) return "REVIEW";
  if (text.includes("IMPLEMENT") || text.includes("BUILD")) return "IMPLEMENT";
  if (text.includes("AUDIT")) return "AUDIT";
  return "";
}



function validateWork({ plan, registry, workId, leaseId }) {
  const violations = [];
  if (!plan || plan.wave_status !== "READY" || !Array.isArray(plan.leases)) {
    violations.push({ code: "PLAN_NOT_READY", detail: "READY wave plan required" });
    return violations;
  }

  const lease = plan.leases.find(x => String(x?.id) === String(leaseId));
  if (!lease) {
    violations.push({ code: "LEASE_NOT_FOUND", detail: String(leaseId || "") });
    return violations;
  }

  for (const key of ["id","role","focus","owner","mode","task_class","write_scope"]) {
    if (lease[key] === undefined || lease[key] === null || lease[key] === "") {
      violations.push({ code: `MISSING_${key.toUpperCase()}`, detail: `${leaseId}: missing ${key}` });
    }
  }

  const derived = workIdFromLeaseId(lease.id);
  if (derived !== workId) {
    violations.push({ code: "LEASE_ID_WORK_ID_MISMATCH", detail: `${lease.id} -> ${derived} expected ${workId}` });
  }
  const taskClass = String(lease.task_class || "").toUpperCase();
  const derivedTaskClass = deriveTaskClass(lease);
  if (!["PLAN","AUDIT","IMPLEMENT","REPAIR","REVIEW","VERIFY","QC","MEMORY"].includes(taskClass)) {
    violations.push({ code: "TASK_CLASS_INVALID", detail: String(lease.task_class || "") });
  } else if (derivedTaskClass && taskClass !== derivedTaskClass) {
    violations.push({ code: "TASK_CLASS_MISMATCH", detail: lease.id + ": explicit=" + taskClass + " derived=" + derivedTaskClass });
  }
  if (!VALID_MODES.has(String(lease.mode || ""))) {
    violations.push({ code: "LEASE_MODE_INVALID", detail: String(lease.mode || "") });
  }

  const item = Array.isArray(registry?.items)
    ? registry.items.find(x => String(x?.id) === String(workId))
    : null;
  if (!item) {
    violations.push({ code: "REGISTRY_RECORD_MISSING", detail: String(workId || "") });
    return violations;
  }
  if (String(item.status || "").toUpperCase() !== "READY") {
    violations.push({ code: "REGISTRY_STATUS_NOT_READY", detail: `${workId}: ${String(item.status)}` });
  }
  if (String(item.readiness || "").toUpperCase() !== "READY") {
    violations.push({ code: "REGISTRY_NOT_READY", detail: `${workId}: ${String(item.readiness)}` });
  }

  const attempts = Array.isArray(item.execution_attempts) ? item.execution_attempts : [];
  const unresolved = attempts.filter(a => !Boolean(a?.promoted) && !TERMINAL_ATTEMPT_STATES.has(String(a?.state || "").toUpperCase()));
  if (unresolved.length) {
    violations.push({ code: "UNRESOLVED_PRIOR_ATTEMPT", detail: `${workId}: ${unresolved.length}` });
  }

  const scopes = Array.isArray(lease.write_scope) ? lease.write_scope.map(String) : [];
  const evidenceRoot = `.kilo/team/results/${lease.id}/`;
  if (!scopes.includes(evidenceRoot)) {
    violations.push({ code: "EVIDENCE_ROOT_MISSING", detail: evidenceRoot });
  }

  const protectedPrefixes = [".github/","Docs/ARCHITECTURE.md","Docs/HOOSHYAROS_MASTER_CHARTER.md","Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md","Assistant/SYSTEM_PROMPT.md","package.json","package-lock.json",".env"];
  for (const path of scopes) {
    const n = norm(path);
    if (protectedPrefixes.some(p => n === p.replace(/\/$/,"") || n.startsWith(p))) {
      violations.push({ code: "PROTECTED_SCOPE", detail: `${lease.id}: ${path}` });
    }
  }

  return violations;
}

module.exports = { validateWork, workIdFromLeaseId, overlaps, deriveTaskClass, TERMINAL_ATTEMPT_STATES };
