import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthenticationService } from "./AuthenticationService";
import { UserCredentialStore } from "./UserCredentialStore";
import { DurableSessionStore } from "./DurableSessionStore";

describe("AuthenticationService", () => {
    it("authenticates credentials, survives restart, and supports logout", async () => {
        const dir = await mkdtemp(join(tmpdir(), "hooshyar-auth-"));
        const db = join(dir, "auth.sqlite");
        const username = "admin";
        const password = "Strong-Password-2026!";

        try {
            const credentials = new UserCredentialStore(db);
            const sessions = new DurableSessionStore(db);
            credentials.createUser("user-1", username, password);
            const auth = new AuthenticationService(credentials, sessions, 60_000);

            const result = auth.login(username, password);
            expect(result).not.toBeNull();
            expect(result!.userId).toBe("user-1");
            expect(auth.login(username, "wrong-password")).toBeNull();
            credentials.close();
            sessions.close();

            const restoredCredentials = new UserCredentialStore(db);
            const restoredSessions = new DurableSessionStore(db);
            const restoredAuth = new AuthenticationService(restoredCredentials, restoredSessions, 60_000);
            expect(restoredAuth.authenticate(result!.token)).toMatchObject({ userId: "user-1" });

            restoredAuth.logout(result!.token);
            expect(restoredAuth.authenticate(result!.token)).toBeNull();
            restoredCredentials.close();
            restoredSessions.close();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
