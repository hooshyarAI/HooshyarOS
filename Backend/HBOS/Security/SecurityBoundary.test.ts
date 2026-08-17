import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthenticationService } from "./AuthenticationService";
import { AuthorizationService } from "./AuthorizationService";
import { DurableAuthorizationStore } from "./DurableAuthorizationStore";
import { SecurityAuditStore } from "./SecurityAuditStore";
import { SecurityBoundary } from "./SecurityBoundary";
import { UserCredentialStore } from "./UserCredentialStore";

describe("SecurityBoundary", () => {
    it("composes login, authorization, denial, audit and logout", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-security-boundary-"));
        const databasePath = join(root, "security.sqlite");
        const credentials = new UserCredentialStore(databasePath);
        const sessions = new (require("./DurableSessionStore").DurableSessionStore)(databasePath);
        const assignments = new DurableAuthorizationStore(databasePath);
        const audit = new SecurityAuditStore(databasePath);
        const authorization = new AuthorizationService({ rolePermissions: { analyst: ["financial.read"] } });
        credentials.createUser("user-1", "analyst@example.ir", "StrongPassword!2026");
        assignments.defineRole("analyst");
        assignments.definePermission("financial.read");
        assignments.grant("analyst", "financial.read");
        assignments.assignRole("user-1", "analyst");
        const boundary = new SecurityBoundary(new AuthenticationService(credentials, sessions), authorization, assignments, audit);

        const login = boundary.login("analyst@example.ir", "StrongPassword!2026");
        expect(login).not.toBeNull();
        expect(boundary.authorize(login!.token, "financial.read")).toBe(true);
        expect(boundary.authorize(login!.token, "financial.write")).toBe(false);
        boundary.logout(login!.token);
        expect(boundary.authorize(login!.token, "financial.read")).toBe(false);
        expect(audit.listByUser("user-1").map((event) => event.eventType)).toEqual([
            "LOGIN_SUCCESS", "AUTHORIZATION_DENIED", "LOGOUT"
        ]);
        credentials.close();
        sessions.close();
        assignments.close();
        audit.close();
        await rm(root, { recursive: true, force: true });
    });
});
