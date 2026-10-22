'use strict';

const {
  OPT_IN_VALUE,
  FAILED_EVIDENCE_JOBS,
  REQUIRED_ACCEPTANCE_JOBS,
  validatePreflight,
  validateBaselineFactoryRun,
  injectControlledDefect,
  validateControlledDrillEvidence,
  buildControlledDrillEvidence
} = require('./agent-repair-optin-policy.cjs');
const { isCiFeedbackPass } = require('./cline-runtime-evidence-collector.cjs');
const { buildKiloInvocation, buildUnprivilegedEnv, installSourceDependencies, gitStatus, prepareIsolatedKiloWorkspace } = require('./agent-repair-optin-runner.cjs');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');

const SHA = 'a'.repeat(40);
const REPO = 'hooshyarAI/HooshyarOS';

function sourceFixture(overrides = {}) {
  const pullRequest = {
    number: 144,
    state: 'open',
    base: { ref: 'fix/autonomous-product-factory', sha: 'b'.repeat(40) },
    head: { ref: 'fix/qualification-runner-fail-closed', sha: SHA, repo: { full_name: REPO } }
  };
  const sourceRun = {
    id: 39665624528,
    name: 'Final Product Factory',
    path: '.github/workflows/final-product-factory.yml',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'failure',
    head_sha: SHA,
    head_branch: pullRequest.head.ref,
    html_url: 'https://github.com/hooshyarAI/HooshyarOS/actions/runs/39665624528',
    pull_requests: [{ number: 144 }]
  };
  const jobs = [
    ...REQUIRED_ACCEPTANCE_JOBS.map(name => ({ name, conclusion: 'success' })),
    ...FAILED_EVIDENCE_JOBS.map(name => ({ name, conclusion: 'failure' }))
  ];
  return {
    ref: 'refs/heads/main',
    optIn: OPT_IN_VALUE,
    repository: REPO,
    prNumber: 144,
    targetHeadSha: SHA,
    failedFactoryRunId: 39665624528,
    pullRequest,
    sourceRun,
    jobs,
    ...overrides
  };
}

function validDrillEvidence() {
  const triggerRun = {
    id: 39665624528,
    html_url: 'https://github.com/hooshyarAI/HooshyarOS/actions/runs/39665624528'
  };
  return buildControlledDrillEvidence({
    commit: SHA,
    missionId: 'c'.repeat(64),
    triggerRun,
    preflightRunId: 39665624519,
    drillRunId: 39670000001,
    injectedResult: 1800,
    repairedResult: 1200
  });
}

describe('autonomous CI repair opt-in policy', () => {
  test('accepts only an explicitly opted-in, trusted-main, same-repository PR and the exact evidence-only factory failure', () => {
    const result = validatePreflight(sourceFixture());
    expect(result).toMatchObject({
      ok: true,
      reason: 'EXACT_PR_SHA_AND_EVIDENCE_ONLY_FAILURE_VERIFIED',
      targetBranch: 'fix/qualification-runner-fail-closed',
      targetHeadSha: SHA,
      failedFactoryRunId: 39665624528,
      failedJobs: [...FAILED_EVIDENCE_JOBS].sort()
    });
  });

  test.each([
    [{ ref: 'refs/heads/fix/qualification-runner-fail-closed' }, 'UNTRUSTED_DISPATCH_REF'],
    [{ optIn: 'NO' }, 'EXPLICIT_OPT_IN_REQUIRED'],
    [{ targetHeadSha: 'not-a-sha' }, 'TARGET_HEAD_SHA_INVALID'],
    [{ pullRequest: { ...sourceFixture().pullRequest, head: { ...sourceFixture().pullRequest.head, sha: 'd'.repeat(40) } } }, 'TARGET_HEAD_SHA_MISMATCH'],
    [{ pullRequest: { ...sourceFixture().pullRequest, head: { ...sourceFixture().pullRequest.head, repo: { full_name: 'someone/fork' } } } }, 'CROSS_REPOSITORY_HEAD_BLOCKED'],
    [{ sourceRun: { ...sourceFixture().sourceRun, head_sha: 'e'.repeat(40) } }, 'SOURCE_RUN_HEAD_MISMATCH'],
    [{ jobs: [...sourceFixture().jobs, { name: 'windows-product-factory', conclusion: 'failure' }] }, 'SOURCE_RUN_FAILURE_SCOPE_NOT_EVIDENCE_ONLY'],
    [{ jobs: sourceFixture().jobs.filter(job => job.name !== 'android-product-acceptance') }, 'SOURCE_ACCEPTANCE_JOB_NOT_GREEN:android-product-acceptance']
  ])('blocks invalid preflight cases', (override, reason) => {
    expect(validatePreflight(sourceFixture(override))).toMatchObject({ ok: false, reason });
  });

  test('baseline factory run must be same-SHA and fail only at the two evidence gates', () => {
    const run = {
      id: 39670000010,
      name: 'Final Product Factory',
      path: '.github/workflows/final-product-factory.yml',
      event: 'workflow_dispatch',
      status: 'completed',
      conclusion: 'failure',
      head_sha: SHA,
      head_branch: 'fix/qualification-runner-fail-closed',
      html_url: 'https://github.com/hooshyarAI/HooshyarOS/actions/runs/39670000010'
    };
    const jobs = [
      ...REQUIRED_ACCEPTANCE_JOBS.map(name => ({ name, conclusion: 'success' })),
      ...FAILED_EVIDENCE_JOBS.map(name => ({ name, conclusion: 'failure' }))
    ];
    expect(validateBaselineFactoryRun({
      run, jobs, targetBranch: 'fix/qualification-runner-fail-closed', targetHeadSha: SHA
    })).toMatchObject({ ok: true, failedJobs: [...FAILED_EVIDENCE_JOBS].sort() });
    expect(validateBaselineFactoryRun({
      run: { ...run, head_sha: 'f'.repeat(40) }, jobs,
      targetBranch: 'fix/qualification-runner-fail-closed', targetHeadSha: SHA
    }).ok).toBe(false);
    expect(validateBaselineFactoryRun({
      run, jobs: [...jobs, { name: 'android-product-acceptance', conclusion: 'failure' }],
      targetBranch: 'fix/qualification-runner-fail-closed', targetHeadSha: SHA
    }).ok).toBe(false);
  });

  test('controlled-drill evidence qualifies ci-feedback only on the exact commit', () => {
    const evidence = validDrillEvidence();
    expect(isCiFeedbackPass(evidence, SHA, evidence.drill.runId)).toBe(true);
    expect(isCiFeedbackPass(evidence, SHA)).toBe(false);
    expect(isCiFeedbackPass(evidence, SHA, evidence.drill.runId + 1)).toBe(false);
    expect(isCiFeedbackPass(evidence, 'f'.repeat(40), evidence.drill.runId)).toBe(false);
  });

  test('gitStatus detects changes to tracked Kilo agent configuration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hooshyar-repair-scope-'));
    try {
      cp.execFileSync('git', ['init', '-q'], { cwd: root });
      const agentPath = path.join(root, '.kilo', 'agents', 'hooshyar-repair.md');
      fs.mkdirSync(path.dirname(agentPath), { recursive: true });
      fs.writeFileSync(agentPath, 'original agent policy\n', 'utf8');
      cp.execFileSync('git', ['add', '.kilo/agents/hooshyar-repair.md'], { cwd: root });
      cp.execFileSync('git', [
        '-c', 'user.name=Hooshyar Test',
        '-c', 'user.email=hooshyar-test@example.invalid',
        'commit', '-qm', 'baseline'
      ], { cwd: root });

      fs.writeFileSync(agentPath, 'modified agent policy\n', 'utf8');
      const status = gitStatus(root);

      expect(status.status).toBe(0);
      expect(status.stdout).toContain('.kilo/agents/hooshyar-repair.md');
      expect(status.stdout).toContain(' M .kilo/agents/hooshyar-repair.md');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('untrusted Kilo process does not inherit runner command files, credentials, or config overrides', () => {
    const env = buildUnprivilegedEnv({
      PATH: '/usr/bin',
      HOME: '/tmp/hooshyar-home',
      GITHUB_TOKEN: 'repository-token',
      ACTIONS_RUNTIME_TOKEN: 'runtime-token',
      GITHUB_ENV: '/tmp/set_env',
      GITHUB_OUTPUT: '/tmp/set_output',
      GITHUB_PATH: '/tmp/add_path',
      GITHUB_STATE: '/tmp/save_state',
      GITHUB_STEP_SUMMARY: '/tmp/summary',
      GITHUB_EVENT_PATH: '/tmp/event.json',
      GITHUB_WORKSPACE: '/home/runner/work/HooshyarOS/HooshyarOS',
      RUNNER_TEMP: '/home/runner/work/_temp',
      KILO_CONFIG_CONTENT: '{"agent":{"hooshyar-repair":{"permission":{"bash":"allow"}}}}'
    });

    expect(env).toMatchObject({ PATH: '/usr/bin', HOME: '/tmp/hooshyar-home' });
    for (const key of [
      'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'GITHUB_ENV', 'GITHUB_OUTPUT',
      'GITHUB_PATH', 'GITHUB_STATE', 'GITHUB_STEP_SUMMARY', 'GITHUB_EVENT_PATH',
      'GITHUB_WORKSPACE', 'RUNNER_TEMP', 'KILO_CONFIG_CONTENT'
    ]) {
      expect(env[key]).toBeUndefined();
    }
  });

  test('builder validation runs the sanitized install path and focused contract tests', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'autonomous-validation.yml'), 'utf8');
    expect(workflow).toContain('node scripts/agent-repair-optin-runner.cjs --install-source-dependencies .');
    expect(workflow).toContain('node ./node_modules/jest/bin/jest.js --runInBand --runTestsByPath scripts/agent-repair-optin-policy.test.cjs');
  });

  test('source dependency install disables lifecycle scripts and strips runner control variables', () => {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooshyar-safe-npm-ci-'));
    fs.writeFileSync(path.join(sourceDir, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n', 'utf8');
    fs.writeFileSync(path.join(sourceDir, 'package-lock.json'), JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: { '': { name: 'fixture', version: '1.0.0' } }
    }) + '\n', 'utf8');

    const originalEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      GITHUB_TOKEN: 'read-token',
      ACTIONS_RUNTIME_TOKEN: 'runtime-token',
      GITHUB_ENV: '/runner/temp/_github_env',
      GITHUB_OUTPUT: '/runner/temp/_github_output',
      GITHUB_PATH: '/runner/temp/_github_path',
      KILO_CONFIG_CONTENT: '{"agent":{"permission":"allow"}}'
    };
    let observed;
    try {
      installSourceDependencies(sourceDir, originalEnv, (command, args, options) => {
        observed = { command, args, options };
        return { status: 0, stdout: '', stderr: '' };
      });

      expect(observed.command).toBe('npm');
      expect(observed.args).toEqual(['ci', '--ignore-scripts']);
      expect(observed.options.cwd).toBe(path.resolve(sourceDir));
      expect(observed.options.env.PATH).toBe(originalEnv.PATH);
      expect(observed.options.env.GITHUB_TOKEN).toBeUndefined();
      expect(observed.options.env.ACTIONS_RUNTIME_TOKEN).toBeUndefined();
      expect(observed.options.env.GITHUB_ENV).toBeUndefined();
      expect(observed.options.env.GITHUB_OUTPUT).toBeUndefined();
      expect(observed.options.env.GITHUB_PATH).toBeUndefined();
      expect(observed.options.env.KILO_CONFIG_CONTENT).toBeUndefined();
    } finally {
      fs.rmSync(sourceDir, { recursive: true, force: true });
    }
  });

  test('opt-in workflow installs target dependencies through the trusted wrapper without lifecycle scripts', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'autonomous-ci-repair-optin.yml'), 'utf8');
    const repairJob = workflow.split('  repair-drill:')[1].split('  dispatch-and-verify:')[0];

    expect(repairJob).toContain('working-directory: trusted\n        run: node scripts/agent-repair-optin-runner.cjs --install-source-dependencies ../source');
    expect(repairJob).not.toContain('working-directory: source\n        run: npm ci');
    expect(repairJob).toContain('Install locked dependencies without executing untrusted lifecycle scripts');

    const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'agent-repair-optin-runner.cjs'), 'utf8');
    expect(runner).toContain("executor('npm', ['ci', '--ignore-scripts']");
    expect(runner).toContain('env: buildUnprivilegedEnv(sourceEnv)');
  });

  test('Kilo runs in an isolated scratch workspace using only the trusted agent policy', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hooshyar-kilo-isolation-test-'));
    const trustedDir = path.join(root, 'trusted');
    const sourceDir = path.join(root, 'untrusted-source');
    const tempRoot = path.join(root, 'temp');
    const trustedAgent = path.join(trustedDir, '.kilo', 'agents', 'hooshyar-repair.md');
    const untrustedAgent = path.join(sourceDir, '.kilo', 'agents', 'hooshyar-repair.md');
    const trustedPolicy = 'trusted workflow policy\n';
    const untrustedPolicy = 'untrusted PR policy: allow all tools\n';

    try {
      fs.mkdirSync(path.dirname(trustedAgent), { recursive: true });
      fs.mkdirSync(path.dirname(untrustedAgent), { recursive: true });
      fs.mkdirSync(tempRoot, { recursive: true });
      fs.writeFileSync(trustedAgent, trustedPolicy, 'utf8');
      fs.writeFileSync(untrustedAgent, untrustedPolicy, 'utf8');
      fs.writeFileSync(path.join(sourceDir, 'package.json'), '{"private":true}\n', 'utf8');

      const prepared = prepareIsolatedKiloWorkspace({
        trustedDir,
        missionText: '{"type":"mission"}\n',
        scratchContent: 'return revenue - expense;\n',
        tempRoot
      });
      try {
        expect(prepared.workspaceDir.startsWith(sourceDir + path.sep)).toBe(false);
        expect(fs.readFileSync(prepared.isolatedAgentPath, 'utf8')).toBe(trustedPolicy);
        expect(fs.readFileSync(untrustedAgent, 'utf8')).toBe(untrustedPolicy);
        expect(fs.readdirSync(prepared.workspaceDir).sort()).toEqual(['.hooshyar', '.kilo']);
        expect(fs.readdirSync(prepared.drillDir).sort()).toEqual(['mission.json', 'repair-target.cjs']);
        expect(fs.readdirSync(path.join(prepared.workspaceDir, '.kilo')).sort()).toEqual(['agents']);
        expect(fs.readdirSync(path.dirname(prepared.isolatedAgentPath)).sort()).toEqual(['hooshyar-repair.md']);
        expect(fs.existsSync(path.join(prepared.workspaceDir, 'package.json'))).toBe(false);
      } finally {
        fs.rmSync(prepared.workspaceDir, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('Kilo invocation pins an explicit free model and keeps the task attachment bounded', () => {
    const invocation = buildKiloInvocation(
      '/tmp/hooshyar-repair-mission.json',
      'Repair only the scratch fixture.',
      'nvidia/nemotron-3.5-super-vl:free'
    );
    expect(invocation).toEqual({
      command: 'kilo',
      args: [
        'run', '--auto', '--agent', 'hooshyar-repair',
        '--model', 'nvidia/nemotron-3.5-super-vl:free',
        'Repair only the scratch fixture.',
        '--file', '/tmp/hooshyar-repair-mission.json'
      ]
    });
    expect(() => buildKiloInvocation('/tmp/mission.json', 'test', 'kilo/kilo-auto/free')).toThrow('FREE_MODEL_REQUIRED');
    expect(() => buildKiloInvocation('/tmp/mission.json', 'test', 'anthropic/claude-sonnet')).toThrow('FREE_MODEL_REQUIRED');
  });

  test('opt-in workflow pins Kilo CLI and the explicit free model without a paid fallback route', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'autonomous-ci-repair-optin.yml'), 'utf8');
    expect(workflow).toContain('npm install --global @kilocode/cli@7.8.12');
    expect(workflow).toContain('HOOSHYAR_KILO_MODEL: nvidia/nemotron-3.5-super-vl:free');
    expect(workflow).not.toContain('KILO_CONFIG_CONTENT');
  });

  test('repair drill provisions Python and reinstalls locked dependencies before regression verification', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'autonomous-ci-repair-optin.yml'), 'utf8');
    const repairJob = workflow.split('  repair-drill:')[1].split('  dispatch-and-verify:')[0];
    expect(repairJob).toContain('uses: actions/setup-python@v5');
    expect(repairJob).toContain('python-version: "3.11"');

    const runner = fs.readFileSync(path.join(process.cwd(), 'scripts', 'agent-repair-optin-runner.cjs'), 'utf8');
    const kiloIndex = runner.indexOf('const kilo = run(invocation.command, invocation.args');
    const dependencyRestoreIndex = runner.lastIndexOf('installSourceDependencies(sourceDir)');
    const jestIndex = runner.indexOf('const jest = run(process.execPath');
    expect(kiloIndex).toBeGreaterThanOrEqual(0);
    expect(dependencyRestoreIndex).toBeGreaterThan(kiloIndex);
    expect(jestIndex).toBeGreaterThan(dependencyRestoreIndex);
  });

  test('opt-in workflow keeps repair execution unprivileged and reserves write permission for trusted dispatch', () => {
    const workflow = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'autonomous-ci-repair-optin.yml'), 'utf8');
    const repairJob = workflow.split('  repair-drill:')[1].split('  dispatch-and-verify:')[0];
    const dispatchJob = workflow.split('  dispatch-and-verify:')[1];
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('I_AUTHORIZE_ONE_CONTROLLED_REPAIR_DRILL');
    expect(workflow).toContain('ref: ${{ github.sha }}');
    expect(repairJob).not.toContain('GITHUB_TOKEN:');
    expect(repairJob).not.toContain('actions: write');
    expect(dispatchJob).toContain('actions: write');
    expect(dispatchJob).toContain('dispatch-and-wait');
    const factoryWorkflow = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'final-product-factory.yml'), 'utf8');
    expect(factoryWorkflow).toContain('autonomous-ci-repair-optin.yml/runs');
    expect(factoryWorkflow).toContain('AGENT_REPAIR_ARTIFACT=ACCEPTED');
    expect(factoryWorkflow).toContain('HOOSHYAR_EXPECTED_REPAIR_RUN_ID');
  });

  test('controlled fault injection requires exactly one known fixture expression', () => {
    expect(injectControlledDefect('return revenue + expense;')).toBe('return revenue - expense;');
    expect(() => injectControlledDefect('return income + expense;')).toThrow('DRILL_SOURCE_CONTRACT_CHANGED');
    expect(() => injectControlledDefect('return revenue + expense;\nreturn revenue + expense;')).toThrow('DRILL_SOURCE_CONTRACT_CHANGED');
  });

  test('controlled drill evidence is accepted only for this commit, observed failure, observed repair and full regressions', () => {
    const evidence = validDrillEvidence();
    expect(validateControlledDrillEvidence(evidence, SHA, evidence.drill.runId)).toEqual({
      valid: true,
      reason: 'CONTROLLED_REPAIR_DRILL_AND_SAME_COMMIT_PRODUCT_ACCEPTANCE_VERIFIED'
    });
    expect(validateControlledDrillEvidence(evidence, 'd'.repeat(40), evidence.drill.runId).reason).toBe('EVIDENCE_COMMIT_MISMATCH');

    const noRed = validDrillEvidence();
    noRed.drill.injectedExitCode = 0;
    expect(validateControlledDrillEvidence(noRed, SHA, noRed.drill.runId).reason).toBe('CONTROLLED_FAILURE_REPAIR_NOT_PROVEN');

    const noGreen = validDrillEvidence();
    noGreen.regression.fullJest = 'FAIL';
    expect(validateControlledDrillEvidence(noGreen, SHA, noGreen.drill.runId).reason).toBe('REGRESSION_EVIDENCE_NOT_PASS');

    const falseFactory = validDrillEvidence();
    falseFactory.factoryAcceptance.productFactoryConclusion = 'failure';
    expect(validateControlledDrillEvidence(falseFactory, SHA, falseFactory.drill.runId).reason).toBe('SOURCE_FACTORY_ACCEPTANCE_PROVENANCE_INVALID');

    const wrongScope = validDrillEvidence();
    wrongScope.repair.changedPaths = ['Backend/server.ts'];
    expect(validateControlledDrillEvidence(wrongScope, SHA, wrongScope.drill.runId).reason).toBe('CONTROLLED_REPAIR_SCOPE_OR_RESULT_INVALID');

    const fakeFailureScope = validDrillEvidence();
    fakeFailureScope.finding.failedJobs = ['windows-product-factory'];
    expect(validateControlledDrillEvidence(fakeFailureScope, SHA, fakeFailureScope.drill.runId).reason).toBe('TRIGGER_RUN_PROVENANCE_INVALID');
  });
});
