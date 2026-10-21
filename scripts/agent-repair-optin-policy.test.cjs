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
const { buildKiloInvocation } = require('./agent-repair-optin-runner.cjs');
const fs = require('node:fs');
const path = require('node:path');

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
    expect(isCiFeedbackPass(evidence, SHA)).toBe(true);
    expect(isCiFeedbackPass(evidence, 'f'.repeat(40))).toBe(false);
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
    expect(workflow).toContain('npm install --global @kilocode/cli@7.8.15');
    expect(workflow).toContain('HOOSHYAR_KILO_MODEL: nvidia/nemotron-3.5-super-vl:free');
    expect(workflow).not.toContain('KILO_CONFIG_CONTENT');
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
  });

  test('controlled fault injection requires exactly one known fixture expression', () => {
    expect(injectControlledDefect('return revenue + expense;')).toBe('return revenue - expense;');
    expect(() => injectControlledDefect('return income + expense;')).toThrow('DRILL_SOURCE_CONTRACT_CHANGED');
    expect(() => injectControlledDefect('return revenue + expense;\nreturn revenue + expense;')).toThrow('DRILL_SOURCE_CONTRACT_CHANGED');
  });

  test('controlled drill evidence is accepted only for this commit, observed failure, observed repair and full regressions', () => {
    const evidence = validDrillEvidence();
    expect(validateControlledDrillEvidence(evidence, SHA)).toEqual({
      valid: true,
      reason: 'CONTROLLED_REPAIR_DRILL_AND_SAME_COMMIT_PRODUCT_ACCEPTANCE_VERIFIED'
    });
    expect(validateControlledDrillEvidence(evidence, 'd'.repeat(40)).reason).toBe('EVIDENCE_COMMIT_MISMATCH');

    const noRed = validDrillEvidence();
    noRed.drill.injectedExitCode = 0;
    expect(validateControlledDrillEvidence(noRed, SHA).reason).toBe('CONTROLLED_FAILURE_REPAIR_NOT_PROVEN');

    const noGreen = validDrillEvidence();
    noGreen.regression.fullJest = 'FAIL';
    expect(validateControlledDrillEvidence(noGreen, SHA).reason).toBe('REGRESSION_EVIDENCE_NOT_PASS');

    const falseFactory = validDrillEvidence();
    falseFactory.factoryAcceptance.productFactoryConclusion = 'failure';
    expect(validateControlledDrillEvidence(falseFactory, SHA).reason).toBe('SOURCE_FACTORY_ACCEPTANCE_PROVENANCE_INVALID');

    const wrongScope = validDrillEvidence();
    wrongScope.repair.changedPaths = ['Backend/server.ts'];
    expect(validateControlledDrillEvidence(wrongScope, SHA).reason).toBe('CONTROLLED_REPAIR_SCOPE_OR_RESULT_INVALID');

    const fakeFailureScope = validDrillEvidence();
    fakeFailureScope.finding.failedJobs = ['windows-product-factory'];
    expect(validateControlledDrillEvidence(fakeFailureScope, SHA).reason).toBe('TRIGGER_RUN_PROVENANCE_INVALID');
  });
});
