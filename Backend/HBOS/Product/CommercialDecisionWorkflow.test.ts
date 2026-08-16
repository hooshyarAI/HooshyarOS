import { CommercialAuthorizationBoundary } from "./CommercialAuthorizationBoundary";
import { CommercialDecisionWorkflow } from "./CommercialDecisionWorkflow";
import { CommercialIdentityService } from "./CommercialIdentityService";
import { CommercialPersistenceBoundary, PersistenceStore } from "./CommercialPersistenceBoundary";

describe("CommercialDecisionWorkflow", () => {
  function createWorkflow() {
    const identity = new CommercialIdentityService();
    identity.initialize();
    const authorization = new CommercialAuthorizationBoundary(identity);
    const data = new Map<string, unknown>();
    const store: PersistenceStore = {
      async read(scope, key) {
        const value = data.get(`${scope.tenantId}:${key}`);
        return value === undefined ? null : { tenantId: scope.tenantId, key, value };
      },
      async write(scope, key, value) {
        data.set(`${scope.tenantId}:${key}`, value);
        return { tenantId: scope.tenantId, key, value };
      },
    };
    return { identity, workflow: new CommercialDecisionWorkflow(authorization, new CommercialPersistenceBoundary(store)), data };
  }

  it("writes a decision only after authorization and preserves tenant scope", async () => {
    const { identity, workflow } = createWorkflow();
    const session = identity.createSession("مدیر", "سازمان تست", "MANAGER");

    await expect(workflow.execute({
      token: session.token,
      organization: "سازمان تست",
      key: "decision-1",
      decision: { action: "review-cashflow" },
    })).resolves.toEqual({
      tenantId: session.tenantId,
      key: "decision-1",
      value: { action: "review-cashflow" },
    });
  });

  it("denies cross-tenant execution before persistence", async () => {
    const { identity, workflow } = createWorkflow();
    const session = identity.createSession("مدیر", "سازمان تست", "MANAGER");

    await expect(workflow.execute({
      token: session.token,
      organization: "سازمان دیگر",
      key: "decision-2",
      decision: { action: "must-not-write" },
    })).rejects.toThrow("AUTHORIZATION_DENIED");
  });

  it("denies revoked sessions before persistence", async () => {
    const { identity, workflow } = createWorkflow();
    const session = identity.createSession("مدیر", "سازمان تست", "MANAGER");
    identity.logout(session.token);

    await expect(workflow.execute({
      token: session.token,
      organization: "سازمان تست",
      key: "decision-3",
      decision: { action: "must-not-write" },
    })).rejects.toThrow("AUTHORIZATION_DENIED");
  });
});
