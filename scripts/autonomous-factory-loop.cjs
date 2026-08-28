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
const handoffPath = path.join(dir, 'autonomous-repair-handoff.json');
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

function invokeKilo(handoffFile) {
  const prompt = [
    'You are the HooshyarOS autonomous repair operator.',
    'Read the exact repair handoff file below and obey its scope.',
    `HANDOFF_FILE=${handoffFile}`,
    'Repair ONLY the FIRST concrete failure, audit finding, or unresolved qualification cell in that handoff.',
    'Do not perform repository-wide discovery. Do not run Get-ChildItem -Recurse, recursive globbing over the whole repository, git log, git status, git diff against main, or broad scans.',
    'Read only the exact files named by the handoff target and its directly referenced implementation.',
    'Do not run full Jest, npm test, product:factory, product:cline:audit, release pipelines, or other repository-wide verification.',
    'Make the smallest coherent change. Add/update ONE focused regression test and run only its focused verification or smallest directly relevant acceptance command.',
    'Do not modify generated evidence artifacts merely to claim success. Do not force-push or create unrelated changes.',
    'Once the first repair and focused verification pass, STOP immediately. The outer factory owns full verification, evidence, commit, push, and continuation.'
  ].join('\n');
  if (process.platform !== 'win32') return run('kilo', ['run', '--auto', prompt]).status ?? 1;
  const comspec = process.env.ComSpec || 'cmd.exe';
  const quotedPrompt = `\"${prompt.replace(/\"/g, '\"\"')}\"`;
  return run(comspec, ['/d', '/s', '/c', `kilo.cmd run --auto ${quotedPrompt}`]).status ?? 1;
}

function writeRepairHandoff(payloadObject) {
  fs.writeFileSync(handoffPath, JSON.stringify(payloadObject, null, 2), 'utf8');
  return handoffPath;
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

  for (const file of [auditPath, failurePath, evidencePath, handoffPath]) {
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
    const payloadForFingerprint = JSON.stringify(payloadObject);
    const fingerprint = sha256(payloadForFingerprint);
    if (state.lastFailureFingerprint === fingerprint) {
      console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'REPEATED_IDENTICAL_AUDIT_FAILURE', fingerprint }));
      state.attempts.push({ attempt, before, reason: 'REPEATED_IDENTICAL_AUDIT_FAILURE', fingerprint, at: new Date().toISOString() });
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
      process.exit(1);
    }
    state.lastFailureFingerprint = fingerprint;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    const handoff = writeRepairHandoff(payloadObject);
    console.error(JSON.stringify({ type: 'AUTONOMOUS_AUDIT_REPAIR', attempt, reason: 'PLATFORM_AUDIT_EXECUTION_FAILED', fingerprint, handoff }));

    const kiloExit = invokeKilo(handoff);
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

  const handoffResult = capture(executable('npm'), ['run', 'product:factory:handoff']);
  const payloadObject = buildFailurePayload(before, currentEvidence, factory, null);
  payloadObject.handoff = handoffResult.stdout || handoffResult.stderr;
  const payloadForFingerprint = JSON.stringify(payloadObject);
  const fingerprint = sha256(payloadForFingerprint);

  if (state.lastFailureFingerprint === fingerprint) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'REPEATED_IDENTICAL_FAILURE', fingerprint }));
    state.attempts.push({ attempt, before, reason: 'REPEATED_IDENTICAL_FAILURE', fingerprint, at: new Date().toISOString() });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    process.exit(1);
  }

  state.lastFailureFingerprint = fingerprint;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  const handoff = writeRepairHandoff(payloadObject);
  console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_REPAIR', attempt, fingerprint, handoff }));
  const kiloExit = invokeKilo(handoff);
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
