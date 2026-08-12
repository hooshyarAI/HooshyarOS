# Organization Identity Service

## Capability
`product.organization-identity-and-rbac`

## Purpose
Provide the first runnable organizational identity boundary for the commercial product: organization context, owner registration, role hierarchy and organization-scoped session state.

## Scope
This capability is organizational/business focused. It does not implement personal-life or personal-finance coaching.

## Current contract
- Creates an organization through the existing `OrganizationModelEngine` owner.
- Registers an organization owner through the existing `SecurityLayerEngine` boundary.
- Opens an organization-scoped authenticated session contract.
- Enforces a deterministic role hierarchy: OWNER > ADMIN > MANAGER > EMPLOYEE > VIEWER.
- Blocks invalid identity operations rather than fabricating successful authentication.

## Explicit boundary
This implementation is an application/domain contract, not a production authentication provider. Durable sessions, password/MFA/OIDC integration, persistence, tenant-isolated storage, token rotation and deployment security remain separate acceptance gaps and must be evidenced before commercial completion.

## Acceptance path
Organization creation -> owner registration -> authenticated organization session -> role authorization -> later integration with durable persistence and web application shell.
