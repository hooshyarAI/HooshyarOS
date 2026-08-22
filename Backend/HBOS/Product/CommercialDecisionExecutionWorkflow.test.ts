import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CommercialAuthorizationBoundary } from "./CommercialAuthorizationBoundary";
import { CommercialDecisionExecutionWorkflow } from "./CommercialDecisionExecutionWorkflow";
import { CommercialIdentityService } from "./CommercialIdentityService";
import { CommercialPersistenceBoundary } from "./CommercialPersistenceBoundary";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { FilesystemDecisionExecutor } from "./FilesystemDecisionExecutor";

describe("CommercialDecisionExecutionWorkflow", () => {
  let directory: string;
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "hooshyar-decision-execution-")); });
  afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

  test("executes observable side effect, persists evidence/outcome, and survives restart", async () => {
    const identity = new CommercialIdentityService(join(directory, "identity.sqlite"));
    identity.initialize();
    const actor = identity.createSession("manager", "org-a", "MANAGER");
    const approver = identity.createSession("owner", "org-a", "OWNER");
    const databasePath = join(directory, "product.sqlite");
    const store = new SQLitePersistenceStore({ databasePath });
    const workflow = new CommercialDecisionExecutionWorkflow(
      new CommercialAuthorizationBoundary(identity),
      new CommercialPersistenceBoundary(store),
      new FilesystemDecisionExecutor(join(directory, "execution")),
    );

    const result = await workflow.approveAndExecute({
      token: actor.token, organization: "org-a", decisionId: "decision-42",
      decision: { action: "review-cashflow", priority: "high" },
      approverToken: approver.token, approverOrganization: "org-a", assignee: "finance-team",
    });
    await workflow.recordOutcome(actor.token, "org-a", "decision-42", { kpi: "cash-coverage", target: 1.2, actual: 1.35, feedback: "coverage improved" });

    expect(result).toMatchObject({ tenantId: actor.tenantId, decisionId: "decision-42", status: "EXECUTED", approvedBy: "owner", assignee: "finance-team" });
    expect(result.evidenceSha256).toHaveLength(64);
    const receipt = JSON.parse(readFileSync(result.executionReceiptPath, "utf8")) as { tenantId: string; decisionId: string; assignee: string; approvedBy: string };
    expect(receipt).toMatchObject({ tenantId: actor.tenantId, decisionId: "decision-42", assignee: "finance-team", approvedBy: "owner" });
    await expect(store.read({ tenantId: actor.tenantId }, "decision:decision-42")).resolves.toMatchObject({ value: { status: "EXECUTED" } });
    await expect(store.read({ tenantId: actor.tenantId }, "assignment:decision-42")).resolves.toMatchObject({ value: { assignee: "finance-team", status: "ASSIGNED" } });
    await expect(store.read({ tenantId: actor.tenantId }, "evidence:decision-42")).resolves.toMatchObject({ value: { evidenceSha256: result.evidenceSha256 } });
    await expect(store.read({ tenantId: actor.tenantId }, "outcome:decision-42")).resolves.toMatchObject({ value: { variance: 0.15, feedback: "coverage improved" } });
    await expect(store.read({ tenantId: "other-tenant" }, "decision:decision-42")).resolves.toBeNull();

    store.close();
    const reopened = new SQLitePersistenceStore({ databasePath });
    await expect(reopened.read({ tenantId: actor.tenantId }, "decision:decision-42")).resolves.toMatchObject({ value: { status: "EXECUTED" } });
    await expect(reopened.read({ tenantId: actor.tenantId }, "outcome:decision-42")).resolves.toMatchObject({ value: { variance: 0.15 } });
    await expect(reopened.read({ tenantId: "other-tenant" }, "decision:decision-42")).resolves.toBeNull();
    reopened.close();
    identity.close();
  });

  test("rejects self-approval and cross-tenant approval", async () => {
    const identity = new CommercialIdentityService(join(directory, "identity.sqlite"));
    identity.initialize();
    const actor = identity.createSession("owner", "org-a", "OWNER");
    const otherTenantOwner = identity.createSession("owner-b", "org-b", "OWNER");
    const sameTenantStore = new SQLitePersistenceStore({ databasePath: join(directory, "product.sqlite") });
    const workflow = new CommercialDecisionExecutionWorkflow(
      new CommercialAuthorizationBoundary(identity),
      new CommercialPersistenceBoundary(sameTenantStore),
      new FilesystemDecisionExecutor(join(directory, "execution")),
    );

    await expect(workflow.approveAndExecute({ token: actor.token, organization: "org-a", decisionId: "self-approved", decision: { action: "unsafe" }, approverToken: actor.token, approverOrganization: "org-a", assignee: "finance-team" })).rejects.toThrow("APPROVAL_INDEPENDENCE_REQUIRED");
    await expect(workflow.approveAndExecute({ token: actor.token, organization: "org-a", decisionId: "cross-tenant", decision: { action: "unsafe" }, approverToken: otherTenantOwner.token, approverOrganization: "org-b", assignee: "finance-team" })).rejects.toThrow("APPROVAL_TENANT_SCOPE_MISMATCH");

    sameTenantStore.close();
    identity.close();
  });
});
