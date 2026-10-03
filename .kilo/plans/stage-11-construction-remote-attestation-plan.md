# Stage 11 — K1 `assurance.construction-remote-attestation` — Weaving Plan

**Status:** PLANNED (pre-change checkpoint recorded)
**Stage:** 11
**Knot:** K1 `assurance.construction-remote-attestation`
**Branch:** `fix/autonomous-product-factory`
**Audit baseline:** `fresh-governed-commercialization-2026-09-14`
**Audit artifact:** `.kilo/plans/fresh-governed-commercialization-reaudit-2026-09-14.md`
**Governing sources read:** Master Charter (§6.1, §7, §9, §15.1, §15.1.1), Governance Charter (§5, §10, §12, §15, §16), `Docs/ARCHITECTURE.md`, `Assistant/SYSTEM_PROMPT.md`, `Docs/KILO_EXECUTION_OPERATOR_CONTRACT.md`, AGENTS.md.
**Architecture baseline:** Architecture Freeze V4.1

---

## 1. Capability

Independent construction-plane remote attestation: prove that the construction state is actually synchronized before any knot is accepted as complete:

```
LOCAL HEAD == origin/fix/autonomous-product-factory == GitHub remote branch HEAD
```

The attestation must not trust local `git status`, a successful `git push` exit code, a local ref, file existence, or a cached/stale `origin/<branch>` tracking ref. The authoritative remote value MUST be obtained by an independent remote query (`git ls-remote origin refs/heads/<branch>`).

## 2. Owner

`Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts` — the canonical construction-plane owner of the local Git construction tool (consumed by `AutonomousConstructionEngine` FINALIZE via `AutonomousDevelopmentLoop` → `AutonomousBuildDaemon`). No new engine, no duplicate Git engine, no provider-specific path.

## 3. Dependencies

- **Upstream:** none (Git CLI present; remote reachable — parity verified at plan time).
- **Downstream consumers:** `AutonomousConstructionEngine.build()` FINALIZE stage → `ArchitectureDrivenBuildController` → `AutonomousDevelopmentLoop` → `AutonomousBuildDaemon`.
- **Affected interfaces:** the `git` ConstructionTool artifact gains an additive `remoteAttestation` field; the tool's `ok` now fails closed (`GIT_REMOTE_ATTESTATION_FAILED`) when attestation is not `PASS`.

## 4. Implementation strategy

1. Add an exported `attestRemoteBranchParity(root, branchOverride?, runner?)` to `LocalConstructionToolset.ts` returning a machine-verifiable attestation record that keeps four values distinct:
   - `localHead` (`git rev-parse HEAD`)
   - `originTrackingHead` (local `refs/remotes/origin/<branch>`, **report-only**, never parity authority)
   - `remoteHead` (**independent** `git ls-remote origin refs/heads/<branch>`)
   - `parity` + `status` (`PASS` / `FAIL` / `UNVERIFIED`)
2. Fail-closed: unavailable/malformed remote query, missing branch, malformed SHA, or missing local HEAD ⇒ `UNVERIFIED`; unequal valid SHAs ⇒ `FAIL`; equal valid SHAs ⇒ `PASS`. Equal SHAs prove identical committed content (Git content addressing).
3. Integrate in the existing `git` tool FINALIZE step: after a successful push, run the attestation and attach it to the artifact; return `ok:false` (`GIT_REMOTE_ATTESTATION_FAILED`) if status is not `PASS`. This places the barrier on the real construction execution path and prevents `AutonomousConstructionEngine` from reaching `BUILT` on unverified remote state.
4. Allow an injected command runner (`createLocalConstructionTools(root, { runner })`) so the fail-closed behavior is deterministically testable without mutating the real repository.

## 5. Verification order

1. Focused unit tests of `attestRemoteBranchParity` (PASS, FAIL, remote-query failure ⇒ UNVERIFIED, malformed response ⇒ UNVERIFIED, tracking-ref independence both directions).
2. Focused integration test of the `git` tool fail-closed consumption (`createLocalConstructionTools` + injected runner).
3. Changed-file typecheck (`tsc --noEmit`) for the touched files.
4. Regression: construction-plane suites (`AutonomousBuildDaemon`, `AutonomousConstructionEngine`, `AutonomousDevelopmentLoop`, handoff/completion gate suites).
5. Application/acceptance: run the attestation against the **real** repository/remote and confirm `PASS`, plus an independent `git ls-remote`/`rev-parse` parity check.

## 6. Risk

**MEDIUM.** The change is additive to one owner and gated on a live remote. Risks: (a) a CI/sandbox without network could now fail FINALIZE — acceptable and required (fail-closed by governance §16, "REMOTE VERIFICATION BLOCKED" ≠ success); (b) accidental reliance on the tracking ref — mitigated by computing parity only from local HEAD vs the `ls-remote` value and by dedicated tests.

## 7. Stop conditions

- Remote divergence that cannot be reconciled without rewriting history.
- Absence of authorized remote access.
- Any attempt to weaken the equality assertion or convert UNVERIFIED into PASS.
- Any need to modify unrelated worktree content.

## 8. Expected evidence

- `Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts` implementation.
- `Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.test.ts` focused tests.
- Focused test output, typecheck exit 0, regression output, real-remote acceptance output.
- `.kilo/plans/assurance-construction-remote-attestation-checkpoint.md`.
- One commit; remote parity (`HEAD == origin/<branch> == ls-remote`) reported.

## 9. Pre-change trusted checkpoint

| Field | Value |
|---|---|
| Pre-change HEAD | `568bebdf1c1fe87091f746b9bc5b6f8bcb9fafbb` |
| `origin/fix/autonomous-product-factory` | `568bebdf1c1fe87091f746b9bc5b6f8bcb9fafbb` |
| `git ls-remote origin refs/heads/fix/autonomous-product-factory` | `568bebdf1c1fe87091f746b9bc5b6f8bcb9fafbb` |
| Pre-change parity | TRUE |

Unrelated pre-existing worktree changes are explicitly left untouched and unstaged.

## 10. Do-not-repeat

- Do not repeat the 16-layer commercialization audit.
- Do not start K2+ in this mission.
- Do not create a duplicate Git engine or a parallel attestation hierarchy.
- Do not use `git reset --hard` or `git clean`.
- Do not stage or clean the unrelated worktree files.
