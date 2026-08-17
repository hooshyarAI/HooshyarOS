import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CommercialAuthorizationBoundary } from "./CommercialAuthorizationBoundary";
import { CommercialIdentityService } from "./CommercialIdentityService";
import { CommercialDecisionExecutionWorkflow } from "./CommercialDecisionExecutionWorkflow";
import { CommercialPersistenceBoundary } from "./CommercialPersistenceBoundary";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";
import { FilesystemDecisionExecutor } from "./FilesystemDecisionExecutor";

describe("CommercialDecisionExecutionWorkflow", () => {
  let directory: string;
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "hooshyar-decision-execution-")); });
  afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

  test("executes an observable side effect, persists evidence, and survives restart", async () => {
    const identity = new CommercialIdentityService(join(directory, "identity.sqlite"));
    identity.initialize();
    const actor = identity.createSession("manager", "org-a", "MANAGER");
    const approver = identity.createSession("owner", "org-a", "OWNER");
    const databasePath = join(directory, "product.sqlite");
    const store = new SQLitePersistenceStore({ databasePath });
    const executor = new FilesystemDecisionExecutor(join(directory, "execution"));
    const workflow = new CommercialDecisionExecutionWorkflow(
      new CommercialAuthorizationBoundary(identity),
      new CommercialPersistenceBoundary(store),
      executor,
    );

    const result = await workflow.approveAndExecute({
      token: actor.token, organization: "org-a", decisionId: "decision-42",
      decision: { action: "review-cashflow", priority: "high" },
      approverToken: approver.token, approverOrganization: "org-a", assignee: "finance-team",
    });

    await workflow.recordOutcome(actor.token, "org-a", "decision-42", {
      kpi: "cash-coverage", target: 1.2, actual: 1.35, feedback: "coverage improved",
    });

    expect(result.status).toBe("EXECUTED");
    expect(result.evidenceSha256).toHaveLength(64);

    const receipt = JSON.parse(readFileSync(result.executionReceiptPath, "utf8")) as {
      tenantId: string; decisionId: string; assignee: string; approvedBy: string; action: { action: string };
    };
    expect(receipt).toMatchObject({ tenantId: actor.tenantId, decisionId: "decision-42", assignee: "finance-team", approvedBy: "owner", action: { action: "review-cashflow" } });

    await expect(store.read({ tenantId: actor.tenantId }, "decision:decision-42")).resolves.toMatchObject({ value: { status: "EXECUTED" } });
    await expect(store.read({ tenantId: actor.tenantId }, "assignment:decision-42")).resolves.toMatchObject({ value: { assignee: "finance-team", status: "ASSIGNED" } });
    const outcome = await store.read({ tenantId: actor.tenantId }, "outcome:decision-42");
    expect(outcome?.value).toMatchObject({ kpi: "cash-coverage", feedback: "coverage improved", variance: 0.15 });
    await expect(store.read({ tenantId: "other-tenant" }, "decision:decision-42")).resolves.toBeNull();

    store.close();
    const reopened = new SQLitePersistenceStore({ databasePath });
    await expect(reopened.read({ tenantId: actor.tenantId }, "decision:decision-42")).resolves.toMatchObject({ value: { status: "EXECUTED" } });
    await expect(reopened.read({ tenantId: actor.tenantId }, "assignment:decision-42")).resolves.toMatchObject({ value: { assignee: "finance-team" } });
    await expect(reopened.read({ tenantId: actor.tenantId }, "outcome:decision-42")).resolves.toMatchObject({ value: { variance: 0.15 } });
    await expect(reopened.read({ tenantId: "other-tenant" }, "decision:decision-42")).resolves.toBeNull();
    reopened.close();
    identity.close();
  });

  test("requires an independent privileged approver from the same tenant", async () => {
    const identity = new CommercialIdentityService(join(directory, "identity.sqlite"));
    identity.initialize();
    const actor = identity.createSession("manager", "org-a", "MANAGER");
    const otherManager = identity.createSession("manager-2", "org-a", "MANAGER");
    const store = new SQLitePersistenceStore({ databasePath: join(directory, "product.sqlite") });
    const executor = new FilesystemDecisionExecutor(join(directory, "execution"));
    const workflow = new CommercialDecisionExecutionWorkflow(new CommercialAuthorizationBoundary(identity), new CommercialPersistenceBoundary(store), executor);

    await expect(workflow.approveAndExecute({
      token: actor.token, organization: "org-a", decisionId: "decision-denied", decision: { action: "unsafe" },
      approverToken: otherManager.token, approverOrganization: "org-a", assignee: "finance-team",
    })).rejects.toThrow("APPROVAL_ROLE_REQUIRED");

    store.close();
    identity.close();
  });
});
