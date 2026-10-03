# Stage 12 — K2 `product.offline-sync` — Weaving Plan

**Status:** PLANNED (pre-change checkpoint recorded)
**Stage:** 12
**Knot:** K2 `product.offline-sync`
**Branch:** `fix/autonomous-product-factory`
**Audit baseline:** `fresh-governed-commercialization-2026-09-14`
**Audit artifact:** `.kilo/plans/fresh-governed-commercialization-reaudit-2026-09-14.md`
**Governing sources read:** Master Charter (§2, §9, §15.1, §15.1.1, §15.1.3, §15.1.4), Governance Charter (§5, §12, §15, §16), `Docs/ARCHITECTURE.md` (Architecture Freeze V4.1), `Assistant/SYSTEM_PROMPT.md`, AGENTS.md, current execution queue, master ledger, `Product/SyncStateStore.ts` + its test.

---

## 1. Capability

Layer 11 offline/online: make the existing tenant-scoped sync-cursor owner genuinely usable on the real product/runtime path.

```
online ingestion -> durable per-(tenant, source) cursor
offline work (client) -> durable queue (network loss must not discard work)
reconnect -> replay (idempotent) -> reconcile with server cursor -> conflict recorded (server-authoritative)
```

## 2. Canonical owner (reuse, never rebuild)

`Backend/HBOS/Product/SyncStateStore.ts` — the existing Stage 08-GOV.3 tenant-scoped sync-cursor owner (backed by the canonical `SQLitePersistenceStore`). It is **not** a new Engine and there is exactly one sync-state store. The only server change inside the owner is an additive `list(tenantId)` enumeration needed by the new read endpoint; `get` / `recordSuccess` / `recordError` and their contracts are unchanged.

## 3. Discovery findings (bounded Stage-12 audit)

- `SyncStateStore` is referenced **only** by itself and `Backend/HBOS/test/SyncStateStore.test.ts` (grep of `*.ts`): no runtime import, no route, no client consumer.
- Runtime `createCommercialRuntimeServer` instantiates the canonical `SQLitePersistenceStore` and `FinancialIngestionService`, but never `SyncStateStore`.
- `web/sw.js` caches the app shell only and deliberately bypasses `/api/` (network-only) — no offline work capture.
- `web/app.js` analysis form posts `/api/ingest`; a network failure throws and the uploaded work is lost.
- No `/api/sync` route and no conflict resolution exist anywhere in the repository.
- Persistence/recovery contracts already exist (`SQLitePersistenceStore` is durable and tenant-scoped); no new persistence layer is required.

## 4. Dependencies

- **Upstream (all present):** `SyncStateStore`, `SQLitePersistenceStore`, `FinancialIngestionService`, `CommercialRuntimeServer`, `CommercialIdentityService` (permissions), `web/` assets.
- **Downstream consumers after K2:** runtime `GET /api/sync/state`; `web/app.js` offline queue; `/api/ready` capability advertisement.
- **Affected interfaces:** none frozen. Additive only — a new `SyncStateStore.list()` method, a new read route, a `SyncStateStore` instance in the runtime, a new `web/offline-sync.js` client module loaded by `app.js`.

## 5. Implementation strategy (one coherent K2 change)

1. **Owner (additive):** add `list(tenantId): Promise<SyncStateEntry[]>` to `SyncStateStore` reusing the existing persistence prefix and cursor validation; add `SyncStateEntry`.
2. **Runtime:** instantiate `const syncState = new SyncStateStore(persistence)`; record a success cursor (`lastWatermark = source sha256`) after every successful `/api/ingest` and `/api/analyze` ingestion; record an error cursor on `/api/ingest` failure; add tenant-scoped `GET /api/sync/state` (optionally `?source=`) requiring `READ_DASHBOARD`; advertise `offline-sync` in `/api/ready`; serve `/offline-sync.js`.
3. **Client:** add `web/offline-sync.js` (real browser module, CommonJS-exported for behavioral tests) with a durable pending-work queue, idempotent replay, server-cursor reconciliation and conflict detection; wire it into `web/app.js` so a network failure on the analysis form queues the work instead of discarding it and an `online` event flushes the queue; add the script to `web/index.html` and the service-worker app shell.
4. **No duplicate store/engine, no architecture change, no unrelated cleanup.**

## 6. Verification order

1. Focused unit tests of `SyncStateStore.list()` (tenant isolation, cursor shape, error cursor).
2. Focused runtime HTTP integration test: ingest -> `/api/sync/state` cursor == source sha256; failure -> error cursor; cross-tenant isolation; `/api/ready` capability; `/offline-sync.js` served; durability across restart.
3. Focused client test of `web/offline-sync.js`: offline network failure retains work; reconnect replays with the same idempotency key; conflict detected and resolved server-authoritative; rejected work surfaced, not silently retried.
4. Web entrypoint assertions (asset served + `app.js` uses the module + `index.html` loads it).
5. Relevant regression suites (runtime e2e/business-flow, ingestion runtime, identity, idempotency, web entrypoint).
6. Changed-file typecheck (`tsc --noEmit`).
7. Runtime/application acceptance against the live runtime (register -> online ingest -> offline queue -> reconnect sync -> conflict).

## 7. Risk

**MEDIUM.** Additive routes and a new client module. Risks: (a) accidentally changing frozen ingestion semantics — mitigated by recording cursors only, never altering `FinancialIngestionService`/`FinancialDataIngestionAdapter`; (b) treating queue rejection as data loss — mitigated by retaining offline work and only dropping a job after confirmed server acceptance.

## 8. Stop conditions

- Any need to modify `FinancialDataIngestionAdapter.ts` (protected) or Architecture Freeze V4.
- Any need to create a second sync store/engine.
- Any attempt to weaken the offline-retention or tenant-isolation assertion.
- Any need to modify unrelated worktree content.

## 9. Pre-change trusted checkpoint

| Field | Value |
|---|---|
| User-named trusted checkpoint | `888c423be75ce157d37b5225d482e5b41c9f538e` (K1 implementation) |
| Pre-change HEAD | `8fd6f5222d2cd089817fb4d1e2a20fc922579e41` (docs-only §15.1.4 commit on top of the named checkpoint) |
| `origin/fix/autonomous-product-factory` | `8fd6f5222d2cd089817fb4d1e2a20fc922579e41` |
| `git ls-remote origin refs/heads/fix/autonomous-product-factory` | `8fd6f5222d2cd089817fb4d1e2a20fc922579e41` |
| Pre-change parity | TRUE |

Unrelated pre-existing worktree changes are explicitly left untouched and unstaged.

## 10. Do-not-repeat

- Do not repeat the full 16-layer commercialization audit; only the bounded Stage-12 discovery above was performed.
- Do not create a duplicate synchronization store or engine; reuse `SyncStateStore`.
- Do not start K3+ or touch external blockers B1–B5.
- Do not use `git reset --hard` or `git clean`.
- Do not stage or clean the unrelated worktree files.
