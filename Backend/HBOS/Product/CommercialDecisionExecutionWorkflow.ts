import { createHash } from "node:crypto";
import { CommercialAuthorizationBoundary } from "./CommercialAuthorizationBoundary";
import { CommercialPersistenceBoundary } from "./CommercialPersistenceBoundary";

export interface CommercialDecisionExecutionInput {
  readonly token: string;
  readonly organization: string;
  readonly decisionId: string;
  readonly decision: unknown;
  readonly approverToken: string;
  readonly approverOrganization: string;
  readonly assignee: string;
}

export interface CommercialDecisionExecutionResult {
  readonly tenantId: string;
  readonly decisionId: string;
  readonly status: "EXECUTED";
  readonly approvedBy: string;
  readonly assignee: string;
  readonly evidenceSha256: string;
}

export class CommercialDecisionExecutionWorkflow {
  constructor(
    private readonly authorization: CommercialAuthorizationBoundary,
    private readonly persistence: CommercialPersistenceBoundary,
  ) {}

  async approveAndExecute(input: CommercialDecisionExecutionInput): Promise<CommercialDecisionExecutionResult> {
    const actor = this.authorization.authorize({ token: input.token, organization: input.organization, permission: "CREATE_DECISION" });
    if (!actor.allowed || !actor.session) throw new Error(actor.reason ?? "AUTHORIZATION_DENIED");

    const approver = this.authorization.authorize({ token: input.approverToken, organization: input.approverOrganization, permission: "CREATE_DECISION" });
    if (!approver.allowed || !approver.session) throw new Error(approver.reason ?? "AUTHORIZATION_DENIED");
    if (approver.session.tenantId !== actor.session.tenantId) throw new Error("APPROVAL_TENANT_SCOPE_MISMATCH");
    if (approver.session.username === actor.session.username) throw new Error("APPROVAL_INDEPENDENCE_REQUIRED");
    if (approver.session.role !== "OWNER" && approver.session.role !== "ADMIN") throw new Error("APPROVAL_ROLE_REQUIRED");
    if (!input.decisionId.trim()) throw new Error("decision-id-required");
    if (!input.assignee.trim()) throw new Error("decision-assignee-required");

    const decisionId = input.decisionId.trim();
    const assignee = input.assignee.trim();
    const evidenceSha256 = createHash("sha256")
      .update(JSON.stringify({ decisionId, decision: input.decision, assignee, approvedBy: approver.session.username }))
      .digest("hex");

    const result: CommercialDecisionExecutionResult = {
      tenantId: actor.session.tenantId,
      decisionId,
      status: "EXECUTED",
      approvedBy: approver.session.username,
      assignee,
      evidenceSha256,
    };

    const scope = { tenantId: actor.session.tenantId };
    await this.persistence.write(scope, `decision:${decisionId}`, { decision: input.decision, approvedBy: result.approvedBy, status: result.status });
    await this.persistence.write(scope, `assignment:${decisionId}`, { assignee, status: "ASSIGNED" });
    await this.persistence.write(scope, `evidence:${decisionId}`, result);
    return result;
  }

  async recordOutcome(token: string, organization: string, decisionId: string, outcome: { kpi: string; target: number; actual: number; feedback?: string }): Promise<void> {
    const authorization = this.authorization.authorize({ token, organization, permission: "CREATE_DECISION" });
    if (!authorization.allowed || !authorization.session) throw new Error(authorization.reason ?? "AUTHORIZATION_DENIED");
    const normalizedDecisionId = decisionId.trim();
    if (!normalizedDecisionId) throw new Error("decision-id-required");
    if (!outcome.kpi.trim()) throw new Error("outcome-kpi-required");
    if (!Number.isFinite(outcome.target) || !Number.isFinite(outcome.actual)) throw new Error("outcome-value-invalid");

    await this.persistence.write({ tenantId: authorization.session.tenantId }, `outcome:${normalizedDecisionId}`, {
      ...outcome,
      variance: outcome.actual - outcome.target,
      recordedBy: authorization.session.username,
    });
  }
}
