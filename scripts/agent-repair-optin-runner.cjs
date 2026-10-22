#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const {
  DRILL_PATH,
  injectControlledDefect,
  buildControlledDrillEvidence,
  validateControlledDrillEvidence
} = require('./agent-repair-optin-policy.cjs');

const DEFAULT_FREE_MODEL = 'nvidia/nemotron-3.5-super-vl:free';

const CONTROLLED_FIXTURE_SOURCE = "#!/usr/bin/env node\n\nfunction calculateNet(revenue, expense) {\n  return revenue + expense;\n}\n\nconst result = calculateNet(1500, -300);\nconsole.log(JSON.stringify({ revenue: 1500, expense: -300, net: result }));\n\nif (result !== 1200) {\n  console.error('AGENT_REPAIR_DRILL_FAIL: expected net=1200');\n  process.exitCode = 1;\n}\n";

const UNTRUSTED_ENV_KEYS = [
  'GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GH_ENTERPRISE_TOKEN',
  'ACTIONS_RUNTIME_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_URL',
  'ACTIONS_CACHE_URL', 'ACTIONS_RESULTS_URL', 'GIT_ASKPASS', 'GIT_CONFIG_COUNT',
  'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0', 'KILO_CONFIG_CONTENT',
  'GITHUB_ENV', 'GITHUB_OUTPUT', 'GITHUB_PATH', 'GITHUB_STATE', 'GITHUB_STEP_SUMMARY',
  'GITHUB_EVENT_PATH', 'GITHUB_WORKSPACE', 'GITHUB_ACTION_PATH',
  'RUNNER_TEMP', 'RUNNER_TOOL_CACHE', 'RUNNER_WORKSPACE'
];

function buildUnprivilegedEnv(source = process.env) {
  const env = { ...source };
  for (const key of UNTRUSTED_ENV_KEYS) delete env[key];
  return env;
}

function prepareIsolatedKiloWorkspace({ trustedDir, missionText, scratchContent, tempRoot = os.tmpdir() }) {
  if (typeof trustedDir !== 'string' || !trustedDir ||
      typeof missionText !== 'string' || typeof scratchContent !== 'string' ||
      typeof tempRoot !== 'string' || !tempRoot) {
    throw new Error('KILO_WORKSPACE_CONTEXT_INVALID');
  }

  const trustedAgentPath = path.join(trustedDir, '.kilo', 'agents', 'hooshyar-repair.md');
  const trustedAgentContent = fs.readFileSync(trustedAgentPath, 'utf8');
  if (!trustedAgentContent.trim()) throw new Error('TRUSTED_KILO_AGENT_CONFIG_MISSING');

  const workspaceDir = fs.mkdtempSync(path.join(tempRoot, 'hooshyar-kilo-repair-'));
  try {
    const drillDir = path.join(workspaceDir, '.hooshyar', 'repair-drill');
    const agentDir = path.join(workspaceDir, '.kilo', 'agents');
    fs.mkdirSync(drillDir, { recursive: true });
    fs.mkdirSync(agentDir, { recursive: true });
    const missionPath = path.join(drillDir, 'mission.json');
    const scratchPath = path.join(drillDir, 'repair-target.cjs');
    const isolatedAgentPath = path.join(agentDir, 'hooshyar-repair.md');
    fs.writeFileSync(missionPath, missionText, 'utf8');
    fs.writeFileSync(scratchPath, scratchContent, 'utf8');
    fs.writeFileSync(isolatedAgentPath, trustedAgentContent, 'utf8');
    return {
      workspaceDir,
      drillDir,
      missionPath,
      scratchPath,
      isolatedAgentPath,
      trustedAgentContent
    };
  } catch (error) {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
    throw error;
  }
}

function run(command, args, options = {}) {
  const result = cp.spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    env: options.env || buildUnprivilegedEnv(process.env),
    stdio: options.stdio || 'pipe',
    windowsHide: true,
    shell: false
  });
  if (result.error) throw new Error(command + '_LAUNCH_FAILED:' + result.error.message);
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function installSourceDependencies(sourceDir, sourceEnv = process.env, executor = run) {
  if (typeof sourceDir !== 'string' || !sourceDir.trim()) {
    throw new Error('SOURCE_DEPENDENCY_DIRECTORY_INVALID');
  }
  const resolvedSourceDir = path.resolve(sourceDir);
  if (!fs.existsSync(path.join(resolvedSourceDir, 'package.json')) ||
      !fs.existsSync(path.join(resolvedSourceDir, 'package-lock.json'))) {
    throw new Error('SOURCE_DEPENDENCY_MANIFEST_MISSING');
  }
  const result = executor('npm', ['ci', '--ignore-scripts'], {
    cwd: resolvedSourceDir,
    stdio: 'inherit',
    env: buildUnprivilegedEnv(sourceEnv)
  });
  if (!result || result.status !== 0) {
    throw new Error('DEPENDENCY_INSTALL_FAILED:' + (result?.status ?? 'UNKNOWN'));
  }
  return result;
}

function gitStatus(sourceDir) {
  return run('git', [
    'status', '--porcelain=v1', '--untracked-files=all', '--',
    '.', ':(exclude).hooshyar', ':(exclude)node_modules'
  ], { cwd: sourceDir });
}

function parseResult(result, expectedExitCode) {
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  let record = null;
  try { record = lines.length ? JSON.parse(lines[lines.length - 1]) : null; } catch {}
  if (result.status !== expectedExitCode || !record || record.net === undefined) {
    throw new Error('DRILL_RESULT_INVALID:exit=' + result.status +
      ':stdout=' + result.stdout + ':stderr=' + result.stderr);
  }
  return record;
}

function buildKiloInvocation(missionPath, prompt, model = process.env.HOOSHYAR_KILO_MODEL || DEFAULT_FREE_MODEL) {
  if (typeof model !== 'string' || !/^[a-z0-9._-]+\/[a-z0-9._-]+:free$/i.test(model)) {
    throw new Error('FREE_MODEL_REQUIRED');
  }
  if (typeof missionPath !== 'string' || !path.isAbsolute(missionPath) ||
      typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('KILO_INVOCATION_CONTEXT_INVALID');
  }
  return {
    command: process.env.HOOSHYAR_KILO_COMMAND || 'kilo',
    args: ['run', '--auto', '--agent', 'hooshyar-repair', '--model', model, prompt, '--file', missionPath]
  };
}

function main() {
  const sourceDir = path.resolve(process.env.HOOSHYAR_SOURCE_DIR || 'source');
  const targetSha = process.env.TARGET_HEAD_SHA;
  const sourceRunId = Number(process.env.BASELINE_FACTORY_RUN_ID || process.env.FAILED_FACTORY_RUN_ID);
  const preflightRunId = Number(process.env.FAILED_FACTORY_RUN_ID);
  const sourceRunUrl = process.env.BASELINE_FACTORY_RUN_URL || process.env.FAILED_FACTORY_RUN_URL;
  const drillRunId = Number(process.env.GITHUB_RUN_ID);
  if (!/^[0-9a-f]{40}$/i.test(targetSha || '') ||
      !Number.isSafeInteger(sourceRunId) || sourceRunId < 1 ||
      !Number.isSafeInteger(preflightRunId) || preflightRunId < 1 ||
      !Number.isSafeInteger(drillRunId) || drillRunId < 1 ||
      typeof sourceRunUrl !== 'string' || !sourceRunUrl.startsWith('https://github.com/')) {
    throw new Error('DRILL_CONTEXT_INVALID');
  }

  const checkedOutSha = run('git', ['rev-parse', 'HEAD'], { cwd: sourceDir });
  if (checkedOutSha.status !== 0 || checkedOutSha.stdout.trim() !== targetSha) {
    throw new Error('TARGET_CHECKOUT_SHA_MISMATCH');
  }
  const initialStatus = gitStatus(sourceDir);
  if (initialStatus.status !== 0 || initialStatus.stdout.trim()) {
    throw new Error('TARGET_WORKTREE_NOT_CLEAN');
  }

  const fixture = CONTROLLED_FIXTURE_SOURCE;
  const injected = injectControlledDefect(fixture);
  const hooshyarDir = path.join(sourceDir, '.hooshyar');
  const drillDir = path.join(hooshyarDir, 'repair-drill');
  if (fs.existsSync(hooshyarDir) && fs.readdirSync(hooshyarDir).length > 0) {
    throw new Error('DRILL_EVIDENCE_DIRECTORY_NOT_EMPTY');
  }
  fs.mkdirSync(drillDir, { recursive: true });
  const scratchPath = path.join(drillDir, 'repair-target.cjs');
  const missionPath = path.join(drillDir, 'mission.json');
  fs.writeFileSync(scratchPath, injected, 'utf8');

  const before = run(process.execPath, [scratchPath], { cwd: drillDir });
  const beforeRecord = parseResult(before, 1);
  if (beforeRecord.net === 1200 || !before.stderr.includes('expected net=1200')) {
    throw new Error('CONTROLLED_FAILURE_NOT_OBSERVED');
  }

  const mission = {
    type: 'ASSISTANT_REPAIR_MISSION_V1',
    mode: 'controlled-drill',
    status: 'BLOCKED',
    repository: process.env.GITHUB_REPOSITORY,
    branch: process.env.TARGET_BRANCH,
    commit: targetSha,
    sourceFactoryRunId: sourceRunId,
    target: DRILL_PATH,
    observedFailure: {
      command: 'node ' + DRILL_PATH,
      exitCode: before.status,
      output: before.stdout.trim(),
      error: before.stderr.trim()
    },
    expected: 'The scratch fixture must calculate revenue + negative expense = 1200.',
    rules: [
      'Edit only .hooshyar/repair-drill/repair-target.cjs.',
      'Do not edit tracked files, workflows, tests, or production code.',
      'Do not commit, push, or change git configuration.',
      'Do not execute commands. The trusted runner will validate the exact repaired fixture and run the green check.'
    ]
  };
  const missionText = JSON.stringify(mission, null, 2) + '\n';
  fs.writeFileSync(missionPath, missionText, 'utf8');

  const prompt = [
    'You are the HooshyarOS bounded autonomous repair operator.',
    'Read only .hooshyar/repair-drill/mission.json and repair only .hooshyar/repair-drill/repair-target.cjs.',
    'This workspace contains a trusted repair-agent policy and only the fault-injected scratch fixture.',
    'Do not execute commands; the trusted outer runner performs the red/green checks after this edit.',
    'Do not inspect paths outside this isolated workspace, edit other files, commit, push, or change git configuration.',
    'Stop after the scratch fixture returns JSON with net=1200 and exit code 0.'
  ].join(' ');

  const isolated = prepareIsolatedKiloWorkspace({
    trustedDir: process.cwd(),
    missionText,
    scratchContent: injected
  });
  try {
    const invocation = buildKiloInvocation(isolated.missionPath, prompt);
    const kilo = run(invocation.command, invocation.args, {
      cwd: isolated.workspaceDir,
      stdio: 'inherit',
      env: buildUnprivilegedEnv(process.env)
    });
    if (kilo.status !== 0) throw new Error('KILO_CONTROLLED_REPAIR_FAILED:' + kilo.status);

    if (fs.readFileSync(isolated.missionPath, 'utf8') !== missionText) {
      throw new Error('CONTROLLED_REPAIR_MODIFIED_MISSION');
    }
    const expectedDrillEntries = ['mission.json', 'repair-target.cjs'];
    const actualDrillEntries = fs.readdirSync(isolated.drillDir).sort();
    if (JSON.stringify(actualDrillEntries) !== JSON.stringify(expectedDrillEntries)) {
      throw new Error('CONTROLLED_REPAIR_CREATED_EXTRA_DRILL_FILES:' + actualDrillEntries.join(','));
    }
    const actualWorkspaceEntries = fs.readdirSync(isolated.workspaceDir).sort();
    if (JSON.stringify(actualWorkspaceEntries) !== JSON.stringify(['.hooshyar', '.kilo'])) {
      throw new Error('CONTROLLED_REPAIR_CREATED_EXTRA_WORKSPACE_FILES:' + actualWorkspaceEntries.join(','));
    }
    const actualEvidenceEntries = fs.readdirSync(path.join(isolated.workspaceDir, '.hooshyar')).sort();
    if (JSON.stringify(actualEvidenceEntries) !== JSON.stringify(['repair-drill'])) {
      throw new Error('CONTROLLED_REPAIR_CREATED_EXTRA_EVIDENCE_FILES:' + actualEvidenceEntries.join(','));
    }
    const actualKiloEntries = fs.readdirSync(path.join(isolated.workspaceDir, '.kilo')).sort();
    const actualAgentEntries = fs.readdirSync(path.dirname(isolated.isolatedAgentPath)).sort();
    if (JSON.stringify(actualKiloEntries) !== JSON.stringify(['agents']) ||
        JSON.stringify(actualAgentEntries) !== JSON.stringify(['hooshyar-repair.md'])) {
      throw new Error('CONTROLLED_REPAIR_CREATED_EXTRA_AGENT_CONFIG_FILES');
    }
    if (fs.readFileSync(isolated.isolatedAgentPath, 'utf8') !== isolated.trustedAgentContent) {
      throw new Error('CONTROLLED_REPAIR_MODIFIED_TRUSTED_AGENT_CONFIG');
    }

    const repairedScratch = fs.readFileSync(isolated.scratchPath, 'utf8');
    if (repairedScratch !== fixture) {
      throw new Error('CONTROLLED_REPAIR_CONTENT_NOT_EXACT');
    }
    fs.writeFileSync(scratchPath, repairedScratch, 'utf8');
  } finally {
    fs.rmSync(isolated.workspaceDir, { recursive: true, force: true });
  }

  const finalStatus = gitStatus(sourceDir);
  if (finalStatus.status !== 0 || finalStatus.stdout.trim()) {
    throw new Error('CONTROLLED_REPAIR_TOUCHED_TRACKED_OR_UNRELATED_FILES:' + finalStatus.stdout);
  }

  const after = run(process.execPath, [scratchPath], { cwd: drillDir });
  const afterRecord = parseResult(after, 0);
  if (afterRecord.net !== 1200 || fs.readFileSync(scratchPath, 'utf8') !== fixture) {
    throw new Error('CONTROLLED_REPAIR_NOT_EFFECTIVE');
  }

  // Kilo is untrusted and could alter ignored node_modules files. Rebuild from
  // the now-verified, clean lockfile before collecting regression evidence.
  installSourceDependencies(sourceDir);

  const jest = run(process.execPath, [path.join(sourceDir, 'node_modules', 'jest', 'bin', 'jest.js'), '--runInBand'], {
    cwd: sourceDir,
    stdio: 'inherit',
    env: buildUnprivilegedEnv(process.env)
  });
  if (jest.status !== 0) throw new Error('FULL_JEST_FAILED:' + jest.status);

  const python = run(process.env.HOOSHYAR_PYTHON || 'python', ['-m', 'compileall', '-q', 'Backend/AI_Runtime'], {
    cwd: sourceDir,
    stdio: 'inherit',
    env: buildUnprivilegedEnv(process.env)
  });
  if (python.status !== 0) throw new Error('PYTHON_SYNTAX_FAILED:' + python.status);

  const sourceRun = { id: sourceRunId, html_url: sourceRunUrl };
  const missionId = crypto.createHash('sha256').update(JSON.stringify({
    repository: process.env.GITHUB_REPOSITORY,
    branch: process.env.TARGET_BRANCH,
    targetSha,
    sourceRunId,
    drillRunId,
    injected: beforeRecord,
    repaired: afterRecord
  })).digest('hex');

  const evidence = buildControlledDrillEvidence({
    commit: targetSha,
    missionId,
    triggerRun: sourceRun,
    preflightRunId,
    drillRunId,
    injectedResult: beforeRecord.net,
    repairedResult: afterRecord.net
  });
  const validation = validateControlledDrillEvidence(evidence, targetSha, drillRunId);
  if (!validation.valid) throw new Error('CONTROLLED_DRILL_EVIDENCE_INVALID:' + validation.reason);

  const evidencePath = path.join(sourceDir, '.hooshyar', 'agent-repair-success.json');
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    type: 'AUTONOMOUS_REPAIR_OPT_IN',
    status: 'PASS',
    mode: 'controlled-drill',
    targetSha,
    sourceFactoryRunId: sourceRunId,
    drillRunId,
    fullJest: 'PASS',
    pythonSyntax: 'PASS',
    evidencePath: '.hooshyar/agent-repair-success.json'
  }, null, 2));
}

if (require.main === module) {
  try {
    if (process.argv[2] === '--install-source-dependencies') {
      installSourceDependencies(process.argv[3] || '../source');
      console.log(JSON.stringify({
        type: 'AUTONOMOUS_REPAIR_DEPENDENCY_INSTALL',
        status: 'PASS',
        lifecycleScripts: 'DISABLED'
      }));
    } else {
      main();
    }
  } catch (error) {
    console.error(JSON.stringify({
      type: process.argv[2] === '--install-source-dependencies'
        ? 'AUTONOMOUS_REPAIR_DEPENDENCY_INSTALL'
        : 'AUTONOMOUS_REPAIR_OPT_IN',
      status: 'BLOCKED',
      error: error.message
    }));
    process.exit(2);
  }
}

module.exports = {
  CONTROLLED_FIXTURE_SOURCE,
  buildUnprivilegedEnv,
  buildKiloInvocation,
  installSourceDependencies,
  prepareIsolatedKiloWorkspace,
  gitStatus,
  injectControlledDefect,
  parseResult
};
