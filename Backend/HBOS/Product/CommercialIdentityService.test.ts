import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommercialIdentityService } from "./CommercialIdentityService";

describe("CommercialIdentityService", () => {
  let directory: string;
  let databasePath: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "hooshyar-identity-"));
    databasePath = join(directory, "identity.sqlite");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("keeps sessions and authorization state across service restarts", () => {
    const first = new CommercialIdentityService(databasePath);
    first.initialize();
    const session = first.createSession("alice", "org-a", "MANAGER");
    first.close();

    const second = new CommercialIdentityService(databasePath);
    second.initialize();

    expect(second.getSession(session.token)).toMatchObject({
      username: "alice",
      organization: "org-a",
      role: "MANAGER",
      active: true,
    });
    expect(second.authorize(session.token, "org-a", "CREATE_DECISION").username).toBe("alice");
    expect(() => second.authorize(session.token, "org-b", "CREATE_DECISION")).toThrow("AUTHORIZATION_DENIED");
    second.close();
  });

  it("persists revocation and audit events", () => {
    const first = new CommercialIdentityService(databasePath);
    first.initialize();
    const session = first.createSession("alice", "org-a");
    expect(first.logout(session.token)).toBe(true);
    first.close();

    const second = new CommercialIdentityService(databasePath);
    second.initialize();
    expect(second.getSession(session.token)).toBeNull();
    expect(second.auditTrail().map((event) => event.type)).toEqual([
      "SESSION_CREATED",
      "SESSION_REVOKED",
    ]);
    second.close();
  });
});
