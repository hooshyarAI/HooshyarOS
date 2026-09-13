/**
 * Stage 08-GOV.2 — Connector Lifecycle tests.
 */
import {
  CONNECTOR_LIFECYCLE_ERROR_CODES,
  ConnectorRegistry,
} from "../Product/ConnectorRegistry";

describe("ConnectorRegistry (Stage 08-GOV.2)", () => {
  test("register creates a new connector in registered state", () => {
    const r = new ConnectorRegistry();
    r.register({ tenantId: "t1", connectorId: "c1", by: "ops" });
    expect(r.getState("t1", "c1")).toBe("registered");
  });

  test("rejects re-registration of existing connector", () => {
    const r = new ConnectorRegistry();
    r.register({ tenantId: "t1", connectorId: "c1", by: "ops" });
    expect(() => r.register({ tenantId: "t1", connectorId: "c1", by: "ops" }))
      .toThrow(/already-registered/);
  });

  test("valid happy path: registered -> tested -> enabled -> disabled -> retired", () => {
    const r = new ConnectorRegistry();
    r.register({ tenantId: "t1", connectorId: "c1", by: "ops" });
    expect(r.transition({ tenantId: "t1", connectorId: "c1", toState: "tested", by: "ops" })).toBe("tested");
    expect(r.transition({ tenantId: "t1", connectorId: "c1", toState: "enabled", by: "ops" })).toBe("enabled");
    expect(r.transition({ tenantId: "t1", connectorId: "c1", toState: "disabled", by: "ops" })).toBe("disabled");
    expect(r.transition({ tenantId: "t1", connectorId: "c1", toState: "retired", by: "ops" })).toBe("retired");
  });

  test("invalid transition throws", () => {
    const r = new ConnectorRegistry();
    r.register({ tenantId: "t1", connectorId: "c1", by: "ops" });
    expect(() => r.transition({ tenantId: "t1", connectorId: "c1", toState: "enabled", by: "ops" }))
      .toThrow(/registered->enabled/);
  });

  test("retired is terminal", () => {
    const r = new ConnectorRegistry();
    r.register({ tenantId: "t1", connectorId: "c1", by: "ops" });
    r.transition({ tenantId: "t1", connectorId: "c1", toState: "retired", by: "ops" });
    expect(() => r.transition({ tenantId: "t1", connectorId: "c1", toState: "enabled", by: "ops" }))
      .toThrow(/retired->enabled/);
  });

  test("disabled -> enabled is allowed (re-enable)", () => {
    const r = new ConnectorRegistry();
    r.register({ tenantId: "t1", connectorId: "c1", by: "ops" });
    r.transition({ tenantId: "t1", connectorId: "c1", toState: "tested", by: "ops" });
    r.transition({ tenantId: "t1", connectorId: "c1", toState: "enabled", by: "ops" });
    r.transition({ tenantId: "t1", connectorId: "c1", toState: "disabled", by: "ops" });
    expect(r.transition({ tenantId: "t1", connectorId: "c1", toState: "enabled", by: "ops" })).toBe("enabled");
  });

  test("audit trail recorded for every transition", () => {
    const r = new ConnectorRegistry();
    r.register({ tenantId: "t1", connectorId: "c1", by: "alice" });
    r.transition({ tenantId: "t1", connectorId: "c1", toState: "tested", by: "bob" });
    r.transition({ tenantId: "t1", connectorId: "c1", toState: "enabled", by: "ops", reason: "tests-passed" });
    const audit = r.getAudit("t1", "c1");
    expect(audit).toHaveLength(3);
    expect(audit[0].by).toBe("alice");
    expect(audit[2].toState).toBe("enabled");
    expect(audit[2].reason).toBe("tests-passed");
  });

  test("global audit log aggregates across connectors", () => {
    const r = new ConnectorRegistry();
    r.register({ tenantId: "t1", connectorId: "c1", by: "ops" });
    r.register({ tenantId: "t1", connectorId: "c2", by: "ops" });
    r.transition({ tenantId: "t1", connectorId: "c1", toState: "tested", by: "ops" });
    expect(r.getGlobalAudit()).toHaveLength(3);
  });

  test("getState throws for unknown connector", () => {
    const r = new ConnectorRegistry();
    expect(() => r.getState("t1", "missing"))
      .toThrow(CONNECTOR_LIFECYCLE_ERROR_CODES.UNKNOWN_CONNECTOR);
  });

  test("rejects empty tenant/connector/actor", () => {
    const r = new ConnectorRegistry();
    expect(() => r.register({ tenantId: "", connectorId: "c", by: "x" }))
      .toThrow(CONNECTOR_LIFECYCLE_ERROR_CODES.TENANT_REQUIRED);
    expect(() => r.register({ tenantId: "t", connectorId: "", by: "x" }))
      .toThrow(CONNECTOR_LIFECYCLE_ERROR_CODES.CONNECTOR_REQUIRED);
    expect(() => r.register({ tenantId: "t", connectorId: "c", by: "" }))
      .toThrow(CONNECTOR_LIFECYCLE_ERROR_CODES.AUDIT_REQUIRED);
  });

  test("uses injected clock for deterministic timestamps", () => {
    let now = new Date("2026-09-03T12:00:00.000Z");
    const r = new ConnectorRegistry({ now: () => now });
    r.register({ tenantId: "t1", connectorId: "c1", by: "ops" });
    now = new Date("2026-09-03T13:00:00.000Z");
    r.transition({ tenantId: "t1", connectorId: "c1", toState: "tested", by: "ops" });
    const audit = r.getAudit("t1", "c1");
    expect(audit[0].at).toBe("2026-09-03T12:00:00.000Z");
    expect(audit[1].at).toBe("2026-09-03T13:00:00.000Z");
  });
});