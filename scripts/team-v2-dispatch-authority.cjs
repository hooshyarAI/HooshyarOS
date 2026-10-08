#!/usr/bin/env node
"use strict";
const { execFileSync } = require("node:child_process");

const TARGET_BRANCH = process.env.TARGET_BRANCH || "fix/autonomous-product-factory";
const WORKER_WORKFLOW_ID = process.env.TEAM_WORKER_WORKFLOW_ID || "378094136";
const ISSUE_NUMBER = String(process.env.TEAM_CONTROL_ISSUE || "122");
const REPOSITORY = process.env.GITHUB_REPOSITORY || "hooshyarAI/HooshyarOS";

function required(value, label) {
  return value === undefined || value === null || value === ""
    ? { code: `MISSING_${String(label).toUpperCase()}`, detail: `${label} is missing` }
    : null;
}
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

function admissionViolations({ gate, plan, registry }) {
  const violations = [];
  if (!gate || typeof gate !== "object") {
    violations.push({ code: "GATE_MISSING", detail: "acceptance gate missing/invalid" });
  } else {
    if (gate.gate_id !== "TEAM-V2-ACCEPTANCE") {
      violations.push({ code: "GATE_ID_INVALID", detail: `gate_id=${String(gate.gate_id)}` });
    }
    if (gate.status === "ARMED" && gate.hold_after_pass === true) {
      violations.push({ code: "ACCEPTANCE_HOLD", detail: "status=ARMED and hold_after_pass=true" });
    }
  }

  if (!plan || typeof plan !== "object") {
    violations.push({ code: "PLAN_MISSING", detail: "NEXT-WAVE-PLAN missing/invalid" });
    return violations;
  }
  if (plan.wave_status !== "READY") {
    violations.push({ code: "PLAN_NOT_READY", detail: `wave_status=${String(plan.wave_status)}` });
  }
  const leases = Array.isArray(plan.leases) ? plan.leases : [];
  if (leases.length === 0) {
    violations.push({ code: "PLAN_HAS_NO_LEASES", detail: "READY plan contains no leases" });
  }

  const items = Array.isArray(registry?.items) ? registry.items : [];
  const byId = new Map(items.map((x) => [String(x.id), x]));
  const protectedPrefixes = [
    ".github/",
    "Docs/ARCHITECTURE.md",
    "Docs/HOOSHYAROS_MASTER_CHARTER.md",
    "Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md",
    "Assistant/SYSTEM_PROMPT.md",
    "package.json",
    "package-lock.json",
    ".env"
  ];
  const seen = new Set();
  const scopes = [];

  for (const lease of leases) {
    for (const key of ["id", "role", "focus", "owner", "mode", "write_scope"]) {
      const miss = required(lease?.[key], key);
      if (miss) violations.push({ code: miss.code, detail: `${lease?.id || "unknown"}: ${miss.detail}` });
    }

    const lid = String(lease?.id || "");
    const workId = workIdFromLeaseId(lid);
    if (!workId) {
      violations.push({ code: "LEASE_ID_INVALID", detail: lid || "missing" });
      continue;
    }
    if (seen.has(workId)) violations.push({ code: "DUPLICATE_WORK_ID_IN_PLAN", detail: workId });
    seen.add(workId);

    const mode = String(lease?.mode || "");
    if (!["AUDIT", "IMPLEMENT", "REVIEW", "VERIFY"].includes(mode)) {
      violations.push({ code: "LEASE_MODE_INVALID", detail: `${lid}: ${mode}` });
    }

    const scope = Array.isArray(lease?.write_scope) ? lease.write_scope.map(String) : [];
    const evidenceRoot = `.kilo/team/results/${lid}/`;
    if (!scope.includes(evidenceRoot)) {
      violations.push({ code: "EVIDENCE_ROOT_MISSING", detail: `${lid}: ${evidenceRoot}` });
    }
    for (const path of scope) {
      const n = norm(path);
      if (protectedPrefixes.some((p) => n === p.replace(/\/$/, "") || n.startsWith(p))) {
        violations.push({ code: "PROTECTED_SCOPE", detail: `${lid}: ${path}` });
      }
    }

    const item = byId.get(workId);
    if (!item) {
      violations.push({ code: "REGISTRY_RECORD_MISSING", detail: `${lid} -> ${workId}` });
    } else {
      if (String(item.status || "") !== "READY") {
        violations.push({ code: "REGISTRY_STATUS_NOT_READY", detail: `${workId}: status=${String(item.status)}` });
      }
      if (String(item.readiness || "") !== "READY") {
        violations.push({ code: "REGISTRY_NOT_READY", detail: `${workId}: readiness=${String(item.readiness)}` });
      }
      const attempts = Array.isArray(item.execution_attempts) ? item.execution_attempts : [];
      const unresolved = attempts.filter((a) => {
        const state = String(a?.state || "").toUpperCase();
        return !Boolean(a?.promoted) && !["SUPERSEDED", "DUPLICATE", "INVALID"].includes(state);
      });
      if (unresolved.length) {
        violations.push({ code: "UNRESOLVED_PRIOR_ATTEMPT", detail: `${workId}: ${unresolved.length} unresolved attempt(s)` });
      }
    }

    for (const dep of Array.isArray(lease?.dependencies) ? lease.dependencies : []) {
      const d = String(dep);
      if (!/^WORK-[0-9]{4}$/.test(d)) {
        violations.push({ code: "DEPENDENCY_ID_INVALID", detail: `${lid}: ${d}` });
        continue;
      }
      const depItem = byId.get(d);
      if (!depItem) {
        violations.push({ code: "DEPENDENCY_RECORD_MISSING", detail: `${lid}: ${d}` });
      } else if (!["COMPLETED", "VERIFIED", "PROMOTED", "MEMORIZED", "CLOSED"].includes(String(depItem.status || "").toUpperCase())) {
        violations.push({ code: "DEPENDENCY_NOT_SATISFIED", detail: `${lid}: ${d} status=${String(depItem.status)}` });
      }
    }

    for (const [prevId, prevScope] of scopes) {
      for (const a of scope) for (const b of prevScope) {
        if (overlaps(a, b)) violations.push({ code: "WRITE_SCOPE_OVERLAP", detail: `${lid} <-> ${prevId}` });
      }
    }
    scopes.push([lid, scope]);
  }
  return violations;
}

function ghJson(args) {
  return JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8" }));
}
function readRepoJson(path) {
  const obj = ghJson([`repos/${REPOSITORY}/contents/${path}?ref=${TARGET_BRANCH}`]);
  return JSON.parse(Buffer.from(String(obj.content).replace(/\n/g, ""), "base64").toString("utf8"));
}
function comment(body) {
  try {
    execFileSync("gh", ["api", "--method", "POST", `repos/${REPOSITORY}/issues/${ISSUE_NUMBER}/comments`, "-f", `body=${body}`], { stdio: "ignore" });
  } catch (_) {}
}

if (require.main === module) {
  const gate = readRepoJson(".kilo/team/TEAM-V2-ACCEPTANCE-GATE.json");
  const plan = readRepoJson(".kilo/team/NEXT-WAVE-PLAN.json");
  const registry = readRepoJson(".kilo/team/memory/work-registry.json");
  const violations = admissionViolations({ gate, plan, registry });

  console.log(`TEAM_DISPATCH_AUTHORITY_PLAN=${plan.wave_status}`);
  console.log(`TEAM_DISPATCH_AUTHORITY_GATE=${gate.status}`);
  console.log(`TEAM_DISPATCH_AUTHORITY_HOLD=${String(gate.hold_after_pass)}`);
  console.log(`TEAM_DISPATCH_AUTHORITY_VIOLATIONS=${violations.length}`);

  if (violations.length) {
    const detail = violations.map((v) => `${v.code}:${v.detail}`).join(" | ");
    console.log(`TEAM_WORKER_DISPATCH=REFUSED ${detail}`);
    comment(`TEAM DISPATCH AUTHORITY REFUSED: ${detail}`);
    process.exit(20);
  }

  const activeStatuses = ["queued","pending","waiting","requested","in_progress","action_required"];
  let active = 0;
  for (const status of activeStatuses) {
    const runs = ghJson([`repos/${REPOSITORY}/actions/workflows/${WORKER_WORKFLOW_ID}/runs?branch=${TARGET_BRANCH}&status=${status}&per_page=20`]);
    active += Array.isArray(runs.workflow_runs) ? runs.workflow_runs.length : 0;
  }
  console.log(`ACTIVE_OR_QUEUED_TEAM_WORKERS=${active}`);
  if (active > 0) {
    console.log("TEAM_WORKER_DISPATCH=REFUSED_ACTIVE_OR_QUEUED_RUN");
    comment("TEAM DISPATCH AUTHORITY REFUSED: active/queued Team Worker exists; no duplicate dispatch.");
    process.exit(20);
  }

  const reason = process.env.TEAM_DISPATCH_REASON || "Governed Team V2 dispatch via single authority";
  execFileSync("gh", [
    "api", "--method", "POST",
    `repos/${REPOSITORY}/actions/workflows/${WORKER_WORKFLOW_ID}/dispatches`,
    "-f", "ref=main",
    "-f", `inputs[reason]=${reason}`
  ], { stdio: "inherit" });

  console.log("TEAM_WORKER_DISPATCH=SUCCESS");
  comment(`TEAM DISPATCH AUTHORITY ACCEPTED: one governed Team Worker dispatch created. reason=${reason}; target=${TARGET_BRANCH}`);
}
module.exports = { admissionViolations, workIdFromLeaseId, overlaps };
