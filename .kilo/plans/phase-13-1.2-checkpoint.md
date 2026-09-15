# Phase 13-1.2 — Real OrganizationModelEngine

**Phase:** 13
**Stage ID:** 13-1.2
**Title:** Real OrganizationModelEngine (persistent organizations, tenant isolation, membership)
**Owner:** OrganizationModelEngine
**Status:** VERIFIED
**Commit:** `c6d45254`

## Delivered
- `Backend/HBOS/Engines/OrganizationModelEngine.ts` rewritten from stub to real persistent engine.
- `organizations` and `organization_members` tables through `SQLitePersistenceStore`.

## Contract
- `createOrganization(name, description?)` — persistent, idempotent by name, canonical `tenantId`.
- `getOrganizationByName`, `getOrganizationByTenantId`, `listOrganizations`.
- `addMember`, `removeMember`, `isMember`, `listMembers`.
- Empty names return `BLOCKED`; distinct organizations get distinct tenantIds.

## Evidence
`Backend/HBOS/test/OrganizationModelEngine.test.ts` — **6/6 PASS** covering persistence, idempotency, empty-name blocking, tenant separation and membership lifecycle.
