# B1 — Encryption-at-Rest / Key Management — Decision-Readiness Artifact

**Status:** DECISION-READINESS — production wiring intentionally NOT implemented
**Date:** 2026-09-16
**Audit ID:** `governed-commercialization-b1-b5-truth-2026-09-16`
**Trusted checkpoint:** `bc341ab13e2e08b85c2431c5d7d0b6968817b863`
**Classification:** `BLOCKED_HUMAN_APPROVAL` — ACTIONABLE_NOW = FALSE
**Governing sources:** `Docs/HOOSHYAROS_MASTER_CHARTER.md` §15.1.1, `plans/1787979074910-phase-05c-d1-design.md`,
`.kilo/plans/1787787070827-phase-05c-e-security-audit.md`, `Docs/ARCHITECTURE_DECISIONS/`, `Docs/ARCHITECTURE.md`,
`Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md` §12.

---

## 1. Why this is a decision artifact and not an implementation

The encryption **foundation** already exists and is committed, but the **production store is plaintext**.
Wiring encryption requires choosing the persistence technology, the encryption model, the key-management
backend, the secrets path and the backup key separation. `plans/1787979074910-phase-05c-d1-design.md`
(§"HUMAN_APPROVAL") records those as human-approval decisions, and `phase-05c-e-security-audit.md`
records audit encryption (`P1`) as `REQUIRES_HUMAN_APPROVAL`. There is **no approved architecture
decision** permitting encryption-at-rest (`Docs/ARCHITECTURE_DECISIONS/` holds only
`KILO_GOVERNED_OPERATOR_DECISION.md`; `Docs/ARCHITECTURE.md` has no encryption entry).

Per the governing rule, production encryption was **not** enabled merely because `EncryptionService`
exists, and no key-management policy or approval was invented.

---

## 2. Current state (evidence)

| Aspect | Reality |
|---|---|
| Encryption primitive | `Backend/HBOS/Security/EncryptionService.ts` — AES-256-GCM, per-tenant DEK, KEK via scrypt, envelope wrap/unwrap, fail-secure key-required (`ENCRYPTION_ROOT_KEY_REQUIRED`). Commit `1608a7ea`. |
| Encryption-capable persistence | `Backend/HBOS/Persistence/SQLiteAdapter.ts:110-172` — optional field-level encryption for `ENCRYPTED_FIELDS`; creates `encryption_keys` DEK-metadata table; fails secure on encryption failure. |
| Is it wired into production? | **No.** Referenced only by `Phase05C-D4.test.ts` / `Phase05C-D2.test.ts`. |
| Production persistence | `CommercialRuntimeServer.ts:306-307` constructs `Product/SQLitePersistenceStore` (`HOOSHYAR_DB_PATH ?? data/hooshyar.sqlite`); `SQLitePersistenceStore.ts:21-32` writes plaintext JSON to `persistence_records`. |
| Key source | `process.env["HOOSHyarOS_ROOT_KEY"]` or `config.rootKey`; no hard-coded fallback; fails closed when absent. |
| Approved production key management | **None recorded.** |
| Foundation tests | `Phase05C-D4.test.ts` — 31 tests, PASS (re-verified 2026-09-16). |
| Observed inconsistency (not changed) | Root-key env var spelled `HOOSHyarOS_ROOT_KEY` (mixed case) in `EncryptionService.ts:144,155` and its test, while `05C-D1` documents `HOOSHYAR_ENCRYPTION_KEY`. Part of the pending key-management decision. |

---

## 3. Risk

- **Confidentiality at rest:** production tenant data (decisions, analysis, work items, reports, and any
  identity/credential material persisted through the runtime store) is stored plaintext. A host, backup
  or file-system compromise exposes all tenants' sensitive content.
- **Enterprise claims:** the platform cannot claim "encrypted sensitive-data handling" or "secure
  enterprise storage" until encryption-at-rest is active with an approved key model
  (`05C-D1` §"CLAIMS CURRENTLY UNSUPPORTABLE").
- **Milestone coupling:** `externalProductionDependenciesComplete` and `productComplete` stay FALSE while
  this remains unapproved/unwired.

---

## 4. Affected components (canonical owners)

| Component | Path |
|---|---|
| Production persistence store | `Backend/HBOS/Product/SQLitePersistenceStore.ts` |
| Runtime store construction | `Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts:306-307` |
| Encryption foundation | `Backend/HBOS/Security/EncryptionService.ts` |
| Encryption-capable persistence (unwired) | `Backend/HBOS/Persistence/SQLiteAdapter.ts` |
| Key provider interface | `IKeyProvider` / `LocalKeyProvider` (same file as foundation) |
| Runtime entrypoint / config | `Backend/HBOS/Autonomous/Runtime/start-commercial-runtime.ts` |
| Tenant isolation / repository boundary | `Backend/HBOS/Security/TenantIsolation.ts`, `Persistence/IRepository.ts` |
| Backup/recovery | `Backend/HBOS/Entities/BackupSecurity.ts` (not wired into runtime) |

---

## 5. Alternatives (require approval — none chosen here)

- **A. Field-level encryption on the existing KV store** — encrypt selected values in
  `persistence_records` using per-tenant DEKs; minimal persistence change; preserves `tenantId`/keys as
  plaintext for query. Pros: smallest migration. Cons: query/aggregation limits; needs schema-version
  marker in stored values.
- **B. Storage-level encryption (SQLCipher or equivalent)** — transparent full-database encryption.
  Pros: no field selection. Cons: depends on driver/toolchain support for `node:sqlite`; key handling at
  connection level; less granular.
- **C. Hybrid** — storage-level for metadata/audit, field-level for CONFIDENTIAL/SENSITIVE fields
  (matches the `05C-D1` recommendation). Pros: strongest; Cons: highest complexity and migration effort.
- **Key-management backends** to choose between: development env var, OS keystore/file (0600),
  HashiCorp Vault, cloud KMS (AWS/Azure/GCP), HSM.

---

## 6. Migration plan (outline — only executable after approval)

1. Record the architecture decision (encryption model + key-management backend + secrets path +
   backup key separation + persistence technology) in `Docs/ARCHITECTURE_DECISIONS/` and
   `Docs/ARCHITECTURE.md`.
2. Add an encryption gate + schema-version/marker to `SQLitePersistenceStore`, or promote the approved
   persistence owner, reusing `EncryptionService`/`LocalKeyProvider` (do not build a second crypto stack).
3. Dual-read support: detect plaintext vs encrypted values during migration.
4. One-time re-encryption of existing plaintext rows per tenant (bounded, resumable, idempotent),
   with a pre-migration backup.
5. Access the DEK metadata through the chosen key backend; keep DEKs in memory only.
6. Wire the runtime construction to pass the approved `encryption` config; fail closed if the key is
   unavailable.
7. Update `/api/ready` to advertise encryption status truthfully.

## 7. Recovery plan (outline)

- Pre-migration timestamped backup with integrity hash; verified restore path.
- If a key is unavailable or a record fails to decrypt, fail closed (deny) rather than return plaintext;
  emit a security event; never fall back to plaintext.
- If migration is interrupted, resume from the per-tenant marker; the dual-read path keeps old rows usable.
- Roll back to the pre-migration backup if re-encryption corrupts integrity.

## 8. Required acceptance evidence (when authorized)

- Field-level encryption proven on the **real runtime store** (read raw file/rows -> no sensitive plaintext).
- Round-trip decrypt with the correct DEK; wrong key / tampered ciphertext fails securely.
- Per-tenant DEK isolation (tenant A cannot decrypt tenant B) and no cross-tenant leakage.
- Key rotation produces a new DEK version and new writes use it.
- Migration of existing plaintext rows is complete, idempotent and integrity-preserving.
- Backup/restore preserves tenant isolation and integrity hash.
- Application-level acceptance on the installed runtime (register -> ingest -> analyze -> dashboard)
  against an encrypted store, with the completion gate reading commit-bound evidence.

## 9. Exact decision required (human)

1. **Encryption model:** field-level vs storage-level vs hybrid (recommended: hybrid per `05C-D1`).
2. **Key-management backend:** env var / OS keystore / Vault / cloud KMS / HSM.
3. **Root-key configuration contract:** canonical env var/secret name (resolve the
   `HOOSHyarOS_ROOT_KEY` vs `HOOSHYAR_ENCRYPTION_KEY` inconsistency).
4. **Secrets management path** for production credentials.
5. **Backup solution and backup-key separation.**
6. **Persistence technology** if it changes (SQLite vs PostgreSQL).
7. **Migration authorization:** approve the bounded re-encryption of existing plaintext rows.

Until these are approved, production encryption wiring stays **BLOCKED** and no completion flag changes.

---

**Related evidence:** `.kilo/evidence/governed-commercialization-b1-b5-truth-2026-09-16.txt`
**Audit Memory:** `Docs/HOOSHYAROS_MASTER_CHARTER.md` §15.1.1 / §15.1.4
