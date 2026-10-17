#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { buildRepairEvidence, validateRepairEvidence } = require("./agent-repair-evidence-contract.cjs");

const root = process.cwd();
const repo = process.env.GITHUB_REPOSITORY || "hooshyarAI/HooshyarOS";
const branch = process.env.GITHUB_HEAD_REF || cp.execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
const runId = process.env.HOOSHYAR_TARGET_RUN_ID || process.env.GITHUB_RUN_ID;
const initialSha = process.env.HOOSHYAR_TARGET_HEAD_SHA || process.env.GITHUB_SHA;
const maxAttempts = Number(process.env.HOOSHYAR_CI_REPAIR_MAX_ATTEMPTS || 3);
const pollSeconds = Number(process.env.HOOSHYAR_CI_REPAIR_POLL_SECONDS || 10);
const maxLog = 30000;

function assertRepairContext() {
  if (!runId || !initialSha || !branch || ["main", "master"].includes(branch)) {
    console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_BLOCKED", reason: "INVALID_REPAIR_CONTEXT", runId, initialSha, branch }));
    process.exit(2);
  }
}

function headers() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return { Accept: "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: "Bearer " + token } : {}) };
}

async function request(url, init = {}) {
  return fetch(url, { ...init, headers: { ...headers(), ...(init.headers || {}) } });
}

async function getJson(url) {
  const r = await request(url);
  if (!r.ok) throw new Error("GitHub API " + r.status + ": " + url);
  return r.json();
}

async function getText(url) {
  const r = await request(url, { redirect: "follow" });
  if (!r.ok) throw new Error("GitHub log " + r.status + ": " + url);
  const text = await r.text();
  return text.length > maxLog ? text.slice(-maxLog) : text;
}

/**
 * Node refuses to spawn a `.cmd`/`.bat` file with `shell: false` on Windows (it
 * reports EINVAL before the child starts), so such launchers are routed through
 * the platform command processor — the convention used by the other construction
 * and acceptance launchers in this repository.
 *
 * `platform` is injectable so both branches of this host-dependent contract can
 * be verified deterministically on any machine (the POSIX pass-through branch
 * previously had no correct coverage).
 */
function normalizeCommand(command, args, platform = process.platform) {
  if (platform === "win32" && /\.(cmd|bat)$/i.test(String(command))) {
    return { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", [command, ...args].join(" ")] };
  }
  return { command, args };
}

const GITHUB_CREDENTIAL_ENV_KEYS = [
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
  "GH_ENTERPRISE_TOKEN",
  "ACTIONS_RUNTIME_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "ACTIONS_CACHE_URL",
  "ACTIONS_RESULTS_URL",
  "GIT_ASKPASS",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_KEY_0",
  "GIT_CONFIG_VALUE_0"
];

function buildUnprivilegedEnv(sourceEnv = process.env) {
  const env = { ...sourceEnv };
  for (const key of GITHUB_CREDENTIAL_ENV_KEYS) delete env[key];
  return env;
}

function buildGitPushEnv(sourceEnv = process.env) {
  const token = sourceEnv.GITHUB_TOKEN || sourceEnv.GH_TOKEN;
  if (!token) throw new Error("GITHUB_PUSH_TOKEN_MISSING");
  const env = buildUnprivilegedEnv(sourceEnv);
  env.GIT_CONFIG_COUNT = "1";
  env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
  env.GIT_CONFIG_VALUE_0 = "AUTHORIZATION: basic " +
    Buffer.from("x-access-token:" + token).toString("base64");
  return env;
}

function exec(command, args, options = {}) {
  const normalized = normalizeCommand(command, args);
  return cp.spawnSync(normalized.command, normalized.args, {
    cwd: root,
    env: options.env || buildUnprivilegedEnv(process.env),
    encoding: "utf8",
    stdio: options.stdio || "inherit",
    shell: false,
    windowsHide: true
  });
}

async function dispatchFactory(ref) {
  const url = "https://api.github.com/repos/" + repo + "/actions/workflows/final-product-factory.yml/dispatches";
  const response = await request(url, {
    method: "POST",
    body: JSON.stringify({ ref })
  });
  if (!response.ok && response.status !== 204) {
    throw new Error("GitHub workflow dispatch " + response.status + ": " + await response.text());
  }
}

async function waitForFactory(refSha) {
  for (let i = 1; i <= 120; i += 1) {
    const url = "https://api.github.com/repos/" + repo + "/actions/workflows/final-product-factory.yml/runs?branch=" + encodeURIComponent(branch) + "&per_page=30";
    const data = await getJson(url);
    const run = (data.workflow_runs || [])
      .filter(item => item.head_sha === refSha)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    if (run) {
      console.log(JSON.stringify({
        type: "AUTONOMOUS_CI_REPAIR_FACTORY_OBSERVATION",
        runId: run.id,
        sha: refSha,
        status: run.status,
        conclusion: run.conclusion || null
      }));
      if (run.status === "completed") return run;
    }
    await new Promise(resolve => setTimeout(resolve, pollSeconds * 1000));
  }
  throw new Error("FINAL_PRODUCT_FACTORY_TIMEOUT_FOR_SHA:" + refSha);
}

async function missionForRun(targetRun) {
  const jobsUrl = "https://api.github.com/repos/" + repo + "/actions/runs/" + targetRun.id + "/jobs?per_page=100";
  const jobs = await getJson(jobsUrl);
  const failures = [];
  for (const job of (jobs.jobs || []).filter(item => item.conclusion === "failure")) {
    let log = "";
    try {
      log = await getText("https://api.github.com/repos/" + repo + "/actions/jobs/" + job.id + "/logs");
    } catch (error) {
      log = "Unable to retrieve job log: " + String(error);
    }
    failures.push({
      jobId: job.id,
      job: job.name,
      url: job.html_url,
      failedSteps: (job.steps || [])
        .filter(step => step.conclusion === "failure")
        .map(step => ({ name: step.name, number: step.number })),
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
    commit: targetRun.head_sha,
    workflow: {
      name: "Final Product Factory",
      runId: Number(targetRun.id),
      url: targetRun.html_url,
      conclusion: targetRun.conclusion
    },
    failure: {
      source: "github-actions",
      runId: Number(targetRun.id),
      firstFailedJob: failures[0]?.job || null,
      failedJobs: failures.map(x => x.job),
      failedSteps: failures.flatMap(x => x.failedSteps.map(s => x.job + ":" + s.name)),
      details: failures
    },
    rules: {
      preserveArchitecture: true,
      preserveTests: true,
      noTestWeakening: true,
      smallestCoherentRepair: true,
      requiredRegressionTest: true,
      rerunFactoryAfterRepair: true,
      rerunFullJestAfterAcceptance: true,
      pushOnlyToCurrentBranch: true
    },
    nextActions: [
      "Read the exact CI failure evidence and identify the first failed target.",
      "Inspect the concrete repository-owned code or workflow responsible for that failure.",
      "Apply the smallest coherent repair and add one focused regression test when appropriate.",
      "Run focused verification and Python syntax verification.",
      "Run the relevant product factory and full Jest verification.",
      "Commit and push only to the current autonomous branch.",
      "Dispatch Final Product Factory for the repaired SHA and replan from its result."
    ],
    evidence: { runId: Number(targetRun.id), headSha: targetRun.head_sha, jobs: failures }
  };
}

function writeMission(mission) {
  const dir = path.join(root, ".hooshyar");
  fs.mkdirSync(dir, { recursive: true });
  const handoff = path.join(dir, "autonomous-repair-handoff.json");
  fs.writeFileSync(handoff, JSON.stringify(mission, null, 2) + "\n", "utf8");
  return handoff;
}

/**
 * `kilo run` declares the message positional and `-f/--file` as array options.
 * yargs drains every following value into an array option until it meets another
 * flag, so `-f <handoff> <prompt>` consumed the prompt as a second "file to
 * attach": the CLI aborted with `File not found: You are HooshyarOS autonomous
 * CI repair operator...` and the repair never ran. The message must therefore be
 * emitted before `-f`, leaving the attach list with exactly one value.
 */
function buildKiloInvocation(handoffPath, prompt) {
  return {
    command: "kilo",
    args: ["run", "--auto", "--agent", "hooshyar-repair", prompt, "--file", handoffPath]
  };
}

function runKilo(handoffPath) {
  const prompt = [
    "You are HooshyarOS autonomous CI repair operator.",
    "Read " + handoffPath + ".",
    "Repair only the FIRST failing target described there.",
    "Do not weaken tests, architecture, governance, or evidence.",
    "Inspect the exact failure, make the smallest coherent repair, add one focused regression test where appropriate, and run focused verification.",
    "Do not perform unrelated cleanup. Do not rewrite passing product behavior. Stop after focused verification."
  ].join(" ");
  const invocation = buildKiloInvocation(handoffPath, prompt);
  const result = exec(invocation.command, invocation.args);
  return { code: result.status ?? 1, output: (result.stdout || "") + "\n" + (result.stderr || "") };
}

function gitStatus() {
  return exec("git", [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ".",
    ":(exclude).kilo",
    ":(exclude).hooshyar",
    ":(exclude)node_modules"
  ], { stdio: ["ignore", "pipe", "pipe"] });
}

function assertCleanRepairBaseline(statusResult) {
  if (!statusResult || statusResult.status !== 0 || statusResult.error) {
    throw new Error("AUTONOMOUS_REPAIR_CLEAN_BASELINE_CHECK_FAILED");
  }
  if ((statusResult.stdout || "").trim()) {
    throw new Error("AUTONOMOUS_REPAIR_BLOCKED_PREEXISTING_WORKTREE_CHANGES");
  }
  return true;
}

function commitPush() {
  const status = gitStatus();
  if ((status.stdout || "").trim() === "") throw new Error("KILO_PRODUCED_NO_REPOSITORY_CHANGE");
  if ((exec("git", ["add", "--all", "--", ".", ":(exclude).kilo", ":(exclude).hooshyar", ":(exclude)node_modules"]).status ?? 1) !== 0) throw new Error("git add failed");
  if ((exec("git", ["commit", "-m", "fix(autonomous): repair CI failure from feedback"]).status ?? 1) !== 0) throw new Error("git commit failed");
  if ((exec("git", ["push", "origin", "HEAD:" + branch], { env: buildGitPushEnv() }).status ?? 1) !== 0) throw new Error("git push failed");
  return (exec("git", ["rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "pipe"] }).stdout || "").trim();
}

async function main() {
  assertRepairContext();
  let currentSha = initialSha;
  let targetRun = {
    id: Number(runId),
    head_sha: currentSha,
    html_url: "https://github.com/" + repo + "/actions/runs/" + runId,
    conclusion: "failure"
  };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const mission = await missionForRun(targetRun);
    if (!mission.failure.firstFailedJob) throw new Error("NO_FAILED_JOB_IN_TARGET_RUN");
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(mission.failure)).digest("hex");
    const handoff = writeMission(mission);
    console.log(JSON.stringify({
      type: "ASSISTANT_REPAIR_MISSION_CREATED",
      attempt,
      runId: targetRun.id,
      commit: currentSha,
      fingerprint,
      handoff
    }));

    // Do not let the agent commit changes already present in the checkout.
    // Ignore only generated local state; fail closed on every other dirty path.
    assertCleanRepairBaseline(gitStatus());
    const kilo = runKilo(handoff);
    if (kilo.code !== 0) throw new Error("KILO_REPAIR_FAILED:" + kilo.code + "\n" + kilo.output);

    const py = exec(process.env.HOOSHYAR_PYTHON || "python", ["-m", "compileall", "-q", "Backend/AI_Runtime"]);
    if ((py.status ?? 1) !== 0) throw new Error("PYTHON_SYNTAX_VERIFY_FAILED");

    const jest = exec(process.execPath, [path.join(root, "node_modules", "jest", "bin", "jest.js"), "--runInBand"]);
    if ((jest.status ?? 1) !== 0) throw new Error("FULL_JEST_FAILED_AFTER_REPAIR");

    currentSha = commitPush();
    console.log(JSON.stringify({
      type: "AUTONOMOUS_CI_REPAIR_REPLAN",
      runId: targetRun.id,
      before: mission.commit,
      after: currentSha,
      pushed: true
    }));

    await dispatchFactory(branch);
    targetRun = await waitForFactory(currentSha);
    const factoryJobs = await getJson("https://api.github.com/repos/" + repo + "/actions/runs/" + targetRun.id + "/jobs?per_page=100");
    const productFactoryJob = (factoryJobs.jobs || []).find(job => job.name === "windows-product-factory");
    targetRun.productFactoryConclusion = productFactoryJob?.conclusion || "missing";
    const evidenceOnlyJobs = new Set(["runtime-evidence-qualification", "release-gate"]);
    const requiredRepairJobs = [...new Set(mission.failure.failedJobs.filter(name => !evidenceOnlyJobs.has(name)))];
    targetRun.repairedJobs = requiredRepairJobs.map(name => {
      const rerunJob = (factoryJobs.jobs || []).find(job => job.name === name);
      return { name, conclusion: rerunJob?.conclusion || "missing", runId: Number(targetRun.id) };
    });
    if (targetRun.productFactoryConclusion === "success" && requiredRepairJobs.length > 0 && targetRun.repairedJobs.every(job => job.conclusion === "success")) {
      const changed = exec("git", ["diff", "--name-only", mission.commit, currentSha], { stdio: ["ignore", "pipe", "pipe"] });
      if ((changed.status ?? 1) !== 0) throw new Error("REPAIR_CHANGED_FILES_INSPECTION_FAILED");
      const changedPaths = (changed.stdout || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean);
      const evidenceRecord = buildRepairEvidence({ commit: currentSha, previousCommit: mission.commit, mission, missionId: fingerprint, changedFiles: changedPaths.length, regressionStatus: "PASS", pythonSyntaxStatus: "PASS", factoryRun: targetRun, repairedJobs: targetRun.repairedJobs });
      evidenceRecord.repair.changedPaths = changedPaths;
      const validation = validateRepairEvidence(evidenceRecord, currentSha);
      if (!validation.valid) throw new Error("AGENT_REPAIR_EVIDENCE_INVALID:" + validation.reason);
      const evidenceDir = path.join(root, ".hooshyar");
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(path.join(evidenceDir, "agent-repair-success.json"), JSON.stringify(evidenceRecord, null, 2) + "\n", "utf8");
      const evidenceCheck = exec(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "product:agent:evidence"]);
      if ((evidenceCheck.status ?? 1) !== 0) throw new Error("AGENT_REPAIR_EVIDENCE_INVALID_AFTER_FACTORY_ACCEPTANCE");
      console.log(JSON.stringify({
        type: "AUTONOMOUS_CI_REPAIR_COMPLETE",
        attempts: attempt,
        commit: currentSha,
        factoryRunId: targetRun.id
      }));
      return;
    }
  }
  throw new Error("AUTONOMOUS_CI_REPAIR_MAX_ATTEMPTS_EXCEEDED:" + maxAttempts);
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_FAILED", error: String(error) }));
    process.exit(1);
  });
}

module.exports = { normalizeCommand, exec, buildKiloInvocation, assertCleanRepairBaseline, buildUnprivilegedEnv, buildGitPushEnv };
