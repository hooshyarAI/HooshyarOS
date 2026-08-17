import { createHash } from "node:crypto";
import { CommercialAuthorizationBoundary } from "./CommercialAuthorizationBoundary";
import { CommercialPersistenceBoundary } from "./CommercialPersistenceBoundary";
import { FilesystemDecisionExecutor } from "./FilesystemDecisionExecutor";

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
  readonly executionReceiptPath: string;
}

/**
 * Governed decision-to-execution vertical slice.
 *
 * Authorization -> approval -> observable operational execution -> independent
 * evidence hash -> durable decision/assignment/evidence persistence.
 */
export class CommercialDecisionExecutionWorkflow {
  constructor(
    private readonly authorization: CommercialAuthorizationBoundary,
    private readonly persistence: CommercialPersistenceBoundary,
    private readonly executor: FilesystemDecisionExecutor,
  ) {}

  async approveAndExecute(input: CommercialDecisionExecutionInput): Promise<CommercialDecisionExecutionResult> {
    const actor = this.authorization.authorize({
      token: input.token,
      organization: input.organization,
      permission: "CREATE_DECISION",
    });
    if (!actor.allowed || !actor.session) throw new Error(actor.reason ?? "AUTHORIZATION_DENIED");

    const approver = this.authorization.authorize({
      token: input.approverToken,
      organization: input.approverOrganization,
      permission: "CREATE_DECISION",
    });
    if (!approver.allowed || !approver.session) throw new Error(approver.reason ?? "AUTHORIZATION_DENIED");
    if (approver.session.tenantId !== actor.session.tenantId) throw new Error("APPROVAL_TENANT_SCOPE_MISMATCH");
    if (approver.session.role !== "OWNER" && approver.session.role !== "ADMIN") throw new Error("APPROVAL_ROLE_REQUIRED");
    if (!input.decisionId.trim()) throw new Error("decision-id-required");
    if (!input.assignee.trim()) throw new Error("decision-assignee-required");

    const scope = { tenantId: actor.session.tenantId };
    const execution = await this.executor.execute({
      tenantId: actor.session.tenantId,
      decisionId: input.decisionId.trim(),
      assignee: input.assignee.trim(),
      approvedBy: approver.session.username,
      action: input.decision,
    });
    if (!execution.executed || execution.receiptBytes.length === 0) {
      throw new Error("EXECUTION_SIDE_EFFECT_UNVERIFIED");
    }

    const evidenceSha256 = createHash("sha256").update(execution.receiptBytes).digest("hex");
    const result: CommercialDecisionExecutionResult = {
      tenantId: actor.session.tenantId,
      decisionId: input.decisionId.trim(),
      status: "EXECUTED",
      approvedBy: approver.session.username,
      assignee: input.assignee.trim(),
      evidenceSha256,
      executionReceiptPath: execution.receiptPath,
    };

    await this.persistence.write(scope, `decision:${result.decisionId}`, {
      decision: input.decision,
      approvedBy: result.approvedBy,
      status: result.status,
    });
    await this.persistence.write(scope, `assignment:${result.decisionId}`, {
      assignee: result.assignee,
      status: "ASSIGNED",
    });
    await this.persistence.write(scope, `evidence:${result.decisionId}`, result);
    return result;
  }

  async recordOutcome(token: string, organization: string, decisionId: string, outcome: { kpi: string; target: number; actual: number; feedback?: string }): Promise<void> {
    const authorization = this.authorization.authorize({ token, organization, permission: "CREATE_DECISION" });
    if (!authorization.allowed || !authorization.session) throw new Error(authorization.reason ?? "AUTHORIZATION_DENIED");
    if (!decisionId.trim()) throw new Error("decision-id-required");
    if (!outcome.kpi.trim()) throw new Error("outcome-kpi-required");
    await this.persistence.write({ tenantId: authorization.session.tenantId }, `outcome:${decisionId.trim()}`, {
      ...outcome,
      variance: outcome.actual - outcome.target,
      recordedBy: authorization.session.username,
    });
  }
}
