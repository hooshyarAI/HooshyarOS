#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");

const root = process.cwd();
const repo = process.env.GITHUB_REPOSITORY || "hooshyarAI/HooshyarOS";
const branch = process.env.GITHUB_HEAD_REF || cp.execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
const runId = process.env.HOOSHYAR_TARGET_RUN_ID || process.env.GITHUB_RUN_ID;
const headSha = process.env.GITHUB_SHA;
const maxLog = 30000;
if (!runId || !headSha || !branch || ["main", "master"].includes(branch)) {
  console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_BLOCKED", reason: "INVALID_REPAIR_CONTEXT", runId, headSha, branch }));
  process.exit(2);
}

function headers() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
async function getJson(url) {
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${url}`);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { headers: headers(), redirect: "follow" });
  if (!r.ok) throw new Error(`GitHub log ${r.status}: ${url}`);
  const text = await r.text();
  return text.length > maxLog ? text.slice(-maxLog) : text;
}
function exec(command, args, options = {}) {
  return cp.spawnSync(command, args, { cwd: root, env: process.env, encoding: "utf8", stdio: options.stdio || "inherit", shell: false, windowsHide: true });
}
async function missionForRun() {
  const jobs = await getJson(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`);
  const failures = [];
  for (const job of (jobs.jobs || []).filter(item => item.conclusion === "failure")) {
    let log = "";
    try { log = await getText(`https://api.github.com/repos/${repo}/actions/jobs/${job.id}/logs`); }
    catch (error) { log = `Unable to retrieve job log: ${String(error)}`; }
    failures.push({
      jobId: job.id,
      job: job.name,
      url: job.html_url,
      failedSteps: (job.steps || []).filter(step => step.conclusion === "failure").map(step => ({ name: step.name, number: step.number })),
      log
    });
  }
  return {
    type: "ASSISTANT_REPAIR_MISSION",
    version: 1,
    source: "github-actions",
    status: "BLOCKED",
    repository: repo,
    branch,
    commit: headSha,
    workflow: { name: "Final Product Factory", runId: Number(runId), url: `https://github.com/${repo}/actions/runs/${runId}` },
    failure: { source: "github-actions", runId: Number(runId), firstFailedJob: failures[0]?.job || null, failedJobs: failures.map(x => x.job), failedSteps: failures.flatMap(x => x.failedSteps.map(s => `${x.job}:${s.name}`)), details: failures },
    rules: { preserveArchitecture: true, preserveTests: true, noTestWeakening: true, smallestCoherentRepair: true, requiredRegressionTest: true, rerunFactoryAfterRepair: true, rerunFullJestAfterAcceptance: true, pushOnlyToCurrentBranch: true },
    nextActions: [
      "Read the exact CI failure evidence and identify the first failed target.",
      "Inspect the concrete repository-owned code or workflow responsible for that failure.",
      "Apply the smallest coherent repair and add one focused regression test when appropriate.",
      "Run focused verification and Python syntax verification.",
      "Run the relevant product factory and full Jest verification.",
      "Commit and push only to the current autonomous branch.",
      "Stop after push; the new branch SHA will trigger the next CI cycle."
    ],
    evidence: { runId: Number(runId), headSha, jobs: failures }
  };
}
function runKilo(handoffPath) {
  const prompt = [
    "You are HooshyarOS autonomous CI repair operator.",
    `Read ${handoffPath}.`,
    "Repair only the FIRST failing target described there.",
    "Do not weaken tests, architecture, governance, or evidence.",
    "Inspect the exact failure, make the smallest coherent repair, add one focused regression test where appropriate, and run focused verification.",
    "Do not perform unrelated cleanup. Do not rewrite passing product behavior. Stop after focused verification."
  ].join(" ");
  const result = exec("kilo", ["run", "--auto", prompt]);
  return { code: result.status ?? 1, output: `${result.stdout || ""}\n${result.stderr || ""}` };
}
function gitStatus() {
  return exec("git", ["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ":(exclude)node_modules"], { stdio: ["ignore", "pipe", "pipe"] });
}
function commitPush() {
  const status = gitStatus();
  if ((status.stdout || "").trim() === "") throw new Error("KILO_PRODUCED_NO_REPOSITORY_CHANGE");
  if ((exec("git", ["add", "--all"]).status ?? 1) !== 0) throw new Error("git add failed");
  if ((exec("git", ["commit", "-m", "fix(autonomous): repair CI failure from feedback"]).status ?? 1) !== 0) throw new Error("git commit failed");
  if ((exec("git", ["push", "origin", `HEAD:${branch}"]).status ?? 1) !== 0) throw new Error("git push failed");
}
async function main() {
  const mission = await missionForRun();
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(mission.failure)).digest("hex");
  const dir = path.join(root, ".hooshyar");
  fs.mkdirSync(dir, { recursive: true });
  const handoff = path.join(dir, "autonomous-repair-handoff.json");
  fs.writeFileSync(handoff, JSON.stringify(mission, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ type: "ASSISTANT_REPAIR_MISSION_CREATED", runId, commit: headSha, fingerprint, handoff }));
  if (!mission.failure.firstFailedJob) throw new Error("NO_FAILED_JOB_IN_TARGET_RUN");
  const kilo = runKilo(handoff);
  if (kilo.code !== 0) throw new Error(`KILO_REPAIR_FAILED:${kilo.code}\n${kilo.output}`);
  const py = exec(process.env.HOOSHYAR_PYTHON || "python", ["-m", "compileall", "-q", "Backend/AI_Runtime"]);
  if ((py.status ?? 1) !== 0) throw new Error("PYTHON_SYNTAX_VERIFY_FAILED");
  const jest = exec(process.execPath, [path.join(root, "node_modules", "jest", "bin", "jest.js"), "--runInBand"]);
  if ((jest.status ?? 1) !== 0) throw new Error("FULL_JEST_FAILED_AFTER_REPAIR");
  commitPush();
  console.log(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_REPLAN", runId, before: headSha, branch, pushed: true }));
}
main().catch(error => { console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_FAILED", error: String(error) })); process.exit(1); });
