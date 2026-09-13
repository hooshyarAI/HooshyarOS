# Organization Model Engine

Canonical Phase 2 capability, upgraded in Phase 13-1.2 to persistent organizations with membership. Depends on User Management.

## Ownership
Owns persistent organizations and the tenant boundary. An organization name deterministically derives the canonical `tenantId` used by every tenant-scoped repository.

## Persistence
Uses `SQLitePersistenceStore`. Organizations are stored in the `organizations` table and membership in `organization_members`. Organization creation is idempotent by name.

## Contract
- `createOrganization(name, description?)` — persistent, idempotent; returns the existing organization when one already exists.
- `getOrganizationByName(name)`, `getOrganizationByTenantId(tenantId)`, `listOrganizations()`.
- `addMember(tenantId, userId, role?)`, `removeMember(tenantId, userId)`, `isMember(tenantId, userId)`, `listMembers(tenantId)`.
- `tenantIdForOrganization(name)`.

## Tenant isolation
`tenantId` is derived by `deriveTenantId` in `Core/TenantIdentity`. Cross-tenant reads return no data and membership is scoped by `tenantId`.

## Verification
`Backend/HBOS/test/OrganizationModelEngine.test.ts` covers persistence, idempotency, empty-name blocking, tenant separation and membership lifecycle.
