#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { validateControlledDrillEvidence } = require('./agent-repair-optin-policy.cjs');

const root = process.cwd();
const dir = path.join(root, '.hooshyar');
const out = path.join(dir, 'cline-runtime-evidence.json');
const matrixPath = path.join(root, 'Docs', 'Product', 'PRODUCT_QUALIFICATION_MATRIX.json');

function gitCommit() {
  try { return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch { return 'UNKNOWN'; }
}
function read(name) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }
  catch { return null; }
}
function current(record, statuses = ['PASS', 'ACCEPTED']) {
  return !!record && record.commit === gitCommit() && statuses.includes(record.status);
}
function hasAll(record, required) {
  return !!record && Array.isArray(record.acceptance) && required.every(item => record.acceptance.includes(item));
}
function cellStatus(ok) { return ok ? 'PASS' : 'BLOCKED'; }

function isCiFeedbackPass(agent, commitSha) {
  if (!agent || agent.commit !== commitSha || !['PASS', 'ACCEPTED'].includes(agent.status)) return false;
  if (agent.mode === 'controlled-drill') return validateControlledDrillEvidence(agent, commitSha).valid;

  const requiredRepairJobs = [...new Set((agent.finding?.failedJobs || [])
    .filter(name => !['runtime-evidence-qualification', 'release-gate'].includes(name)))];
  return agent.type === 'ASSISTANT_REPAIR_MISSION_V1_RESULT' &&
    agent.regression?.status === 'PASS' && agent.regression?.fullJest === 'PASS' &&
    agent.regression?.pythonSyntax === 'PASS' && agent.factoryAcceptance?.status === 'PASS' &&
    agent.factoryAcceptance?.commit === commitSha &&
    agent.factoryAcceptance?.productFactoryJob === 'windows-product-factory' &&
    agent.factoryAcceptance?.productFactoryConclusion === 'success' &&
    Number(agent.repair?.changedFiles) > 0 && requiredRepairJobs.length > 0 &&
    Array.isArray(agent.repair?.repairedJobs) &&
    requiredRepairJobs.every(name => agent.repair.repairedJobs.some(job =>
      job?.name === name && job.conclusion === 'success' && job.runId === agent.factoryAcceptance?.runId));
}

function main() {
  const commitSha = gitCommit();
  let matrix;
  try { matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8')); }
  catch (error) {
    console.error(JSON.stringify({ type: 'CLINE_RUNTIME_EVIDENCE', status: 'BLOCKED', error: 'QUALIFICATION_MATRIX_UNREADABLE' }));
    return 2;
  }
  if (!Array.isArray(matrix.required) || matrix.required.length === 0) {
    console.error(JSON.stringify({ type: 'CLINE_RUNTIME_EVIDENCE', status: 'BLOCKED', error: 'QUALIFICATION_MATRIX_INVALID' }));
    return 2;
  }

  const factory = read('factory-success.json');
  const web = read('web-acceptance-success.json');
  const android = read('android-acceptance-success.json');
  const security = read('security-acceptance-success.json');
  const fullSuite = read('full-suite-success.json');
  const agent = read('agent-repair-success.json');

  const factoryCurrent = current(factory);
  const webCurrent = current(web);
  const androidCurrent = current(android);
  const securityCurrent = current(security);
  const fullSuiteCurrent = current(fullSuite) &&
    fullSuite.type === 'HOOSHYAR_FULL_SUITE_EVIDENCE_V1' &&
    fullSuite.runId === Number(process.env.GITHUB_RUN_ID) &&
    hasAll(fullSuite, ['full-jest', 'typescript', 'security-tenant-acceptance']);
  const agentCurrent = current(agent);

  const factoryRuntime = factoryCurrent && hasAll(factory, ['runtime-health', 'session', 'tenant', 'ingestion', 'analysis', 'dashboard']);
  const factoryRecovery = factoryCurrent && hasAll(factory, ['restart', 'tenant-recovery', 'dashboard-recovery']);
  const factoryFullJest = factoryCurrent && factory.status === 'PASS' && factory.fullJest === 'PASS' && hasAll(factory, ['full-jest']);
  const webRuntime = webCurrent && hasAll(web, ['root', 'health']);
  const webBusiness = webCurrent && hasAll(web, ['session', 'tenant', 'ingestion', 'analysis', 'dashboard']);
  const androidPass = androidCurrent && hasAll(android, ['apk-present', 'device-online', 'android-booted', 'package-manager-ready', 'apk-installed', 'launcher-start', 'process-alive', 'main-activity-visible']);
  const securityPass = securityCurrent && hasAll(security, ['unauthenticated-dashboard-denied', 'unauthenticated-analyze-denied']);
  const tenantPass = securityPass && hasAll(security, ['distinct-tenant-identities', 'tenant-a-data-isolated', 'tenant-b-data-isolated', 'analytics-cross-tenant-read-denied', 'report-artifact-cross-tenant-denied']);
  const ciFeedbackPass = isCiFeedbackPass(agent, commitSha);

  const checks = {
    'win-core': { pass: factoryRuntime, ref: '.hooshyar/factory-success.json', target: 'windows-latest' },
    'win-business': { pass: factoryRuntime, ref: '.hooshyar/factory-success.json', target: 'windows-latest' },
    'win-recovery': { pass: factoryRecovery, ref: '.hooshyar/factory-success.json', target: 'windows-latest' },
    'win-security': { pass: securityPass, ref: '.hooshyar/security-acceptance-success.json', target: 'windows-latest' },
    'web-core': { pass: webRuntime, ref: '.hooshyar/web-acceptance-success.json', target: 'ubuntu-latest' },
    'web-business': { pass: webBusiness, ref: '.hooshyar/web-acceptance-success.json', target: 'ubuntu-latest' },
    'android-release': { pass: androidPass, ref: '.hooshyar/android-acceptance-success.json', target: 'ubuntu-latest / Android emulator API 35' },
    'tenant-isolation': { pass: tenantPass, ref: '.hooshyar/security-acceptance-success.json', target: 'windows-latest' },
    'ci-feedback': { pass: ciFeedbackPass, ref: '.hooshyar/agent-repair-success.json', target: 'GitHub Actions agent-repair workflow' },
    // This cell passes only from a same-commit, same-workflow-run artifact
    // emitted after full Jest and TypeScript pass and security acceptance succeeds.
    'full-suite': { pass: fullSuiteCurrent, ref: fullSuiteCurrent ? '.hooshyar/full-suite-success.json' : null, target: 'GitHub Actions full qualification' }
  };

  const cells = matrix.required.map(required => {
    const check = checks[required.id];
    const pass = !!check?.pass;
    return {
      id: required.id,
      status: cellStatus(pass),
      commitSha,
      capability: required.capability,
      environment: required.environment,
      workflow: required.workflow,
      evidenceKind: required.evidence,
      target: check?.target || 'UNVERIFIED',
      evidenceRef: pass ? check.ref : null
    };
  });
  const blockers = cells.filter(cell => cell.status !== 'PASS').map(cell => ({ id: cell.id, status: cell.status }));
  const evidence = {
    type: 'HOOSHYAR_PRODUCT_QUALIFICATION_EVIDENCE_V1',
    createdAt: new Date().toISOString(),
    commitSha,
    cells,
    blockers,
    verdict: blockers.length === 0 ? 'QUALIFICATION_COMPLETE' : 'REQUIRES_ADDITIONAL_EVIDENCE'
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(evidence, null, 2));
  // Evidence collection is a reporting stage. The final qualification runner
  // owns the release-blocking exit code after validating this report.
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { current, hasAll, isCiFeedbackPass, main };
