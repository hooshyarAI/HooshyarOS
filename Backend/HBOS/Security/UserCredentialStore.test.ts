import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { UserCredentialStore } from "./UserCredentialStore";

describe("UserCredentialStore", () => {
    it("persists credentials and authenticates after a database restart", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-auth-"));
        const databasePath = join(root, "auth.sqlite");

        try {
            const first = new UserCredentialStore(databasePath);
            first.createUser("user-1", "Admin@Example.com", "A-secure-password-2026");
            expect(first.authenticate("admin@example.com", "A-secure-password-2026")).toEqual({ userId: "user-1" });
            expect(first.authenticate("admin@example.com", "wrong-password-2026")).toBeNull();
            first.close();

            const second = new UserCredentialStore(databasePath);
            expect(second.authenticate("admin@example.com", "A-secure-password-2026")).toEqual({ userId: "user-1" });
            second.close();
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
