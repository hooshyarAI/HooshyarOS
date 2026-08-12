# Tenant Persistence Service

## Purpose

`TenantPersistenceService` is the durable persistence boundary for commercial organizational data.

## Guarantees

- tenant data is stored under a tenant-specific key/file
- organization ownership is persisted with the tenant record
- writes are atomic at the local file boundary
- version numbers increase monotonically for a tenant
- reads reject cross-organization access with `TENANT_ISOLATION_VIOLATION`

## Provider boundary

`TenantPersistenceStore` is intentionally provider-agnostic. The current repository implementation is `LocalTenantPersistenceStore`, which provides a deterministic durable local implementation for development and local acceptance testing.

A later PostgreSQL/object-storage provider may replace the store without changing product semantics.

## Non-claims

This capability does not yet claim production-grade PostgreSQL deployment, distributed transactions, backup orchestration, encryption-at-rest, or disaster recovery. Those belong to production persistence/deployment acceptance layers.
