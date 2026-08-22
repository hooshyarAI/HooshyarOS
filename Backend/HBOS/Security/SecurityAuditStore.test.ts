import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SecurityAuditStore } from "./SecurityAuditStore";

describe("SecurityAuditStore", () => {
    it("persists security evidence across restart without storing raw session tokens", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-audit-"));
        const databasePath = join(root, "security.sqlite");
        const token = "secret-session-token";
        let store = new SecurityAuditStore(databasePath);
        store.recordSessionEvent("LOGIN_SUCCESS", "user-1", token);
        store.record({ eventType: "AUTHORIZATION_DENIED", userId: "user-1", permission: "financial.write", reason: "missing permission" });
        store.close();

        store = new SecurityAuditStore(databasePath);
        const events = store.listByUser("user-1");
        expect(events).toHaveLength(2);
        expect(events[0].sessionIdHash).toMatch(/^[a-f0-9]{64}$/);
        expect(events[0].sessionIdHash).not.toBe(token);
        expect(events[1]).toMatchObject({ eventType: "AUTHORIZATION_DENIED", permission: "financial.write" });
        store.close();
        await rm(root, { recursive: true, force: true });
    });
});
