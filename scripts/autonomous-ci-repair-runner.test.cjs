'use strict';

const { assertCleanRepairBaseline } = require('./autonomous-ci-repair-runner.cjs');

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
});
