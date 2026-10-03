/**
 * Stage 08-GOV.1 — Credential Vault tests.
 */
import {
  CREDENTIAL_ERROR_CODES,
  CredentialVault,
  redactCredential,
  redactError,
  type VaultCredential,
} from "../Product/CredentialVault";

describe("CredentialVault (Stage 08-GOV.1)", () => {
  let vault: CredentialVault;
  beforeEach(() => { vault = new CredentialVault(); });

  test("stores and retrieves a credential", () => {
    const cred: VaultCredential = {
      kind: "oauth2", payload: { accessToken: "secret-123" }, createdAt: "2026-01-01",
    };
    vault.storeCredential("t1", "api-1", cred);
    const out = vault.retrieveCredential("t1", "api-1");
    expect(out).toEqual(cred);
  });

  test("rejects empty tenant and connector", () => {
    expect(() => vault.storeCredential("", "c", { kind: "k", payload: {}, createdAt: "" }))
      .toThrow(CREDENTIAL_ERROR_CODES.TENANT_REQUIRED);
    expect(() => vault.storeCredential("t", "", { kind: "k", payload: {}, createdAt: "" }))
      .toThrow(CREDENTIAL_ERROR_CODES.CONNECTOR_REQUIRED);
  });

  test("throws NOT_FOUND for missing credential", () => {
    expect(() => vault.retrieveCredential("t1", "missing"))
      .toThrow(CREDENTIAL_ERROR_CODES.NOT_FOUND);
  });

  test("deleteCredential returns true when removed", () => {
    vault.storeCredential("t", "c", { kind: "k", payload: {}, createdAt: "" });
    expect(vault.deleteCredential("t", "c")).toBe(true);
    expect(() => vault.retrieveCredential("t", "c")).toThrow();
  });

  test("listConnectorIds is tenant-scoped", () => {
    vault.storeCredential("t1", "a", { kind: "k", payload: {}, createdAt: "" });
    vault.storeCredential("t1", "b", { kind: "k", payload: {}, createdAt: "" });
    vault.storeCredential("t2", "a", { kind: "k", payload: {}, createdAt: "" });
    expect([...vault.listConnectorIds("t1")].sort()).toEqual(["a", "b"]);
    expect(vault.listConnectorIds("t2")).toEqual(["a"]);
  });

  test("reset clears all credentials", () => {
    vault.storeCredential("t1", "a", { kind: "k", payload: {}, createdAt: "" });
    vault.reset();
    expect(vault.listConnectorIds("t1")).toEqual([]);
  });

  test("redactCredential masks sensitive keys", () => {
    const out = redactCredential({
      username: "alice",
      password: "p",
      apiKey: "k",
      nested: { token: "tk", ok: 1 },
    }) as Record<string, unknown>;
    expect(out.username).toBe("alice");
    expect(out.password).toBe("<redacted>");
    expect(out.apiKey).toBe("<redacted>");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.token).toBe("<redacted>");
    expect(nested.ok).toBe(1);
  });

  test("redactCredential is case-insensitive on key names", () => {
    const out = redactCredential({ Authorization: "Bearer x" }) as Record<string, unknown>;
    expect(out.Authorization).toBe("<redacted>");
  });

  test("redactError returns redacted message", () => {
    const err = new Error("failed with token=secret-abc");
    const red = redactError(err);
    expect(red.message).toContain("<redacted>");
    expect(red.message).not.toContain("secret-abc");
  });

  test("cross-tenant isolation: t2 cannot read t1 credential", () => {
    vault.storeCredential("t1", "c", { kind: "k", payload: {}, createdAt: "" });
    expect(() => vault.retrieveCredential("t2", "c")).toThrow();
  });
});