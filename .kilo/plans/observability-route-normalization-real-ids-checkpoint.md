# Observability Route Normalization (Real Canonical IDs) — Checkpoint

**Status:** COMPLETE / COMMITTED / PUSHED / REMOTE-PARITY VERIFIED
**Knot ID:** `observability.route-normalization-real-ids`
**Date:** 2026-09-16
**Branch:** `fix/autonomous-product-factory`
**Type:** bounded, non-stage, repository-local knot (no new stage, no queue reordering)
**Pre-change trusted checkpoint:** `f9d40d13d93ee46d61c517f10838bacef4c70e30`
**Closure SHA:** `b4a95c443da054857adec3cab2ca4dfcc7dbbe07`

---

## 1. Commit / remote parity

| Field | Value |
|---|---|
| Commit SHA | `b4a95c443da054857adec3cab2ca4dfcc7dbbe07` |
| Message | `fix(observability): normalize real canonical id formats in route metrics` |
| Files | `Backend/HBOS/Autonomous/Runtime/RuntimeObservability.ts`, `Backend/HBOS/test/RuntimeObservability.test.ts` |
| `git rev-parse HEAD` | `b4a95c443da054857adec3cab2ca4dfcc7dbbe07` |
| `git rev-parse origin/fix/autonomous-product-factory` | `b4a95c443da054857adec3cab2ca4dfcc7dbbe07` |
| `git ls-remote origin refs/heads/fix/autonomous-product-factory` | `b4a95c443da054857adec3cab2ca4dfcc7dbbe07` |
| Parity | **HOLDS** — local == origin tracking == independent `ls-remote` |

One implementation commit only. No engine, route, contract, persistence, security or completion-gate change.

## 2. Classification

`REAL DEFECT` (observability cardinality contract violated) + `MISSING REGRESSION GUARD`.

`RuntimeObservability.ts` documents "bounded operation counters ... per normalized route" and collapses identifier-like segments with a hex/UUID/decimal-only regex. The three dynamic route families and their real id producers:

| Route family | Real id | Producer | Collapsed before? |
|---|---|---|---|
| `/api/sources/<sha>` | 64 hex sha256 | `FinancialIngestionService` | yes |
| `/api/execution/work-items/<id>[/<action>]` | `TRACE-<base36>-<base36>-<n>` | `Core/ProvenanceTrace.ts:53` | **no** |
| `/api/report/artifacts/<id>/download` | `report-<32 hex>` | `Product/ReportExportService.ts:122` | **no** |

Every distinct work item and every distinct report artifact therefore added a permanent entry to the process-wide `routes` map — unbounded cardinality growth and no usable per-route aggregate for those two real object families.

The only existing guard asserted a synthetic pure-hex segment (`deadbeefcafe`) that no real endpoint emits, so the regression suite passed while the real behaviour was unguarded.

## 3. Reproduction (before repair)

| Input | old regex | new regex |
|---|---|---|
| `TRACE-mf3k2j1a-k3j2h1g-1` | `false` | `true` |
| `report-0123456789abcdef0123456789abcdef` | `false` | `true` |
| 64-hex sha / decimal / `deadbeefcafe` | `true` | `true` (unchanged) |

HTTP-level: two real work items GET by id produced **two** distinct route keys (expected one); two real artifact downloads produced **two** distinct route keys (expected one).

## 4. Repair (canonical owner, minimal)

`Backend/HBOS/Autonomous/Runtime/RuntimeObservability.ts` — `ID_SEGMENT` additionally recognizes the two real canonical id shapes, documented against their producers:

```
/^(?:[0-9a-f]{8,}|[0-9a-f]{8}-[0-9a-f-]{4,}|\d+
   |trace-[0-9a-z]+-[0-9a-z]+-\d+
   |report-[0-9a-f]{32})$/i
```

Static segments (`/api/execution/work-items`, `/api/report/artifacts`) are still not collapsed. The module remains a supporting (non-Engine) service; no frozen contract changed.

## 5. Evidence

| Check | Command | Result |
|---|---|---|
| Focused | `jest --runTestsByPath Backend/HBOS/test/RuntimeObservability.test.ts` | **1 suite / 7 tests PASS** (was 5; +2) |
| New guard | real `ProvenanceTrace.createTraceId()` + real `report-<32 hex>` unit cases | PASS |
| New behavioural proof | real HTTP: register → decision workbench → 2 work items → GET each by real `TRACE-` id → analyze → 2 exports → GET each real artifact download → `/api/diagnostics/metrics` asserts exactly **one** normalized route per family (`requests: 2`) and no real id in the payload | PASS |
| Regression | 8 runtime/persistence/export suites (Observability, Pagination, Idempotency, ReportsExportRuntime, e2e, rateLimiting, resilience, server) | **8 suites / 72 tests PASS** |
| Changed-file typecheck | `tsc RuntimeObservability.ts`, `tsc RuntimeObservability.test.ts` | exit **0** |
| Full suite | `node ./node_modules/jest/bin/jest.js --runInBand` | **270/270 suites, 2100/2100 tests, exit 0** (baseline 270/270, 2098; +2) |

Evidence artifact: `.kilo/evidence/observability-route-normalization-real-ids-2026-09-16.txt`.

## 6. Truth boundary

- No completion flag changed: `assistantComplete` TRUE; `canonicalPlatformConstructionComplete` FALSE; `commercialProductRuntimeComplete` FALSE; `externalProductionDependenciesComplete` FALSE; `productComplete` FALSE.
- K8 remains VERIFIED/CLOSED and was not reopened. B1 `BLOCKED_HUMAN_APPROVAL`; B2/B3 `BLOCKED_EXTERNAL`; B4 `BLOCKED_ENVIRONMENT`; B5 AVAILABLE ON THIS HOST (unchanged).
- No test weakened/skipped, no mock substituted for the real HTTP flow, no evidence fabricated.
- Unrelated worktree files were not staged or modified.

## 7. DO-NOT-REPEAT

- Do not narrow `ID_SEGMENT` back to a hex/UUID/decimal-only heuristic.
- Do not assert synthetic ids in the normalization guard; assert the real producer formats (or the real flow).
- Do not grow the `routes` map with un-normalized object ids; add the new canonical id shape here when a new dynamic route family is introduced.
- Do not stage unrelated worktree files; do not `git reset`/`clean`/`stash`.
