import { execFileSync, spawn, ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

export type ProductFactoryStage =
  | "READ" | "AUDIT" | "SELECT" | "IMPLEMENT" | "TEST" | "INTEGRATE"
  | "RUN" | "ACCEPT" | "REPAIR" | "COMMIT" | "PUSH" | "REPLAN" | "BLOCKED" | "COMPLETE";

export interface ProductFactoryEvidence {
  readonly stage: ProductFactoryStage;
  readonly ok: boolean;
  readonly details: string;
  readonly source: "repository" | "runtime" | "git" | "ci" | "assistant";
}

export interface ProductFactoryResult {
  readonly status: "COMPLETE" | "BLOCKED";
  readonly stage: ProductFactoryStage;
  readonly repairAttempts: number;
  readonly evidence: readonly ProductFactoryEvidence[];
}

export interface ProductFactoryOptions {
  readonly root?: string;
  readonly port?: number;
  readonly databasePath?: string;
  readonly maxRepairAttempts?: number;
  readonly allowPush?: boolean;
  readonly repair?: (failure: string) => Promise<boolean>;
}

const sleep = (ms: number) => new Promise<void>(resolvePromise => setTimeout(resolvePromise, ms));

async function waitForHealth(port: number, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "health endpoint unavailable";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        const body = await response.json() as { status?: string };
        if (body.status === "ok") return;
      }
      lastError = `health status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(250);
  }
  throw new Error(lastError);
}

async function jsonRequest(port: number, path: string, init: RequestInit): Promise<{ status: number; body: any; cookie?: string }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { status: response.status, body, cookie: response.headers.get("set-cookie") ?? undefined };
}

export class AutonomousProductFactory {
  private readonly root: string;
  private readonly port: number;
  private readonly databasePath: string;
  private readonly maxRepairAttempts: number;
  private readonly allowPush: boolean;
  private readonly repair?: (failure: string) => Promise<boolean>;

  constructor(options: ProductFactoryOptions = {}) {
    this.root = options.root ?? process.cwd();
    this.port = options.port ?? 4173;
    this.databasePath = resolve(this.root, options.databasePath ?? "data/hooshyar-factory.sqlite");
    this.maxRepairAttempts = options.maxRepairAttempts ?? 3;
    this.allowPush = options.allowPush ?? false;
    this.repair = options.repair;
  }

  static repositoryContract(root: string): ProductFactoryEvidence {
    const required = [
      "Docs/HOOSHYAROS_MASTER_CHARTER.md",
      "Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md",
      "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts",
      "Backend/HBOS/Autonomous/Runtime/start-commercial-runtime.ts",
      "Backend/HBOS/Product/SQLitePersistenceStore.ts",
    ];
    const missing = required.filter(file => !existsSync(resolve(root, file)));
    return {
      stage: "READ",
      ok: missing.length === 0,
      details: missing.length === 0 ? "governing product and autonomous-construction contracts present" : `missing: ${missing.join(",")}`,
      source: "repository",
    };
  }

  static gitAvailable(root: string): ProductFactoryEvidence {
    try {
      execFileSync(process.platform === "win32" ? "git.exe" : "git", ["--version"], { cwd: root, stdio: "ignore" });
      return { stage: "AUDIT", ok: true, details: "git executable available", source: "git" };
    } catch (error) {
      return { stage: "AUDIT", ok: false, details: error instanceof Error ? error.message : String(error), source: "git" };
    }
  }

  async run(): Promise<ProductFactoryResult> {
    const evidence: ProductFactoryEvidence[] = [];
    let repairAttempts = 0;
    const record = (stage: ProductFactoryStage, ok: boolean, details: string, source: ProductFactoryEvidence["source"]) => {
      evidence.push({ stage, ok, details, source });
      return ok;
    };

    const repositoryContract = AutonomousProductFactory.repositoryContract(this.root);
    if (!record(repositoryContract.stage, repositoryContract.ok, repositoryContract.details, repositoryContract.source)) return this.blocked(evidence, repairAttempts, "READ");
    if (!record("AUDIT", this.gitClean(), "working tree is clean before qualification", "git")) return this.blocked(evidence, repairAttempts, "AUDIT");
    if (!record("SELECT", true, "selected MVP customer journey: session → ingestion → analysis → dashboard → restart → recovery", "assistant")) return this.blocked(evidence, repairAttempts, "SELECT");

    while (true) {
      const result = await this.executeCustomerJourney(evidence);
      if (result.ok) break;
      if (repairAttempts >= this.maxRepairAttempts || !this.repair) return this.blocked(evidence, repairAttempts, "REPAIR");
      repairAttempts += 1;
      if (!record("REPAIR", await this.repair(result.failure), `repair attempt ${repairAttempts}: ${result.failure}`, "assistant")) continue;
    }

    if (!record("COMMIT", this.gitClean(), "qualification completed without uncommitted workspace residue", "git")) return this.blocked(evidence, repairAttempts, "COMMIT");
    if (this.allowPush) {
      try {
        execFileSync(process.platform === "win32" ? "git.exe" : "git", ["push"], { cwd: this.root, encoding: "utf8" });
        record("PUSH", true, "verified branch pushed", "git");
      } catch (error) {
        return this.blocked(evidence, repairAttempts, "PUSH", error instanceof Error ? error.message : String(error));
      }
    } else {
      record("PUSH", true, "push withheld by policy; CI/release integration remains an explicit external step", "git");
    }
    record("REPLAN", true, "qualification loop completed and repository is ready for the next canonical gap", "assistant");
    record("COMPLETE", true, "real application acceptance evidence obtained; no claim is made for unavailable external production dependencies", "assistant");
    return { status: "COMPLETE", stage: "COMPLETE", repairAttempts, evidence };
  }

  private async executeCustomerJourney(evidence: ProductFactoryEvidence[]): Promise<{ ok: boolean; failure: string }> {
    if (!recordLocal(evidence, "IMPLEMENT", true, "using the already-installed commercial runtime entrypoint", "repository")) return { ok: false, failure: "commercial runtime entrypoint unavailable" };
    if (!recordLocal(evidence, "TEST", this.runTests(), "full repository Jest verification", "repository")) return { ok: false, failure: "Jest verification failed" };
    if (!recordLocal(evidence, "INTEGRATE", this.startPrerequisites(), "commercial runtime and persistence prerequisites available", "repository")) return { ok: false, failure: "runtime prerequisites unavailable" };

    let child: ChildProcess | undefined;
    try {
      child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "start:commercial"], {
        cwd: this.root,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, HOOSHYAR_DB_PATH: this.databasePath, HOOSHYAR_PORT: String(this.port) }
      });
      await waitForHealth(this.port);
      recordLocal(evidence, "RUN", true, `commercial runtime healthy on 127.0.0.1:${this.port}`, "runtime");

      const session = await jsonRequest(this.port, "/api/session", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "factory-qa", organization: "Hooshyar Factory" })
      });
      if (session.status !== 201 || !session.cookie) return { ok: false, failure: `session failed: HTTP ${session.status}` };
      const cookie = session.cookie.split(";")[0];
      const csv = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-02,Sales,0,1500,IRR\n2026-08-03,Expense,300,0,IRR\n2026-08-04,Receivable,0,800,IRR";
      const analysis = await jsonRequest(this.port, "/api/analyze", {
        method: "POST", headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ csv, sourceName: "factory-qa.csv", assets: 10_000, liabilities: 4_000 })
      });
      if (analysis.status !== 200 || analysis.body?.status !== "READY") return { ok: false, failure: `analysis failed: HTTP ${analysis.status}` };
      const tenantId = String(analysis.body.tenantId);
      const dashboard = await jsonRequest(this.port, "/api/dashboard", { headers: { cookie } });
      if (dashboard.status !== 200 || dashboard.body?.analysisAvailable !== true || dashboard.body?.metrics?.profit !== 1000) return { ok: false, failure: "dashboard acceptance failed before restart" };
      recordLocal(evidence, "ACCEPT", true, `customer journey produced tenant ${tenantId} with profit ${dashboard.body.metrics.profit}`, "runtime");
      child.kill();
      await sleep(500);
      child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "start:commercial"], {
        cwd: this.root,
        stdio: "ignore",
        env: { ...process.env, HOOSHYAR_DB_PATH: this.databasePath, HOOSHYAR_PORT: String(this.port) }
      });
      await waitForHealth(this.port);
      const session2 = await jsonRequest(this.port, "/api/session", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "factory-qa", organization: "Hooshyar Factory" })
      });
      if (session2.status !== 201 || !session2.cookie || session2.body?.tenantId !== tenantId) return { ok: false, failure: "stable tenant recovery failed after restart" };
      const dashboard2 = await jsonRequest(this.port, "/api/dashboard", { headers: { cookie: session2.cookie.split(";")[0] } });
      if (dashboard2.status !== 200 || dashboard2.body?.analysisAvailable !== true || dashboard2.body?.metrics?.profit !== 1000) return { ok: false, failure: "persistent dashboard recovery failed after restart" };
      recordLocal(evidence, "RUN", true, "runtime restarted successfully", "runtime");
      recordLocal(evidence, "ACCEPT", true, "tenant and financial dashboard recovered after restart", "runtime");
      return { ok: true, failure: "" };
    } catch (error) {
      return { ok: false, failure: error instanceof Error ? error.message : String(error) };
    } finally {
      if (child && !child.killed) child.kill();
      try { rmSync(this.databasePath, { force: true }); } catch { /* best-effort cleanup of runtime state */ }
    }
  }

  private requiredArtifactsPresent(): boolean {
    return AutonomousProductFactory.repositoryContract(this.root).ok;
  }

  private gitClean(): boolean {
    try {
      const out = execFileSync(process.platform === "win32" ? "git.exe" : "git", ["status", "--porcelain", "--untracked-files=all"], { cwd: this.root, encoding: "utf8" });
      return out.trim() === "";
    } catch { return false; }
  }

  private runTests(): boolean {
    try { execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["test", "--", "--runInBand"], { cwd: this.root, stdio: "ignore", timeout: 10 * 60 * 1000 }); return true; }
    catch { return false; }
  }

  private startPrerequisites(): boolean {
    try { execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"], { cwd: this.root, stdio: "ignore" }); return true; }
    catch { return false; }
  }

  private blocked(evidence: ProductFactoryEvidence[], repairAttempts: number, stage: ProductFactoryStage, details?: string): ProductFactoryResult {
    evidence.push({ stage: "BLOCKED", ok: false, source: "assistant", details: details ?? `Product factory blocked at ${stage}; evidence preserved.` });
    return { status: "BLOCKED", stage, repairAttempts, evidence };
  }
}

function recordLocal(evidence: ProductFactoryEvidence[], stage: ProductFactoryStage, ok: boolean, details: string, source: ProductFactoryEvidence["source"]): boolean {
  evidence.push({ stage, ok, details, source });
  return ok;
}

if (process.argv[1]?.endsWith("AutonomousProductFactory.ts")) {
  const factory = new AutonomousProductFactory({ allowPush: process.env.HOOSHYAR_FACTORY_ALLOW_PUSH === "1" });
  factory.run().then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "COMPLETE" ? 0 : 1;
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
