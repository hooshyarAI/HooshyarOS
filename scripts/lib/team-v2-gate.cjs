"use strict";

function evaluateGate(gate, authorization, ctx = {}) {
  const violations = [];
  if (!gate || gate.gate_id !== "TEAM-V2-ACCEPTANCE") {
    violations.push({ code: "GATE_ID_INVALID", detail: "invalid Team V2 acceptance gate" });
    return { decision: "REFUSE", code: "INVALID_GATE", violations };
  }

  const armed = gate.status === "ARMED" && gate.hold_after_pass === true;
  if (!armed) {
    return { decision: "ALLOW_NORMAL", code: "GATE_NOT_HELD", violations };
  }

  if (!authorization || typeof authorization !== "object") {
    violations.push({ code: "ACCEPTANCE_AUTHORIZATION_REQUIRED", detail: "held gate requires one-shot acceptance authorization" });
    return { decision: "REFUSE", code: "ACCEPTANCE_AUTHORIZATION_REQUIRED", violations };
  }

  const scope = authorization.scope || {};
  const bindings = authorization.bindings || {};
  const now = Date.parse(ctx.now || new Date().toISOString());
  const expires = Date.parse(String(authorization.expiry?.not_after || ""));
  if (!authorization.authorization_id || !scope.wave_id || scope.work_id !== ctx.workId || scope.lease_id !== ctx.leaseId) {
    violations.push({ code: "AUTHORIZATION_SCOPE_MISMATCH", detail: "authorization is not bound to the admitted work" });
  }
  if (scope.max_worker_reservations !== 1) {
    violations.push({ code: "AUTHORIZATION_RESERVATION_LIMIT_INVALID", detail: "acceptance authorization must allow exactly one reservation" });
  }
  if (bindings.target_branch !== ctx.targetBranch || bindings.target_sha !== ctx.targetSha || bindings.plan_sha256 !== ctx.planSha256) {
    violations.push({ code: "AUTHORIZATION_BINDING_MISMATCH", detail: "authorization bindings do not match current snapshot" });
  }
  if (!Number.isFinite(expires) || now > expires) {
    violations.push({ code: "AUTHORIZATION_EXPIRED", detail: "authorization expired or has no valid expiry" });
  }
  if (authorization.consumed === true) {
    violations.push({ code: "AUTHORIZATION_ALREADY_CONSUMED", detail: "authorization is already consumed" });
  }

  return violations.length
    ? { decision: "REFUSE", code: violations[0].code, violations }
    : { decision: "ADMIT_ACCEPTANCE", code: "VALID_ONE_SHOT_AUTHORIZATION", violations: [] };
}

module.exports = { evaluateGate };
