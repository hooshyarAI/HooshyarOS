"use strict";
const assert = require("node:assert/strict");
const { reservationId, reservationRef, claimRef, buildReservation } = require("./team-v2-reservation.cjs");

const args = {
  workId: "WORK-0011",
  leaseId: "work-0011-team-v2-memory-reconciliation",
  startSha: "a".repeat(40),
  inputsHash: "b".repeat(64),
  attemptNo: 1
};

const id1 = reservationId(args);
const id2 = reservationId(args);
assert.equal(id1.length, 64);
assert.equal(id1, id2);
assert.match(reservationRef(args.workId), /^refs\/team-v2\/active\/WORK-0011$/);
assert.match(claimRef(id1), new RegExp("^refs/team-v2/claims/" + id1 + "$"));

const record = buildReservation({
  reservation: id1,
  workId: args.workId,
  leaseId: args.leaseId,
  startSha: args.startSha,
  targetBranch: "fix/autonomous-product-factory",
  inputsHash: args.inputsHash,
  runId: 123,
  authorizationId: "ACCAUTH-0001"
});
assert.equal(record.state, "RESERVED");
assert.equal(record.single_claim, true);
assert.equal(record.authorization_id, "ACCAUTH-0001");

console.log("TEAM_V2_RESERVATION_TEST=PASS");
