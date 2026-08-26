#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const evidencePath = path.join(root, '.hooshyar', 'agent-repair-success.json');
function gitCommit() {
  return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}
function fail(message) {
  console.error(JSON.stringify({ type: 'AGENT_REPAIR_EVIDENCE', status: 'BLOCKED', error: message }, null, 2));
  process.exitCode = 1;
}
try {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const required = [
    'type', 'status', 'commit', 'missionId', 'finding',
    'repair', 'regression', 'factoryAcceptance'
  ];
  const missing = required.filter((key) => evidence[key] === undefined || evidence[key] === null || evidence[key] === '');
  if (missing.length) throw new Error(`AGENT_REPAIR_EVIDENCE_FIELDS_MISSING:${missing.join(',')}`);
  if (evidence.type !== 'ASSISTANT_REPAIR_MISSION_V1_RESULT') throw new Error(`AGENT_REPAIR_EVIDENCE_TYPE_INVALID:${evidence.type}`);
  if (evidence.status !== 'PASS') throw new Error(`AGENT_REPAIR_EVIDENCE_STATUS_INVALID:${evidence.status}`);
  if (evidence.commit !== gitCommit()) throw new Error(`AGENT_REPAIR_EVIDENCE_COMMIT_MISMATCH:${evidence.commit}`);
  if (evidence.regression?.status !== 'PASS') throw new Error('AGENT_REPAIR_REGRESSION_NOT_PASS');
  if (evidence.factoryAcceptance?.status !== 'PASS') throw new Error('AGENT_REPAIR_FACTORY_ACCEPTANCE_NOT_PASS');
  if (evidence.repair?.changedFiles === undefined || evidence.repair.changedFiles < 1) throw new Error('AGENT_REPAIR_NO_IMPLEMENTATION_CHANGE');
  console.log(JSON.stringify({ type: 'AGENT_REPAIR_EVIDENCE', status: 'PASS', commit: evidence.commit, missionId: evidence.missionId }, null, 2));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
