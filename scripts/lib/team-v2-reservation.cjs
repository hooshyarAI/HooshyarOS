"use strict";

const crypto = require("node:crypto");

function reservationId({ workId, leaseId, startSha, inputsHash, attemptNo }) {
  const raw = [workId, leaseId, startSha, inputsHash, String(attemptNo)].join("|");
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function reservationRef(workId) {
  if (!/^WORK-[0-9]{4}$/.test(String(workId || ""))) {
    throw new Error("invalid work id: " + String(workId || ""));
  }
  return "refs/team-v2/active/" + workId;
}

function reservationRecordRef(reservation) {
  if (!/^[a-f0-9]{64}$/.test(String(reservation || ""))) {
    throw new Error("invalid reservation id");
  }
  return "refs/team-v2/reservations/" + reservation;
}

function claimRef(reservation) {
  if (!/^[a-f0-9]{64}$/.test(String(reservation || ""))) {
    throw new Error("invalid reservation id");
  }
  return "refs/team-v2/claims/" + reservation;
}

function buildReservation(args) {
  return {
    schema: "team-v2.reservation.v1",
    reservation_id: args.reservation,
    work_id: args.workId,
    lease_id: args.leaseId,
    start_sha: args.startSha,
    target_branch: args.targetBranch,
    inputs_hash: args.inputsHash,
    authority_run_id: Number(args.runId),
    authorization_id: args.authorizationId || null,
    state: "RESERVED",
    single_claim: true
  };
}

module.exports = { reservationId, reservationRef, reservationRecordRef, claimRef, buildReservation };
