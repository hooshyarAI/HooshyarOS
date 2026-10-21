'use strict';

const { buildFullSuiteEvidence, TYPE, REQUIRED_ACCEPTANCE, TYPESCRIPT_SCOPE } = require('./full-suite-evidence.cjs');

describe('full-suite evidence contract', () => {
  const input = {
    commit: 'a'.repeat(40),
    runId: 12345,
    securityTenantResult: 'success'
  };

  test('creates evidence bound to the exact commit and workflow run', () => {
    expect(buildFullSuiteEvidence(input)).toEqual(expect.objectContaining({
      type: TYPE,
      status: 'PASS',
      commit: input.commit,
      runId: input.runId,
      acceptance: REQUIRED_ACCEPTANCE,
      checks: {
        fullJest: 'PASS',
        typescript: 'PASS',
        securityTenantAcceptance: 'success'
      },
      typescriptScope: TYPESCRIPT_SCOPE
    }));
  });

  test('blocks evidence for invalid commit or missing run identity', () => {
    expect(() => buildFullSuiteEvidence({ ...input, commit: 'unknown' })).toThrow('FULL_SUITE_COMMIT_INVALID');
    expect(() => buildFullSuiteEvidence({ ...input, runId: 0 })).toThrow('FULL_SUITE_RUN_ID_INVALID');
  });

  test('blocks when same-run security acceptance did not pass', () => {
    expect(() => buildFullSuiteEvidence({ ...input, securityTenantResult: 'failure' }))
      .toThrow('FULL_SUITE_SECURITY_ACCEPTANCE_NOT_PASS');
  });
});
