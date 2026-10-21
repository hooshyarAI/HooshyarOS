'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const output = path.join(root, '.hooshyar', 'full-suite-success.json');
const TYPE = 'HOOSHYAR_FULL_SUITE_EVIDENCE_V1';
const REQUIRED_ACCEPTANCE = ['full-jest', 'typescript', 'security-tenant-acceptance'];
const TYPESCRIPT_SCOPE = 'Explicit tsc check of Backend/HBOS/Autonomous/Product/FinalProductFactoryRunner.ts; TypeScript Jest suites are type-checked through ts-jest during Full Jest. Repository-wide tsc remains blocked by existing errors in untouched legacy/retired modules.';

function buildFullSuiteEvidence({ commit, runId, securityTenantResult }) {
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error('FULL_SUITE_COMMIT_INVALID');
  }
  if (!Number.isSafeInteger(runId) || runId < 1) {
    throw new Error('FULL_SUITE_RUN_ID_INVALID');
  }
  if (securityTenantResult !== 'success') {
    throw new Error('FULL_SUITE_SECURITY_ACCEPTANCE_NOT_PASS');
  }
  return {
    type: TYPE,
    status: 'PASS',
    commit,
    runId,
    createdAt: new Date().toISOString(),
    acceptance: [...REQUIRED_ACCEPTANCE],
    checks: {
      fullJest: 'PASS',
      typescript: 'PASS',
      securityTenantAcceptance: securityTenantResult
    },
    typescriptScope: TYPESCRIPT_SCOPE,
    target: 'GitHub Actions full-qualification job; same workflow run and commit'
  };
}

function main() {
  const commit = cp.execFileSync(
    process.platform === 'win32' ? 'git.exe' : 'git',
    ['rev-parse', 'HEAD'],
    { cwd: root, encoding: 'utf8' }
  ).trim();
  const evidence = buildFullSuiteEvidence({
    commit,
    runId: Number(process.env.GITHUB_RUN_ID),
    securityTenantResult: process.env.SECURITY_TENANT_ACCEPTANCE_RESULT
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ type: 'FULL_SUITE_EVIDENCE', ...evidence }, null, 2));
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(JSON.stringify({
      type: 'FULL_SUITE_EVIDENCE',
      status: 'BLOCKED',
      error: error instanceof Error ? error.message : String(error)
    }, null, 2));
    process.exitCode = 2;
  }
}

module.exports = { TYPE, REQUIRED_ACCEPTANCE, TYPESCRIPT_SCOPE, buildFullSuiteEvidence, main };
