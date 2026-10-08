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

  for (const key of ["id","role","focus","owner","mode","write_scope"]) {
    if (lease[key] === undefined || lease[key] === null || lease[key] === "") {
      violations.push({ code: `MISSING_${key.toUpperCase()}`, detail: `${leaseId}: missing ${key}` });
    }
  }

  const derived = workIdFromLeaseId(lease.id);
  if (derived !== workId) {
    violations.push({ code: "LEASE_ID_WORK_ID_MISMATCH", detail: `${lease.id} -> ${derived} expected ${workId}` });
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

module.exports = { validateWork, workIdFromLeaseId, overlaps, TERMINAL_ATTEMPT_STATES };
