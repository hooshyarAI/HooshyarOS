#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");

const root = process.cwd();
const dir = path.join(root, ".hooshyar");
const statePath = path.join(dir, "autonomous-ci-repair-state.json");
const handoffPath = path.join(dir, "autonomous-repair-handoff.json");
const repo = process.env.HOOSHYAR_GITHUB_REPOSITORY || "hooshyarAI/HooshyarOS";
const workflow = process.env.HOOSHYAR_GITHUB_WORKFLOW || "Final Product Factory";
const branchResult = cp.spawnSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" });
const branch = (branchResult.stdout || "").trim();
const maxAttempts = Number(process.env.HOOSHYAR_CI_REPAIR_MAX_ATTEMPTS || 12);
const pollSeconds = Number(process.env.HOOSHYAR_CI_REPAIR_POLL_SECONDS || 15);

if (!branch || branch === "main" || branch === "master") {
    console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_BLOCKED", reason: "UNSAFE_BRANCH", branch }));
    process.exit(2);
}

function stateRead() {
    try { return JSON.parse(fs.readFileSync(statePath, "utf8")); }
    catch { return { processedRuns: [], lastFailureFingerprint: null }; }
}

function stateWrite(state) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function run(command, args, options = {}) {
    return cp.spawnSync(command, args, {
        cwd: root,
        env: process.env,
        encoding: "utf8",
        stdio: options.stdio || "inherit",
        shell: false,
        windowsHide: true
    });
}

function githubHeaders() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    return {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

async function githubJson(url) {
    const response = await fetch(url, { headers: githubHeaders() });
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${url}`);
    return response.json();
}

async function githubText(url) {
    const response = await fetch(url, { headers: githubHeaders(), redirect: "follow" });
    if (!response.ok) throw new Error(`GitHub log ${response.status}: ${url}`);
    return response.text();
}

async function latestFailedRun(currentCommit) {
    const url = `https://api.github.com/repos/${repo}/actions/workflows/final-product-factory.yml/runs?branch=${encodeURIComponent(branch)}&per_page=10`;
    const data = await githubJson(url);
    const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
    return runs
        .filter(run => run.status === "completed" && run.conclusion === "failure" && run.head_sha === currentCommit)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0] || null;
}

async function failureMission(run, currentCommit) {
    const jobs = await githubJson(`https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`);
    const failedJobs = (jobs.jobs || []).filter(job => job.conclusion === "failure");
    const failures = [];
    for (const job of failedJobs) {
        const failedSteps = (job.steps || [])
            .filter(step => step.conclusion === "failure")
            .map(step => ({ name: step.name, number: step.number }));
        let log = "";
        try {
            log = await githubText(`https://api.github.com/repos/${repo}/actions/jobs/${job.id}/logs`);
            if (log.length > 30000) log = log.slice(-30000);
        } catch (error) {
            log = `Unable to retrieve job log: ${String(error)}`;
        }
        failures.push({
            jobId: job.id,
            job: job.name,
            url: job.html_url,
            failedSteps,
            log
        });
    }
    const payload = {
        type: "ASSISTANT_REPAIR_MISSION",
        version: 1,
        source: "github-actions",
        status: "BLOCKED",
        repository: repo,
        branch,
        commit: currentCommit,
        workflow: { name: workflow, runId: run.id, url: run.html_url, conclusion: run.conclusion },
        failure: {
            source: "github-actions",
            runId: run.id,
            firstFailedJob: failures[0]?.job || null,
            failedJobs: failures.map(item => item.job),
            failedSteps: failures.flatMap(item => item.failedSteps.map(step => `${item.job}:${step.name}`)),
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
            "Read the exact CI failure evidence above and identify the first failing job/step.",
            "Inspect the repository-owned code/workflow responsible for that failure.",
            "Apply the smallest coherent repair.",
            "Add or update one focused regression test when the defect is code-level.",
            "Run focused verification and Python syntax verification.",
            "Run npm run product:factory and npm test -- --runInBand.",
            "Commit and push the repair to the current autonomous branch.",
            "Poll CI again and replan from the new evidence."
        ],
        evidence: { runId: run.id, headSha: currentCommit, jobs: failures }
    };
    return payload;
}

function writeMission(mission) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(handoffPath, `${JSON.stringify(mission, null, 2)}\n`, "utf8");
    return handoffPath;
}

function invokeKilo(handoffFile) {
    const prompt = [
        "You are the HooshyarOS autonomous CI repair operator.",
        `Read the exact mission file: ${handoffFile}`,
        "Repair only the first failing target from that mission.",
        "Do not weaken tests or architecture and do not modify generated evidence to fake success.",
        "Inspect the concrete repository/workflow path, make the smallest coherent repair, add one focused regression test when appropriate, run focused verification, then stop.",
        "The outer loop owns full Jest, factory validation, commit, push and CI replan."
    ].join(" ");
    if (process.platform === "win32") {
        const comspec = process.env.ComSpec || "cmd.exe";
        const quoted = `"${prompt.replace(/"/g, '""')}"`;
        const file = `"${handoffFile.replace(/"/g, '""')}"`;
        return run(comspec, ["/d", "/s", "/c", `kilo.cmd run --auto --agent hooshyar-repair -f ${file} ${quoted}`]).status ?? 1;
    }
    return run("kilo", ["run", "--auto", "--agent", "hooshyar-repair", "-f", handoffFile, prompt]).status ?? 1;
}

function runPythonSyntax() {
    const python = process.env.HOOSHYAR_PYTHON || "python";
    return run(python, ["-m", "compileall", "-q", "Backend/AI_Runtime"]);
}

function runJest() {
    const jest = path.join(root, "node_modules", "jest", "bin", "jest.js");
    return run(process.execPath, [jest, "--runInBand"]);
}

function gitStatusClean() {
    const result = run("git", ["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ":(exclude)node_modules"], { stdio: ["ignore", "pipe", "pipe"] });
    return { clean: (result.stdout || "").trim() === "", output: result.stdout || "" };
}

function commitAndPush() {
    const status = gitStatusClean();
    if (status.clean) return false;
    if ((run("git", ["add", "--all"]).status ?? 1) !== 0) throw new Error("git add failed");
    if ((run("git", ["commit", "-m", "fix(autonomous): repair CI failure from feedback"]).status ?? 1) !== 0) throw new Error("git commit failed");
    if (process.env.HOOSHYAR_AUTONOMOUS_ALLOW_PUSH !== "1") throw new Error("AUTONOMOUS_PUSH_DISABLED");
    if ((run("git", ["push", "origin", branch]).status ?? 1) !== 0) throw new Error("git push failed");
    return true;
}

async function main() {
    const state = stateRead();
    fs.mkdirSync(dir, { recursive: true });
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const head = (run("git", ["rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "pipe"] }).stdout || "").trim();
        if (!head) throw new Error("Unable to determine HEAD");
        const runInfo = await latestFailedRun(head);
        if (!runInfo) {
            console.log(JSON.stringify({ type: "AUTONOMOUS_CI_FEEDBACK_WAIT", attempt, branch, commit: head }));
            await new Promise(resolve => setTimeout(resolve, pollSeconds * 1000));
            continue;
        }
        if (state.processedRuns.includes(runInfo.id)) {
            console.log(JSON.stringify({ type: "AUTONOMOUS_CI_FEEDBACK_ALREADY_PROCESSED", runId: runInfo.id, commit: head }));
            await new Promise(resolve => setTimeout(resolve, pollSeconds * 1000));
            continue;
        }
        const mission = await failureMission(runInfo, head);
        const fingerprint = crypto.createHash("sha256").update(JSON.stringify(mission.failure)).digest("hex");
        state.processedRuns = [...state.processedRuns, runInfo.id].slice(-20);
        state.lastFailureFingerprint = fingerprint;
        stateWrite(state);
        const file = writeMission(mission);
        console.log(JSON.stringify({ type: "ASSISTANT_REPAIR_MISSION_CREATED", runId: runInfo.id, commit: head, fingerprint, handoff: file }));

        const kiloExit = invokeKilo(file);
        if (kiloExit !== 0) {
            console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_BLOCKED", reason: "KILO_REPAIR_FAILED", runId: runInfo.id, kiloExit }));
            process.exit(1);
        }
        const python = runPythonSyntax();
        if ((python.status ?? 1) !== 0) {
            console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_BLOCKED", reason: "PYTHON_SYNTAX_VERIFY_FAILED", runId: runInfo.id }));
            process.exit(1);
        }
        const jest = runJest();
        if ((jest.status ?? 1) !== 0) {
            console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_BLOCKED", reason: "FULL_JEST_FAILED_AFTER_REPAIR", runId: runInfo.id }));
            process.exit(1);
        }
        const pushed = commitAndPush();
        const after = (run("git", ["rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "pipe"] }).stdout || "").trim();
        console.log(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_REPLAN", runId: runInfo.id, before: head, after, pushed }));
        if (!pushed) {
            console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_BLOCKED", reason: "NO_PUSH_AFTER_REPAIR", runId: runInfo.id }));
            process.exit(1);
        }
    }
    console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_BLOCKED", reason: "MAX_ATTEMPTS_EXCEEDED", maxAttempts }));
    process.exit(1);
}

if (require.main === module) {
    main().catch(error => {
        console.error(JSON.stringify({ type: "AUTONOMOUS_CI_REPAIR_FAILED", error: String(error) }));
        process.exit(1);
    });
}

module.exports = { failureMission };
