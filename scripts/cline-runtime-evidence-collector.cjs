#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const dir = path.join(root, '.hooshyar');
const out = path.join(dir, 'cline-runtime-evidence.json');

function gitCommit() {
  try { return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch { return 'UNKNOWN'; }
}
function read(name) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }
  catch { return null; }
}
function current(record) { return !!record && record.commit === gitCommit() && record.status === 'PASS'; }

const commit = gitCommit();
const factory = read('factory-success.json');
const web = read('web-acceptance-success.json');

const evidence = {
  type: 'CLINE_RUNTIME_EVIDENCE_V1',
  createdAt: new Date().toISOString(),
  commit,
  cells: {
    'win-core': current(factory) ? 'PASS' : 'REQUIRES_EXECUTION',
    'win-business': current(factory) ? 'PASS' : 'REQUIRES_EXECUTION',
    'win-recovery': current(factory) ? 'PASS' : 'REQUIRES_EXECUTION',
    'web-core': current(web) ? 'PASS' : 'REQUIRES_EXECUTION',
    'web-business': current(web) ? 'PASS' : 'REQUIRES_EXECUTION',
    'full-suite': current(factory) && Array.isArray(factory.acceptance) && factory.acceptance.includes('full-jest') ? 'PASS' : 'REQUIRES_EXECUTION',
    'android-release': 'REQUIRES_DEVICE_EXECUTION',
    'win-security': 'REQUIRES_EXECUTION',
    'tenant-isolation': 'REQUIRES_EXECUTION',
    'ci-feedback': 'REQUIRES_AGENT_EXECUTION'
  },
  sources: {
    factory: current(factory) ? '.hooshyar/factory-success.json' : null,
    web: current(web) ? '.hooshyar/web-acceptance-success.json' : null
  },
  verdict: 'REQUIRES_ADDITIONAL_EVIDENCE'
};

if (Object.values(evidence.cells).every(x => x === 'PASS')) evidence.verdict = 'QUALIFICATION_COMPLETE';
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(out, JSON.stringify(evidence, null, 2), 'utf8');
console.log(JSON.stringify(evidence, null, 2));
process.exitCode = evidence.verdict === 'QUALIFICATION_COMPLETE' ? 0 : 0;
