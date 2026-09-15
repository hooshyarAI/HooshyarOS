import { createHash } from "node:crypto";

/**
 * Canonical tenant identity derivation.
 *
 * A tenant is an organization boundary. Every tenant-scoped resource must carry
 * the same tenantId produced here so that tenant isolation is verifiable at the
 * repository boundary (see Docs/ARCHITECTURE.md and Security/TenantIsolation).
 */
export function deriveTenantId(organization: string): string {
    const normalized = organization?.trim().normalize("NFKC") ?? "";
    if (!normalized) throw new Error("tenant-organization-required");
    return `tenant:${createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16)}`;
}
