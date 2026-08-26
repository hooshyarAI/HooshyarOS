import { execFileSync, spawn, ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const port = Number(process.env.HOOSHYAR_FACTORY_PORT ?? "4173");
const databasePath = resolve(root, process.env.HOOSHYAR_FACTORY_DB ?? "data/hooshyar-final-factory.sqlite");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const git = process.platform === "win32" ? "git.exe" : "git";

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function run(command: string, args: string[], timeout = 15 * 60 * 1000): void {
  execFileSync(command, args, { cwd: root, stdio: "inherit", timeout, env: process.env });
}

function assertCleanRepo(): void {
  const status = execFileSync(git, ["status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" }).trim();
  if (status) throw new Error(`FACTORY_WORKTREE_DIRTY:\n${status}`);
}

async function waitHealth(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok && (await response.json() as { status?: string }).status === "ok") return;
    } catch {}
    await sleep(250);
  }
  throw new Error("FACTORY_RUNTIME_HEALTH_TIMEOUT");
}

async function request(path: string, init: RequestInit = {}): Promise<{ status: number; body: any; cookie?: string }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { status: response.status, body, cookie: response.headers.get("set-cookie") ?? undefined };
}

async function startRuntime(): Promise<ChildProcess> {
  mkdirSync(resolve(root, "data"), { recursive: true });
  const child = spawn(npm, ["run", "start:commercial"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, HOOSHYAR_DB_PATH: databasePath, PORT: String(port) }
  });
  await waitHealth();
  return child;
}

async function stopRuntime(child: ChildProcess): Promise<void> {
  if (child.exitCode === null) {
    child.kill();
    await sleep(750);
  }
}

async function main(): Promise<void> {
  console.log(JSON.stringify({ type: "FINAL_PRODUCT_FACTORY", stage: "READ", ok: true, mode: "runtime-first" }));
  assertCleanRepo();

  let runtime: ChildProcess | undefined;
  try {
    runtime = await startRuntime();
    console.log(JSON.stringify({ type: "FINAL_PRODUCT_FACTORY", stage: "RUN", ok: true, details: `health:${port}` }));

    const session = await request("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "factory-qa", organization: "Hooshyar Factory" })
    });
    if (session.status !== 201 || !session.cookie) throw new Error(`FACTORY_SESSION_FAILED:${session.status}`);
    const cookie = session.cookie.split(";")[0];
    const tenantId = String(session.body?.tenantId ?? "");
    if (!tenantId) throw new Error("FACTORY_TENANT_MISSING");

    const csv = [
      "date,account,debit,credit,currency",
      "2026-08-01,Cash,1000,0,IRR",
      "2026-08-02,Sales,0,1500,IRR",
      "2026-08-03,Expense,300,0,IRR",
      "2026-08-04,Receivable,0,800,IRR"
    ].join("\\n");

    const analysis = await request("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ csv, sourceName: "factory-qa.csv", assets: 10_000, liabilities: 4_000 })
    });
    if (analysis.status !== 200 || analysis.body?.status !== "READY") throw new Error(`FACTORY_ANALYSIS_FAILED:${analysis.status}`);

    const dashboard = await request("/api/dashboard", { headers: { cookie } });
    if (dashboard.status !== 200 || dashboard.body?.analysisAvailable !== true || dashboard.body?.metrics?.profit !== 1000) {
      throw new Error(`FACTORY_DASHBOARD_FAILED:${JSON.stringify(dashboard.body)}`);
    }
    console.log(JSON.stringify({ type: "FINAL_PRODUCT_FACTORY", stage: "ACCEPT", ok: true, tenantId, profit: dashboard.body.metrics.profit }));

    await stopRuntime(runtime);
    runtime = await startRuntime();

    const session2 = await request("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "factory-qa", organization: "Hooshyar Factory" })
    });
    if (session2.status !== 201 || !session2.cookie || session2.body?.tenantId !== tenantId) {
      throw new Error(`FACTORY_TENANT_RECOVERY_FAILED:${JSON.stringify(session2.body)}`);
    }
    const dashboard2 = await request("/api/dashboard", { headers: { cookie: session2.cookie.split(";")[0] } });
    if (dashboard2.status !== 200 || dashboard2.body?.analysisAvailable !== true || dashboard2.body?.metrics?.profit !== 1000) {
      throw new Error(`FACTORY_RECOVERY_FAILED:${JSON.stringify(dashboard2.body)}`);
    }
    console.log(JSON.stringify({ type: "FINAL_PRODUCT_FACTORY", stage: "RECOVERY", ok: true, tenantId, profit: dashboard2.body.metrics.profit }));
  } finally {
    if (runtime) await stopRuntime(runtime);
    try { rmSync(databasePath, { force: true }); } catch {}
  }

  console.log(JSON.stringify({ type: "FINAL_PRODUCT_FACTORY", stage: "RELEASE_GATE", ok: true, details: "application acceptance passed; running full Jest" }));
  run(npm, ["test", "--", "--runInBand"]);
  console.log(JSON.stringify({ type: "FINAL_PRODUCT_FACTORY", stage: "COMPLETE", ok: true, details: "runtime acceptance + restart recovery + full Jest passed" }));
}

main().catch(error => {
  console.error(JSON.stringify({ type: "FINAL_PRODUCT_FACTORY", stage: "BLOCKED", ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
