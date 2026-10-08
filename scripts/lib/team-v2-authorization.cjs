"use strict";

const crypto = require("node:crypto");

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      if (key !== "signature") out[key] = stableJson(value[key]);
      return out;
    }, {});
  }
  return value;
}

function payloadForSignature(auth) {
  return JSON.stringify(stableJson(auth));
}

function hashPayload(auth) {
  return crypto.createHash("sha256").update(payloadForSignature(auth), "utf8").digest("hex");
}

function signatureFor(auth, secret) {
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(payloadForSignature(auth), "utf8").digest("hex");
}

function verifySignature(auth, secret) {
  if (!secret || !auth || !auth.signature) return false;
  const expected = signatureFor(auth, secret);
  const actual = String(auth.signature);
  if (!/^[a-f0-9]{64}$/.test(actual) || actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function validateAuthorization(auth, ctx) {
  const violations = [];
  if (!auth || typeof auth !== "object") return [{ code: "AUTHORIZATION_MISSING", detail: "authorization object missing" }];

  const scope = auth.scope || {};
  const bindings = auth.bindings || {};
  if (auth.gate_id && auth.gate_id !== "TEAM-V2-ACCEPTANCE") violations.push({ code: "AUTHORIZATION_GATE_MISMATCH", detail: String(auth.gate_id) });
  if (auth.schema !== "team-v2.acceptance-authorization.v1") violations.push({ code: "AUTHORIZATION_SCHEMA_INVALID", detail: String(auth.schema || "") });
  if (!auth.authorization_id) violations.push({ code: "AUTHORIZATION_ID_MISSING", detail: "authorization_id required" });
  if (!auth.issued_by) violations.push({ code: "AUTHORIZATION_ISSUER_MISSING", detail: "issued_by required" });
  if (!auth.signature) violations.push({ code: "AUTHORIZATION_SIGNATURE_MISSING", detail: "HMAC signature required" });
  if (ctx.signatureSecret && !verifySignature(auth, ctx.signatureSecret)) violations.push({ code: "AUTHORIZATION_SIGNATURE_INVALID", detail: "signature verification failed" });
  if (!ctx.signatureSecret) violations.push({ code: "AUTHORIZATION_SIGNATURE_KEY_MISSING", detail: "verification secret unavailable" });
  if (scope.max_worker_reservations !== 1) violations.push({ code: "AUTHORIZATION_MAX_WORKERS_INVALID", detail: "must be exactly 1" });
  if (scope.work_id !== ctx.workId) violations.push({ code: "AUTHORIZATION_WORK_MISMATCH", detail: String(scope.work_id) + " != " + String(ctx.workId) });
  if (scope.lease_id !== ctx.leaseId) violations.push({ code: "AUTHORIZATION_LEASE_MISMATCH", detail: String(scope.lease_id) + " != " + String(ctx.leaseId) });
  if (bindings.target_branch !== ctx.targetBranch) violations.push({ code: "AUTHORIZATION_TARGET_BRANCH_MISMATCH", detail: String(bindings.target_branch) + " != " + String(ctx.targetBranch) });
  if (bindings.target_sha !== ctx.targetSha) violations.push({ code: "AUTHORIZATION_TARGET_SHA_MISMATCH", detail: "target SHA differs from snapshot" });
  if (bindings.plan_sha256 !== ctx.planSha256) violations.push({ code: "AUTHORIZATION_PLAN_HASH_MISMATCH", detail: "plan hash differs from snapshot" });
  if (auth.consumed === true) violations.push({ code: "AUTHORIZATION_ALREADY_CONSUMED", detail: String(auth.authorization_id) });

  const notAfter = Date.parse(String(auth.expiry?.not_after || ""));
  const now = Date.parse(String(ctx.now || new Date().toISOString()));
  if (!Number.isFinite(notAfter) || !Number.isFinite(now) || now > notAfter) {
    violations.push({ code: "AUTHORIZATION_EXPIRED", detail: String(auth.expiry?.not_after || "") });
  }
  return violations;
}

module.exports = { validateAuthorization, hashPayload, payloadForSignature, signatureFor, verifySignature };
