/**
 * Stage 08-GOV.2 — Connector Lifecycle.
 *
 * Pure supporting service. Manages a state machine for connectors:
 *   registered -> tested -> enabled -> disabled -> retired
 *
 * Transitions are explicit and audited. The audit trail records
 * (connectorId, tenantId, fromState, toState, at, by) for every
 * successful transition. Invalid transitions throw.
 *
 * This module is NOT a new Engine.
 */

export const CONNECTOR_LIFECYCLE_ERROR_CODES = {
  TENANT_REQUIRED: "ingestion-connector-tenant-required",
  CONNECTOR_REQUIRED: "ingestion-connector-connector-required",
  STATE_REQUIRED: "ingestion-connector-state-required",
  INVALID_TRANSITION: "ingestion-connector-invalid-transition",
  UNKNOWN_CONNECTOR: "ingestion-connector-unknown",
  AUDIT_REQUIRED: "ingestion-connector-audit-required",
} as const;

export type ConnectorState =
  | "registered"
  | "tested"
  | "enabled"
  | "disabled"
  | "retired";

const ALLOWED: Record<ConnectorState, ReadonlyArray<ConnectorState>> = {
  registered: ["tested", "retired"],
  tested: ["enabled", "registered", "retired"],
  enabled: ["disabled", "retired"],
  disabled: ["enabled", "retired"],
  retired: [],
};

export interface ConnectorAuditEntry {
  readonly connectorId: string;
  readonly tenantId: string;
  readonly fromState: ConnectorState;
  readonly toState: ConnectorState;
  readonly at: string;
  readonly by: string;
  readonly reason?: string;
}

interface ConnectorRecord {
  state: ConnectorState;
  audit: ConnectorAuditEntry[];
}

export interface TransitionParams {
  readonly tenantId: string;
  readonly connectorId: string;
  readonly toState: ConnectorState;
  readonly by: string;
  readonly reason?: string;
  readonly now?: () => Date;
}

export class ConnectorRegistry {
  private readonly records: Map<string, ConnectorRecord> = new Map();
  private readonly auditLog: ConnectorAuditEntry[] = [];
  private readonly now: () => Date;

  constructor(options: { readonly now?: () => Date } = {}) {
    this.now = options.now ?? (() => new Date());
  }

  private key(tenantId: string, connectorId: string): string {
    return `${tenantId}::${connectorId}`;
  }

  register(params: { readonly tenantId: string; readonly connectorId: string; readonly by: string }): void {
    if (!params.tenantId?.trim()) throw new Error(CONNECTOR_LIFECYCLE_ERROR_CODES.TENANT_REQUIRED);
    if (!params.connectorId?.trim()) throw new Error(CONNECTOR_LIFECYCLE_ERROR_CODES.CONNECTOR_REQUIRED);
    if (!params.by?.trim()) throw new Error(CONNECTOR_LIFECYCLE_ERROR_CODES.AUDIT_REQUIRED);
    const k = this.key(params.tenantId, params.connectorId);
    if (this.records.has(k)) {
      throw new Error(`${CONNECTOR_LIFECYCLE_ERROR_CODES.INVALID_TRANSITION}:already-registered`);
    }
    const at = this.now().toISOString();
    const initial: ConnectorAuditEntry = {
      connectorId: params.connectorId,
      tenantId: params.tenantId,
      fromState: "registered",
      toState: "registered",
      at,
      by: params.by,
    };
    this.records.set(k, { state: "registered", audit: [initial] });
    this.auditLog.push(initial);
  }

  getState(tenantId: string, connectorId: string): ConnectorState {
    const r = this.records.get(this.key(tenantId, connectorId));
    if (!r) throw new Error(CONNECTOR_LIFECYCLE_ERROR_CODES.UNKNOWN_CONNECTOR);
    return r.state;
  }

  /** Returns a snapshot copy of the audit log for a connector. */
  getAudit(tenantId: string, connectorId: string): ReadonlyArray<ConnectorAuditEntry> {
    const r = this.records.get(this.key(tenantId, connectorId));
    if (!r) throw new Error(CONNECTOR_LIFECYCLE_ERROR_CODES.UNKNOWN_CONNECTOR);
    return [...r.audit];
  }

  /** Returns a copy of the global audit log. */
  getGlobalAudit(): ReadonlyArray<ConnectorAuditEntry> { return [...this.auditLog]; }

  transition(p: TransitionParams): ConnectorState {
    if (!p.tenantId?.trim()) throw new Error(CONNECTOR_LIFECYCLE_ERROR_CODES.TENANT_REQUIRED);
    if (!p.connectorId?.trim()) throw new Error(CONNECTOR_LIFECYCLE_ERROR_CODES.CONNECTOR_REQUIRED);
    if (!p.by?.trim()) throw new Error(CONNECTOR_LIFECYCLE_ERROR_CODES.AUDIT_REQUIRED);
    const r = this.records.get(this.key(p.tenantId, p.connectorId));
    if (!r) throw new Error(CONNECTOR_LIFECYCLE_ERROR_CODES.UNKNOWN_CONNECTOR);
    const allowed = ALLOWED[r.state];
    if (!allowed.includes(p.toState)) {
      throw new Error(
        `${CONNECTOR_LIFECYCLE_ERROR_CODES.INVALID_TRANSITION}:${r.state}->${p.toState}`,
      );
    }
    const entry: ConnectorAuditEntry = {
      connectorId: p.connectorId,
      tenantId: p.tenantId,
      fromState: r.state,
      toState: p.toState,
      at: (p.now ?? this.now)().toISOString(),
      by: p.by,
      ...(p.reason ? { reason: p.reason } : {}),
    };
    r.state = p.toState;
    r.audit.push(entry);
    this.auditLog.push(entry);
    return r.state;
  }
}