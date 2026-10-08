import { mkdtempSync, rmSync } from "node:fs";
import { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";
import { UserManagementEngine } from "../Engines/UserManagementEngine";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";

/**
 * Runtime session-lifecycle maintenance.
 *
 * `UserManagementEngine.cleanupExpiredSessions()` is the canonical owner of
 * expired-session pruning, but `CommercialIdentityService.getSession()` only
 * removes a row lazily when its token is presented again. Without a scheduled
 * sweep a long-running deployment accumulates expired `sessions` rows without
 * bound. These tests prove the runtime actually reaps them.
 */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const waitUntil = async (predicate: () => boolean, timeoutMs = 4000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(25);
  }
  return predicate();
};

/**
 * Reads the canonical owner's session row directly and non-destructively:
 * `getSessionRecord()` never applies expiry logic, so a `null` result proves the
 * row was deleted (rather than merely treated as expired).
 */
const sessionRowExists = (databasePath: string, clock: number, token: string): boolean => {
  const persistence = new SQLitePersistenceStore({ databasePath });
  try {
    const engine = new UserManagementEngine(persistence);
    engine.setNowProvider(() => clock);
    return engine.getSessionRecord(token) !== null;
  } finally {
    persistence.close();
  }
};

describe("runtime session lifecycle sweep", () => {
  let dir: string;
  let databasePath: string;
  let server: Server | undefined;
  let clock = 0;

  const start = async (options: { readonly sessionSweepIntervalMs: number }) => {
    clock = Date.now();
    server = createCommercialRuntimeServer({
      databasePath,
      now: () => clock,
      sessionTtlMs: 60_000,
      sessionSweepIntervalMs: options.sessionSweepIntervalMs
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
  };

  const url = (path: string) => {
    const address = server?.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return `http://127.0.0.1:${address.port}${path}`;
  };

  const register = async (username: string): Promise<string> => {
    const response = await fetch(url("/api/auth/register"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, organization: "SweepCo", password: "Sup3rSecret!" })
    });
    expect(response.status).toBe(201);
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("session-cookie-missing");
    return cookie.split(";")[0];
  };

  const tokenOf = (cookie: string) => cookie.slice(cookie.indexOf("=") + 1);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "hooshyar-session-sweep-"));
    databasePath = join(dir, "runtime.sqlite");
  });

  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  test("reaps an expired session even when its token is never presented again", async () => {
    await start({ sessionSweepIntervalMs: 20 });
    const cookie = await register("sweep-owner");
    const token = tokenOf(cookie);

    // A live session is never swept.
    expect(sessionRowExists(databasePath, clock, token)).toBe(true);

    clock += 120_000; // session TTL (60s) now elapsed, token never replayed

    await expect(waitUntil(() => !sessionRowExists(databasePath, clock, token))).resolves.toBe(true);

    // Real behaviour for a caller that does present the stale credential.
    const stale = await fetch(url("/api/session"), { headers: { cookie } });
    expect(stale.status).toBe(401);
  }, 20_000);

  test("does not reap a still-valid session", async () => {
    await start({ sessionSweepIntervalMs: 20 });
    const cookie = await register("sweep-live-owner");
    const token = tokenOf(cookie);

    clock += 30_000; // within the 60s TTL
    await sleep(150); // several sweeps elapse

    expect(sessionRowExists(databasePath, clock, token)).toBe(true);
    const live = await fetch(url("/api/session"), { headers: { cookie } });
    expect(live.status).toBe(200);
  }, 20_000);

  test("leaves expired rows in place when the sweep is disabled", async () => {
    await start({ sessionSweepIntervalMs: 0 });
    const cookie = await register("sweep-disabled-owner");
    const token = tokenOf(cookie);

    clock += 120_000;
    await sleep(200);

    // Control: nothing but the scheduled sweep removes the row.
    expect(sessionRowExists(databasePath, clock, token)).toBe(true);
  }, 20_000);
});
