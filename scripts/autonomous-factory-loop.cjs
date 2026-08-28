#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const root = process.cwd();
const dir = path.join(root, '.hooshyar');
const statePath = path.join(dir, 'autonomous-factory-loop.json');
const failurePath = path.join(dir, 'factory-failure.json');
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
  if (!status.stdout.trim()) return { changed: false };

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
  if (process.platform !== 'win32') {
    return run('kilo', ['run', '--auto', prompt]).status ?? 1;
  }
  const comspec = process.env.ComSpec || 'cmd.exe';
  const quotedPrompt = `"${prompt.replace(/"/g, '""')}"`;
  const commandLine = `kilo.cmd run --auto ${quotedPrompt}`;
  return run(comspec, ['/d', '/s', '/c', commandLine]).status ?? 1;
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
    if ((merge.status ?? 1) !== 0) {
      console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'UPSTREAM_FAST_FORWARD_FAILED' }));
      process.exit(1);
    }
  }

  if (repositoryChanged()) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'DIRTY_WORKTREE_BEFORE_CYCLE' }));
    process.exit(2);
  }

  const audit = run(executable('npm'), ['run', 'product:cline:audit']);
  if ((audit.status ?? 1) !== 0) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'PLATFORM_AUDIT_FAILED' }));
    process.exit(1);
  }

  const factory = run(executable('npm'), ['run', 'product:factory']);
  if ((factory.status ?? 1) === 0) {
    const evidence = run(executable('npm'), ['run', 'product:cline:evidence']);
    const after = git(['rev-parse', 'HEAD']).stdout.trim();
    state.attempts.push({ attempt, before, after, factory: 'PASS', evidenceExitCode: evidence.status ?? 1, at: new Date().toISOString() });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_PROGRESS', attempt, status: 'PASS', commit: after, evidenceExitCode: evidence.status ?? 1 }));
    process.exit(evidence.status ?? 1);
  }

  const handoff = capture(executable('npm'), ['run', 'product:factory:handoff']);
  const failure = readJson(failurePath) || {};
  const payload = JSON.stringify({
    failure: failure.failure || failure,
    handoff: handoff.stdout || handoff.stderr,
    branch,
    commit: before
  }, null, 2);
  const fingerprint = sha256(payload);

  if (state.lastFailureFingerprint === fingerprint) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'REPEATED_IDENTICAL_FAILURE', fingerprint }));
    state.attempts.push({ attempt, before, factory: 'FAIL', reason: 'REPEATED_IDENTICAL_FAILURE', fingerprint, at: new Date().toISOString() });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    process.exit(1);
  }
  state.lastFailureFingerprint = fingerprint;

  const prompt = [
    'You are the HooshyarOS autonomous repair operator.',
    'Operate only on the current repository and obey AGENTS.md, .clinerules, Architecture Freeze V4, governance, the commercial completion contract, and the qualification matrix.',
    'Repair the FIRST concrete failure in the supplied factory evidence.',
    'Do not weaken tests, bypass gates, invent completion, or alter frozen architecture semantics.',
    'Inspect and reuse existing implementations before adding anything.',
    'Apply the smallest coherent repair and add/update a focused regression test.',
    'Run focused verification and the affected acceptance path. Do not stop at a plan; implement the repair.',
    'Do not create unrelated changes. Do not force-push. Leave a clean verified repository when possible; the outer loop handles the final Git push.',
    '',
    'FACTORY FAILURE / REPAIR HANDOFF:',
    payload
  ].join('\n');

  const kiloExit = invokeKilo(prompt);
  if (kiloExit !== 0) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'KILO_REPAIR_FAILED', kiloExit, fingerprint }));
    process.exit(1);
  }

  const tests = run(executable('npm'), ['test', '--', '--runInBand']);
  if ((tests.status ?? 1) !== 0) {
    state.attempts.push({ attempt, before, factory: 'FAIL', repair: 'KILO', fullJest: 'FAIL', at: new Date().toISOString() });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', attempt, reason: 'FULL_JEST_FAILED_AFTER_REPAIR' }));
    process.exit(1);
  }

  if (repositoryChanged()) commitAndPush();
  const after = git(['rev-parse', 'HEAD']).stdout.trim();
  state.attempts.push({ attempt, before, after, factory: 'FAIL', repair: 'KILO', fullJest: 'PASS', at: new Date().toISOString() });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_PROGRESS', attempt, status: 'REPAIRED', before, after }));
}

console.error(JSON.stringify({ type: 'AUTONOMOUS_FACTORY_BLOCKED', reason: 'MAX_ATTEMPTS_EXCEEDED', maxAttempts }));
process.exit(1);
