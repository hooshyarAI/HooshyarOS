'use strict';

const {
  assertCleanRepairBaseline,
  buildUnprivilegedEnv,
  buildGitPushEnv,
  buildFactoryDispatchPayload,
  prioritizeFailedJobs,
  assertFailedRunForHead
} = require('./autonomous-ci-repair-runner.cjs');

describe('autonomous CI repair worktree baseline', () => {
  test('allows repair only from a clean tracked and untracked worktree', () => {
    expect(assertCleanRepairBaseline({ status: 0, stdout: '', stderr: '' })).toBe(true);
  });

  test('blocks tracked changes that exist before the repair agent runs', () => {
    expect(() => assertCleanRepairBaseline({
      status: 0,
      stdout: ' M package-lock.json\n',
      stderr: ''
    })).toThrow('AUTONOMOUS_REPAIR_BLOCKED_PREEXISTING_WORKTREE_CHANGES');
  });

  test('blocks unrelated untracked files that exist before the repair agent runs', () => {
    expect(() => assertCleanRepairBaseline({
      status: 0,
      stdout: '?? unrelated.tmp\n',
      stderr: ''
    })).toThrow('AUTONOMOUS_REPAIR_BLOCKED_PREEXISTING_WORKTREE_CHANGES');
  });

  test('fails closed when git status cannot be read', () => {
    expect(() => assertCleanRepairBaseline({
      status: 128,
      stdout: '',
      stderr: 'fatal: not a git repository'
    })).toThrow('AUTONOMOUS_REPAIR_CLEAN_BASELINE_CHECK_FAILED');
  });

  test('strips GitHub write credentials from all unprivileged child processes', () => {
    const env = buildUnprivilegedEnv({
      PATH: '/usr/bin',
      GITHUB_TOKEN: 'write-token',
      GH_TOKEN: 'alternate-token',
      ACTIONS_RUNTIME_TOKEN: 'runtime-token',
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'identity-token',
      GIT_CONFIG_VALUE_0: 'credential-header',
      KILO_CONFIG_CONTENT: '{"model":"kilo-auto/free"}'
    });
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.GH_TOKEN).toBeUndefined();
    expect(env.ACTIONS_RUNTIME_TOKEN).toBeUndefined();
    expect(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN).toBeUndefined();
    expect(env.GIT_CONFIG_VALUE_0).toBeUndefined();
    expect(env.KILO_CONFIG_CONTENT).toBe('{"model":"kilo-auto/free"}');
  });

  test('builds a one-command Git push credential without exposing token variables', () => {
    const env = buildGitPushEnv({ GITHUB_TOKEN: 'example-write-token', PATH: '/usr/bin' });
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.GH_TOKEN).toBeUndefined();
    expect(env.GIT_CONFIG_COUNT).toBe('1');
    expect(env.GIT_CONFIG_KEY_0).toBe('http.https://github.com/.extraheader');
    expect(env.GIT_CONFIG_VALUE_0).toBe(
      'AUTHORIZATION: basic ' + Buffer.from('x-access-token:example-write-token').toString('base64')
    );
    expect(() => buildGitPushEnv({ PATH: '/usr/bin' })).toThrow('GITHUB_PUSH_TOKEN_MISSING');
  });
  test('only dispatches the isolated repair drill when the PR explicitly opts in', () => {
    expect(buildFactoryDispatchPayload('fix/qualification-runner-fail-closed', false)).toEqual({
      ref: 'fix/qualification-runner-fail-closed'
    });
    expect(buildFactoryDispatchPayload('fix/qualification-runner-fail-closed', true)).toEqual({
      ref: 'fix/qualification-runner-fail-closed',
      inputs: { ci_repair_drill: true }
    });
    expect(() => buildFactoryDispatchPayload('')).toThrow('FACTORY_DISPATCH_REF_REQUIRED');
  });

  test('prioritizes an actual failed target before evidence-only wrapper failures', () => {
    const ordered = prioritizeFailedJobs([
      { name: 'release-gate', started_at: '2026-10-21T20:08:00Z' },
      { name: 'runtime-evidence-qualification', started_at: '2026-10-21T20:07:00Z' },
      { name: 'agent-repair-drill', started_at: '2026-10-21T19:54:10Z' }
    ]);
    expect(ordered.map(job => job.name)).toEqual([
      'agent-repair-drill',
      'runtime-evidence-qualification',
      'release-gate'
    ]);
  });

  test('repair mission must target the exact failed source commit', () => {
    const sha = 'a'.repeat(40);
    expect(assertFailedRunForHead(sha, { head_sha: sha, conclusion: 'failure' })).toBe(true);
    expect(() => assertFailedRunForHead(sha, { head_sha: 'b'.repeat(40), conclusion: 'failure' }))
      .toThrow('AUTONOMOUS_CI_REPAIR_TARGET_SHA_MISMATCH');
    expect(() => assertFailedRunForHead(sha, { head_sha: sha, conclusion: 'success' }))
      .toThrow('AUTONOMOUS_CI_REPAIR_TARGET_RUN_NOT_FAILED');
  });

});
