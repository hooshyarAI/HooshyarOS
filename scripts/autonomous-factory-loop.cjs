#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const root = process.cwd();
const dir = path.join(root, '.hooshyar');
const statePath = path.join(dir, 'autonomous-factory-loop.json');
const failurePath = path.join(dir, 'factory-failure.json');
const evidencePath = path.join(dir, 'cline-runtime-evidence.json');
const auditPath = path.join(dir, 'cline-platform-audit.json');
const maxAttempts = Number(process.env.HOOSHYAR_AUTONOMOUS_MAX_ATTEMPTS || 12);
const branchResult = cp.spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' });
const branch = (branchResult.stdout || '').trim();

if (!branch || branch === 'main' || branch === 'master') {
  console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', reason: 'UNSAFE_BRANCH', branch }));
  process.exit(2);
}

function executable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(command, args = [], options = {}) {
  console.log(`\n>>> ${command} ${args.join(' ')}`);
  return cp.spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    stdio: options.stdio || 'inherit',
    shell: false,
    windowsHide: true
  });
}

function capture(command, args = []) {
  const result = run(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  return { code: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function git(args) {
  return capture('git', args);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function repositoryChanged() {
  return git(['status', '--porcelain']).stdout.trim().length > 0;
}

function commitAndPush() {
  const status = git(['status', '--porcelain']);
  if (status.code !== 0) throw new Error('git status failed');
  if (!status.stdout.trim()) return { changed: false, pushed: false };
  const add = run('git', ['add', '--all']);
  if ((add.status ?? 1) !== 0) throw new Error('git add failed');
  const message = process.env.HOOSHYAR_AUTONOMOUS_COMMIT_MESSAGE || 'fix(autonomous): repair commercial product factory failure';
  const commit = run('git', ['commit', '-m', message]);
  if ((commit.status ?? 1) !== 0) throw new Error('git commit failed');
  if (process.env.HOOSHYAR_AUTONOMOUS_ALLOW_PUSH !== '1') {
    console.log(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_COMMITTED', pushed: false, reason: 'PUSH_DISABLED_BY_POLICY', branch }));
    return { changed: true, pushed: false };
  }
  const push = run('git', ['push', 'origin', branch]);
  if ((push.status ?? 1) !== 0) throw new Error('git push failed');
  console.log(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_COMMITTED', pushed: true, branch }));
  return { changed: true, pushed: true };
}

function invokeKilo(prompt) {
  if (process.platform !== 'win32') return run('kilo', ['run', '--auto', prompt]).status ?? 1;
  const comspec = process.env.ComSpec || 'cmd.exe';
  const quotedPrompt = `\"${prompt.replace(/\"/g, '\"\"')}\"`;
  return run(comspec, ['/d', '/s', '/c', `kilo.cmd run --auto ${quotedPrompt}`]).status ?? 1;
}

function repairPrompt(payload) {
  return [
    'You are the HooshyarOS autonomous repair operator.',
    'Obey AGENTS.md, .clinerules, Architecture Freeze V4, governance, the commercial completion contract, and the qualification matrix.',
    'Repair ONLY the FIRST concrete failure, audit finding, or unresolved qualification cell in the supplied evidence.',
    'Do not weaken tests, bypass gates, invent completion, or change frozen architecture semantics.',
    'Reuse existing implementations. Make the smallest coherent change.',
    'Add or update ONE focused regression test for the repaired defect and run ONLY that focused verification or the smallest directly relevant acceptance command.',
    'DO NOT run the full Jest suite. DO NOT run `npm test`. DO NOT run `product:factory`, `product:cline:audit`, release pipelines, or other repository-wide verification. The outer factory owns full verification, evidence, commit, push, and re-planning.',
    'DO NOT spend the session investigating unrelated failures. Once the first repair is implemented and its focused verification passes, STOP and return control to the outer factory.',
    'Do not stop at a plan: implement the repair.',
    'Do not create unrelated changes or force-push.',
    'Do not create or modify generated evidence artifacts merely to claim success.',
    'When repair is verified, leave the repository clean of temporary files; the outer loop handles full Jest, evidence, commit, push, and continuation.',
    '',
    'FAILURE / QUALIFICATION / AUDIT HANDOFF:',
    payload
  ].join('\n');
}

function buildFailurePayload(before, currentEvidence, factoryResult, auditResult, failureOverride = null) {
  return {
    failure: failureOverride || (readJson(failurePath)?.failure || {}),
    platformAudit: readJson(auditPath) || {
      exitCode: auditResult?.code ?? null,
      stdout: auditResult?.stdout || '',
      stderr: auditResult?.stderr || ''
    },
    qualification: currentEvidence || null,
    factory: {
      exitCode: factoryResult?.status ?? null,
      stdout: factoryResult?.stdout || '',
      stderr: factoryResult?.stderr || ''
    },
    branch,
    commit: before
  };
}

function runFullJest() {
  const jestCli = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');
  return run(process.execPath, [jestCli, '--runInBand']);
}

function runPlatformAudit() {
  // Invoke the canonical audit entrypoint directly. This avoids npm.cmd wrapper
  // behavior and keeps audit ownership separate from the factory's verification.
  const auditScript = path.join(root, 'scripts', 'cline-full-platform-audit.cjs');
  return capture(process.execPath, [auditScript]);
}

fs.mkdirSync(dir, { recursive: true });
const state = readJson(statePath) || { attempts: [], lastFailureFingerprint: null };
console.log(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_LOOP_START', branch, maxAttempts }));

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const before = git(['rev-parse', 'HEAD']).stdout.trim();
  if (!before) throw new Error('Unable to determine HEAD');

  run('git', ['fetch', 'origin']);
  const upstream = capture('git', ['rev-parse', `origin/${branch}`]);
  if (upstream.code === 0 && upstream.stdout.trim() !== before && !repositoryChanged()) {
    const merge = run('git', ['merge', '--ff-only', `origin/${branch}`]);
    if ((merge.status ?? 1) !== 0) throw new Error('upstream fast-forward failed');
  }

  if (repositoryChanged()) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'DIRTY_WORKTREE_BEFORE_CYCLE' }));
    process.exit(2);
  }

  // Invalidate every prior transient evidence artifact that can contaminate this cycle.
  for (const file of [auditPath, failurePath, evidencePath]) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  const audit = runPlatformAudit();
  const auditEvidence = readJson(auditPath);
  if (auditEvidence && auditEvidence.git?.commit !== before) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'STALE_PLATFORM_AUDIT_EVIDENCE', expectedCommit: before, observedCommit: auditEvidence.git?.commit || null }));
    process.exit(1);
  }

  if (audit.code !== 0) {
    const failureOverride = {
      type: 'PLATFORM_AUDIT_EXECUTION_FAILURE',
      message: 'Canonical platform audit exited non-zero.',
      exitCode: audit.code,
      stdout: audit.stdout,
      stderr: audit.stderr
    };
    const payloadObject = buildFailurePayload(before, null, null, audit, failureOverride);
    const payload = JSON.stringify(payloadObject, null, 2);
    const fingerprint = sha256(payload);
    if (state.lastFailureFingerprint === fingerprint) {
      console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'REPEATED_IDENTICAL_AUDIT_FAILURE', fingerprint }));
      state.attempts.push({ attempt, before, reason: 'REPEATED_IDENTICAL_AUDIT_FAILURE', fingerprint, at: new Date().toISOString() });
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      process.exit(1);
    }
    state.lastFailureFingerprint = fingerprint;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.error(JSON.stringify({ type: 'AUTONOMOUS_AUDIT_REPAIR', attempt, reason: 'PLATFORM_AUDIT_EXECUTION_FAILED', fingerprint }));

    const kiloExit = invokeKilo(repairPrompt(payload));
    if (kiloExit !== 0) {
      console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'KILO_REPAIR_FAILED_AFTER_AUDIT', kiloExit, fingerprint }));
      process.exit(1);
    }

    const tests = runFullJest();
    if ((tests.status ?? 1) !== 0) {
      state.attempts.push({ attempt, before, repair: 'KILO', fullJest: 'FAIL', audit: 'FAIL', at: new Date().toISOString() });
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'FULL_JEST_FAILED_AFTER_AUDIT_REPAIR' }));
      process.exit(1);
    }

    if (repositoryChanged()) commitAndPush();
    else if (git(['rev-parse', 'HEAD']).stdout.trim() === before) {
      console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'KILO_PRODUCED_NO_REPOSITORY_CHANGE_AFTER_AUDIT', fingerprint }));
      process.exit(1);
    }

    const after = git(['rev-parse', 'HEAD']).stdout.trim();
    state.attempts.push({ attempt, before, after, audit: 'FAIL', repair: 'KILO', fullJest: 'PASS', at: new Date().toISOString() });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_PROGRESS', attempt, status: 'AUDIT_REPAIRED', before, after }));
    continue;
  }

  const factory = run(executable('npm'), ['run', 'product:factory']);
  const evidence = run(executable('npm'), ['run', 'product:cline:evidence']);
  const currentEvidence = readJson(evidencePath);

  if ((factory.status ?? 1) === 0 && evidence.status === 0 && currentEvidence?.verdict === 'QUALIFICATION_COMPLETE') {
    const after = git(['rev-parse', 'HEAD']).stdout.trim();
    state.attempts.push({ attempt, before, after, factory: 'PASS', qualification: 'COMPLETE', at: new Date().toISOString() });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_COMPLETE', attempt, commit: after, evidenceExitCode: evidence.status ?? 1 }));
    process.exit(0);
  }

  const handoff = capture(executable('npm'), ['run', 'product:factory:handoff']);
  const payloadObject = buildFailurePayload(before, currentEvidence, factory, null);
  payloadObject.handoff = handoff.stdout || handoff.stderr;
  const payload = JSON.stringify(payloadObject, null, 2);
  const fingerprint = sha256(payload);

  if (state.lastFailureFingerprint === fingerprint) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'REPEATED_IDENTICAL_FAILURE', fingerprint }));
    state.attempts.push({ attempt, before, reason: 'REPEATED_IDENTICAL_FAILURE', fingerprint, at: new Date().toISOString() });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    process.exit(1);
  }

  state.lastFailureFingerprint = fingerprint;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  const kiloExit = invokeKilo(repairPrompt(payload));
  if (kiloExit !== 0) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'KILO_REPAIR_FAILED', kiloExit, fingerprint }));
    process.exit(1);
  }

  const tests = runFullJest();
  if ((tests.status ?? 1) !== 0) {
    state.attempts.push({ attempt, before, factory: 'FAIL', repair: 'KILO', fullJest: 'FAIL', at: new Date().toISOString() });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'FULL_JEST_FAILED_AFTER_REPAIR' }));
    process.exit(1);
  }

  if (repositoryChanged()) commitAndPush();
  else if (git(['rev-parse', 'HEAD']).stdout.trim() === before) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'KILO_PRODUCED_NO_REPOSITORY_CHANGE', fingerprint }));
    process.exit(1);
  }

  const after = git(['rev-parse', 'HEAD']).stdout.trim();
  state.attempts.push({ attempt, before, after, factory: 'REPAIR', repair: 'KILO', fullJest: 'PASS', at: new Date().toISOString() });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_PROGRESS', attempt, status: 'REPAIRED', before, after }));
}

console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', reason: 'MAX_ATTEMPTS_EXCEEDED', maxAttempts }));
process.exit(1);
