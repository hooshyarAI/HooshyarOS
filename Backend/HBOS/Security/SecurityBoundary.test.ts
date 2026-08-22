import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthenticationService } from "./AuthenticationService";
import { AuthorizationService } from "./AuthorizationService";
import { DurableAuthorizationStore } from "./DurableAuthorizationStore";
import { DurableSessionStore } from "./DurableSessionStore";
import { SecurityAuditStore } from "./SecurityAuditStore";
import { SecurityBoundary } from "./SecurityBoundary";
import { UserCredentialStore } from "./UserCredentialStore";

describe("SecurityBoundary", () => {
    it("composes login, authorization, denial, audit, restart recovery and logout", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-security-boundary-"));
        const databasePath = join(root, "security.sqlite");
        const username = "analyst@example.ir";
        const password = "StrongPassword!2026";

        const buildBoundary = () => {
            const credentials = new UserCredentialStore(databasePath);
            const sessions = new DurableSessionStore(databasePath);
            const assignments = new DurableAuthorizationStore(databasePath);
            const audit = new SecurityAuditStore(databasePath);
            const authorization = new AuthorizationService({ rolePermissions: { analyst: ["financial.read"] } });
            return {
                credentials,
                sessions,
                assignments,
                audit,
                boundary: new SecurityBoundary(new AuthenticationService(credentials, sessions), authorization, assignments, audit),
            };
        };

        let ctx = buildBoundary();
        ctx.credentials.createUser("user-1", username, password);
        ctx.assignments.defineRole("analyst");
        ctx.assignments.definePermission("financial.read");
        ctx.assignments.grant("analyst", "financial.read");
        ctx.assignments.assignRole("user-1", "analyst");

        const login = ctx.boundary.login(username, password);
        expect(login).not.toBeNull();
        expect(ctx.boundary.authorize(login!.token, "financial.read")).toBe(true);
        expect(ctx.boundary.authorize(login!.token, "financial.write")).toBe(false);
        ctx.credentials.close();
        ctx.sessions.close();
        ctx.assignments.close();
        ctx.audit.close();

        ctx = buildBoundary();
        expect(ctx.boundary.authorize(login!.token, "financial.read")).toBe(true);
        ctx.boundary.logout(login!.token);
        expect(ctx.boundary.authorize(login!.token, "financial.read")).toBe(false);
        expect(ctx.audit.listByUser("user-1").map((event) => event.eventType)).toEqual([
            "LOGIN_SUCCESS", "AUTHORIZATION_DENIED", "LOGOUT"
        ]);
        ctx.credentials.close();
        ctx.sessions.close();
        ctx.assignments.close();
        ctx.audit.close();

        await rm(root, { recursive: true, force: true });
    });
});
