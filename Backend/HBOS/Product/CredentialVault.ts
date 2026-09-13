/**
 * Stage 08-GOV.1 — Credential Isolation.
 *
 * Pure supporting service. Stores and retrieves credentials keyed by
 * (tenantId, connectorId). Credentials are kept as opaque objects so
 * the vault never logs or stringifies their values. A redaction
 * serializer is provided for evidence / logs / errors.
 *
 * The vault is in-memory in this stage. The canonical SQLitePersistenceStore
 * boundary is used by future stages to make the vault durable (per
 * Architecture Freeze V4, all persistence flows through the persistence
 * store). This module is NOT a new Engine.
 */

export const CREDENTIAL_ERROR_CODES = {
  TENANT_REQUIRED: "ingestion-credential-tenant-required",
  CONNECTOR_REQUIRED: "ingestion-credential-connector-required",
  CREDENTIAL_REQUIRED: "ingestion-credential-required",
  NOT_FOUND: "ingestion-credential-not-found",
} as const;

export interface VaultCredential {
  readonly kind: string;
  /** Opaque payload. Must never be stringified by callers. */
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface CredentialVaultRecord {
  readonly tenantId: string;
  readonly connectorId: string;
  readonly credential: VaultCredential;
}

export class CredentialVault {
  private readonly store: Map<string, VaultCredential> = new Map();

  private key(tenantId: string, connectorId: string): string {
    return `${tenantId}::${connectorId}`;
  }

  storeCredential(tenantId: string, connectorId: string, credential: VaultCredential): void {
    if (!tenantId?.trim()) throw new Error(CREDENTIAL_ERROR_CODES.TENANT_REQUIRED);
    if (!connectorId?.trim()) throw new Error(CREDENTIAL_ERROR_CODES.CONNECTOR_REQUIRED);
    if (!credential || typeof credential !== "object") {
      throw new Error(CREDENTIAL_ERROR_CODES.CREDENTIAL_REQUIRED);
    }
    this.store.set(this.key(tenantId, connectorId), credential);
  }

  retrieveCredential(tenantId: string, connectorId: string): VaultCredential {
    if (!tenantId?.trim()) throw new Error(CREDENTIAL_ERROR_CODES.TENANT_REQUIRED);
    if (!connectorId?.trim()) throw new Error(CREDENTIAL_ERROR_CODES.CONNECTOR_REQUIRED);
    const cred = this.store.get(this.key(tenantId, connectorId));
    if (!cred) throw new Error(CREDENTIAL_ERROR_CODES.NOT_FOUND);
    return cred;
  }

  deleteCredential(tenantId: string, connectorId: string): boolean {
    return this.store.delete(this.key(tenantId, connectorId));
  }

  listConnectorIds(tenantId: string): ReadonlyArray<string> {
    if (!tenantId?.trim()) throw new Error(CREDENTIAL_ERROR_CODES.TENANT_REQUIRED);
    const prefix = `${tenantId}::`;
    const out: string[] = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
    }
    return out;
  }

  /** For tests only. */
  reset(): void { this.store.clear(); }
}

const REDACTED = "<redacted>";

const SENSITIVE_KEYS = new Set([
  "password", "secret", "token", "apikey", "api_key", "authorization",
  "auth", "credential", "credentials", "private", "privatekey", "private_key",
  "bearer", "access", "refresh", "session", "cookie", "ssh", "key",
]);

/**
 * Recursively redact sensitive fields. Stringifies non-sensitive
 * values normally. Replaces sensitive keys with the literal string
 * `<redacted>`.
 */
export function redactCredential(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactCredential(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = REDACTED;
      } else {
        out[k] = redactCredential(v, depth + 1);
      }
    }
    return out;
  }
  return REDACTED;
}

function redactKvPatterns(s: string): string {
  // Replace common `key=value` / `key: value` patterns whose key is
  // sensitive. This complements the structural redactor in
  // redactCredential which only handles object keys.
  return s.replace(
    /\b(password|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|bearer|cookie)\b\s*[:=]\s*[^\s,;}\]"']+/gi,
    (m) => m.replace(/[:=].*/, ": <redacted>"),
  );
}

export function redactError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: redactKvPatterns(redactCredential(err.message) as string),
      stack: err.stack ? redactKvPatterns(redactCredential(err.stack) as string) : undefined,
    };
  }
  return { name: "UnknownError", message: redactKvPatterns(redactCredential(String(err)) as string) };
}