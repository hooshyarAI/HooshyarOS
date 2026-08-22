import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableSessionStore } from "./DurableSessionStore";

describe("DurableSessionStore", () => {
    it("keeps sessions valid across restart and supports expiration/revocation", async () => {
        const root = await mkdtemp(join(tmpdir(), "hooshyar-session-"));
        const databasePath = join(root, "security.sqlite");

        try {
            const firstProcess = new DurableSessionStore(databasePath);
            const token = firstProcess.create("user-42", 60_000);
            expect(firstProcess.get(token)?.userId).toBe("user-42");
            firstProcess.close();

            const secondProcess = new DurableSessionStore(databasePath);
            expect(secondProcess.get(token)?.userId).toBe("user-42");
            secondProcess.revoke(token);
            expect(secondProcess.get(token)).toBeNull();
            secondProcess.close();
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
