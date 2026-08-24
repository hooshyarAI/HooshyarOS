import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommercialIdentityService } from "./CommercialIdentityService";

describe("Commercial identity security integration", () => {
  it("records authorization and session lifecycle evidence in the durable identity audit trail", async () => {
    const root = await mkdtemp(join(tmpdir(), "hooshyar-security-integration-"));
    const identity = new CommercialIdentityService(join(root, "identity.sqlite"));
    try {
      identity.initialize();
      const session = identity.createSession("security-user", "security-org", "MANAGER");

      expect(() => identity.authorize(session.token, "other-org", "READ_DASHBOARD")).toThrow("AUTHORIZATION_DENIED");
      expect(identity.authorize(session.token, "security-org", "READ_DASHBOARD").tenantId).toBe(session.tenantId);
      expect(identity.logout(session.token)).toBe(true);

      const events = identity.auditTrail();
      expect(events.map(event => event.type)).toEqual([
        "SESSION_CREATED",
        "AUTHORIZATION_DENIED",
        "AUTHORIZATION_ALLOWED",
        "SESSION_REVOKED",
      ]);
    } finally {
      identity.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
